// Prints a new random service token for the operations agent, once, and its SHA-256.
//   npx tsx scripts/make-service-token.ts
// Put the hash in Render (ADMIN_SERVICE_TOKEN_SHA256 on cojam-app-api) and the token in the agent's credential
// form. The token is not stored anywhere by this script; run it again to rotate.
import { createHash, randomBytes } from "node:crypto";

const token = "cjops_" + randomBytes(32).toString("base64url");
const hash = createHash("sha256").update(token, "utf8").digest("hex");
console.log("Service token (shown once, give it to the agent only):");
console.log(token);
console.log("");
console.log("ADMIN_SERVICE_TOKEN_SHA256 (put this in Render):");
console.log(hash);
