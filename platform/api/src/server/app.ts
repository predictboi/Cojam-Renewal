// Fastify app factory. main.ts builds real deps; tests build stubs and call buildApp(deps).
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { ZodError } from "zod";
import { ApiError } from "./errors.ts";
import type { Deps } from "./deps.ts";
import { makeAdminAuth, makeUserAuth } from "../auth/index.ts";
import { ipHash } from "./hash.ts";
import { registerPublicRoutes } from "../routes/public.ts";
import { registerSessionRoutes } from "../routes/session.ts";
import { registerPlayRoutes } from "../routes/play.ts";
import { registerWalletRoutes } from "../routes/wallet.ts";
import { registerInviteRoutes } from "../routes/invite.ts";
import { registerTxRoutes } from "../routes/tx.ts";
import { registerAdminRoutes } from "../routes/admin.ts";
import { registerDevRpcRoutes } from "../routes/devRpc.ts";

export interface RouteKit {
  deps: Deps;
  authUser: ReturnType<typeof makeUserAuth>;
  authAdmin: ReturnType<typeof makeAdminAuth>;
  ipHashOf: (req: FastifyRequest) => string | null;
  deviceOf: (req: FastifyRequest) => string | null;
}

export async function buildApp(deps: Deps, opts: { logger?: boolean | object } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? false,
    trustProxy: deps.config.env.TRUST_PROXY,
    bodyLimit: 64 * 1024,
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      cb(null, deps.config.allowedOrigins.includes(origin));
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["authorization", "content-type", "x-device-id", "x-dev-user", "x-dev-admin", "x-app-version"],
    maxAge: 600,
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ApiError) return reply.status(err.status).send(err.toBody());
    if (err instanceof ZodError) {
      const e = new ApiError("BAD_REQUEST", err.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
      return reply.status(400).send(e.toBody());
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) {
      return reply.status(status).send(new ApiError(status === 404 ? "NOT_FOUND" : "BAD_REQUEST", (err as Error).message).toBody());
    }
    req.log.error({ err }, "unhandled error");
    return reply.status(500).send(new ApiError("INTERNAL").toBody());
  });
  app.setNotFoundHandler((req, reply) => reply.status(404).send(new ApiError("NOT_FOUND", `No route ${req.method} ${req.url.split("?")[0]}`).toBody()));

  const salt = deps.config.env.IP_HASH_SALT ?? "dev-salt";
  const kit: RouteKit = {
    deps,
    authUser: makeUserAuth(deps),
    authAdmin: makeAdminAuth(deps),
    ipHashOf: (req) => ipHash(salt, req.ip),
    deviceOf: (req) => {
      const v = req.headers["x-device-id"];
      return typeof v === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(v) ? v : null;
    },
  };

  registerPublicRoutes(app, kit);
  registerSessionRoutes(app, kit);
  registerPlayRoutes(app, kit);
  registerWalletRoutes(app, kit);
  registerInviteRoutes(app, kit);
  registerTxRoutes(app, kit);
  registerAdminRoutes(app, kit);
  registerDevRpcRoutes(app, kit);
  return app;
}
