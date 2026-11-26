'use strict';

// HTTP layer on node:http, adapted from server/src/server.js. Routes:
//   POST /sponsor  { rawTransaction }  -> { txHash, action, from, nonce, args, serverMs }
//                                         or { error: { code, message, txHash? } }
//   GET  /health   liveness, chain, contract, fee payer address and balance, RPC state
// CORS answers only ALLOWED_ORIGINS. A POST from any other browser origin is refused.

const http = require('node:http');
const crypto = require('node:crypto');
const { formatUnits } = require('ethers');
const { PolicyError } = require('./policy');

const MAX_BODY = 16 * 1024;
const VERSION = require('../package.json').version;

function createApp({ cfg, chain, feePayer, logger, now = () => Date.now() }) {
  const salt = crypto.randomBytes(16);
  const started = now();
  const allowed = new Set(cfg.allowedOrigins);
  let healthCache = { at: 0, value: null };

  const ipKeyOf = (req) => {
    let ip = req.socket.remoteAddress || '';
    if (cfg.trustProxy && req.headers['x-forwarded-for']) ip = String(req.headers['x-forwarded-for']).split(',')[0].trim();
    if (!ip) return undefined;
    return crypto.createHmac('sha256', salt).update(ip).digest('hex').slice(0, 16);
  };

  const send = (res, status, body, extra = {}) => {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Origin',
      ...extra,
    });
    res.end(JSON.stringify(body));
  };

  const corsHeaders = (origin) =>
    origin && allowed.has(origin)
      ? {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '600',
        }
      : {};

  const readBody = (req) =>
    new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      if (Number(req.headers['content-length'] || 0) > MAX_BODY) {
        reject(new PolicyError('BODY_TOO_LARGE', 'Request body is too large', 413));
        return;
      }
      let over = false;
      req.on('data', (c) => {
        size += c.length;
        if (over) return;
        if (size > MAX_BODY) {
          over = true;
          chunks.length = 0;
          reject(new PolicyError('BODY_TOO_LARGE', 'Request body is too large', 413));
        } else {
          chunks.push(c);
        }
      });
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    });

  async function health() {
    if (healthCache.value && now() - healthCache.at < 5000) return healthCache.value;
    const out = {
      ok: true,
      service: 'cojam-spike-api',
      version: VERSION,
      chainId: cfg.chainId,
      spikeContract: cfg.spikeAddress,
      uptimeSec: Math.round((now() - started) / 1000),
      rpc: { ok: false },
      feePayer: { address: feePayer.feePayerAddress },
      limits: {
        maxGasLimit: cfg.policy.maxGasLimit,
        maxGasPriceGkei: formatUnits(cfg.policy.maxGasPriceWei, 9),
        senderDailyLimit: cfg.policy.senderDailyLimit,
        senderPerMinuteLimit: cfg.policy.senderPerMinuteLimit,
      },
    };
    try {
      out.rpc.latestBlock = await chain.getBlockNumber();
      out.rpc.ok = true;
      const wei = await chain.getBalance(feePayer.feePayerAddress);
      out.feePayer.balanceKaia = formatUnits(wei, 18);
      out.feePayer.aboveFloor = wei >= cfg.policy.minBalanceWei;
    } catch {
      out.rpc.error = 'RPC unreachable';
    }
    out.degraded = !out.rpc.ok || out.feePayer.aboveFloor === false;
    healthCache = { at: now(), value: out };
    return out;
  }

  async function handle(req, res) {
    const url = new URL(req.url, 'http://local');
    const origin = req.headers.origin ? String(req.headers.origin).replace(/\/$/, '') : undefined;
    const cors = corsHeaders(origin);

    if (req.method === 'OPTIONS') {
      if (!cors['Access-Control-Allow-Origin']) return send(res, 403, { error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Origin not allowed' } });
      res.writeHead(204, { ...cors, Vary: 'Origin' });
      return res.end();
    }

    try {
      if (url.pathname === '/sponsor') {
        if (req.method !== 'POST') return send(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST' } }, { Allow: 'POST, OPTIONS', ...cors });
        // Browsers always send Origin on a cross origin POST. Requests without one (scripts) are
        // allowed: CORS is not the security boundary, the policy is.
        if (origin && !cors['Access-Control-Allow-Origin']) throw new PolicyError('ORIGIN_NOT_ALLOWED', `Origin ${origin} is not allowed`, 403);
        const type = String(req.headers['content-type'] || '');
        if (!type.startsWith('application/json')) throw new PolicyError('BAD_REQUEST', 'Content-Type must be application/json', 415);
        const text = await readBody(req);
        let body;
        try {
          body = JSON.parse(text);
        } catch {
          throw new PolicyError('BAD_REQUEST', 'Body must be JSON');
        }
        if (!body || typeof body.rawTransaction !== 'string') {
          throw new PolicyError('BAD_REQUEST', 'Body must be { "rawTransaction": "0x31..." } (the sender signed transaction)');
        }
        const out = await feePayer.sponsor(body.rawTransaction, { ipKey: ipKeyOf(req), origin });
        return send(res, 200, out, cors);
      }

      if (url.pathname === '/health' && (req.method === 'GET' || req.method === 'HEAD')) {
        const h = await health();
        const strict = url.searchParams.get('strict') === '1';
        return send(res, strict && h.degraded ? 503 : 200, h, cors);
      }

      return send(res, 404, { error: { code: 'NOT_FOUND', message: 'Not found' } }, cors);
    } catch (err) {
      if (err instanceof PolicyError) {
        if (err.code === 'BODY_TOO_LARGE') {
          res.on('finish', () => req.destroy());
          return send(res, 413, { error: { code: err.code, message: err.message } }, { ...cors, Connection: 'close' });
        }
        const body = { error: { code: err.code, message: err.message } };
        if (err.txHash) body.error.txHash = err.txHash;
        return send(res, err.status || 400, body, cors);
      }
      if (err && err.name === 'RpcError') {
        return send(res, 503, { error: { code: 'RPC_UNAVAILABLE', message: 'Kaia RPC is unavailable, try again shortly' } }, cors);
      }
      logger.error('unhandled error', { error: err, path: url.pathname });
      return send(res, 500, { error: { code: 'INTERNAL', message: 'Internal error' } }, cors);
    }
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent) send(res, 500, { error: { code: 'INTERNAL', message: 'Internal error' } });
    });
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;
  return { server, health };
}

module.exports = { createApp };
