'use strict';

// HTTP layer on node:http (no framework). Routes:
//   POST /api/fee-delegate  { rawTransaction }  -> { txHash, action }
//   GET  /api/gas-wallet    gas wallet balance, sponsorship counters, runway
//   GET  /api/health        liveness plus RPC and keeper state (?strict=1 returns 503 when degraded)
// CORS answers only the configured origins. A POST from any other browser origin is refused.

const http = require('node:http');
const crypto = require('node:crypto');
const { formatUnits } = require('ethers');
const { PolicyError } = require('./policy');
const { utcDay } = require('./store');

const MAX_BODY = 16 * 1024;
const VERSION = require('../package.json').version;

function kaiaStr(wei) {
  return formatUnits(wei, 18);
}

function createApp({ cfg, chain, store, feePayer, keeper, logger, now = () => Date.now(), balanceCacheMs = 15000 }) {
  const salt = crypto.randomBytes(16);
  const started = now();
  const allowed = new Set(cfg.allowedOrigins);
  let balanceCache = { at: 0, wei: null };
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

  async function balanceWei() {
    if (balanceCache.wei !== null && now() - balanceCache.at < balanceCacheMs) return balanceCache.wei;
    const wei = await chain.getBalance(feePayer.feePayerAddress);
    balanceCache = { at: now(), wei };
    return wei;
  }

  async function gasWallet() {
    const wei = await balanceWei();
    const day = utcDay(now());
    const s = await store.stats(day);
    const spentToday = s.today.sponsoredSpentWei + s.today.keeperSpentWei;
    const spentTotal = s.total.spentWei + s.total.keeperWei;
    const recent = s.history.slice(-7).filter((h) => h.spentWei > 0n);
    const avg = recent.length ? recent.reduce((a, h) => a + h.spentWei, 0n) / BigInt(recent.length) : 0n;
    const budgetLeft = cfg.policy.dailyBudgetWei > spentToday ? cfg.policy.dailyBudgetWei - spentToday : 0n;
    return {
      address: feePayer.feePayerAddress,
      chainId: cfg.chainId,
      network: cfg.chainName,
      balanceKaia: kaiaStr(wei),
      balanceWei: wei.toString(),
      floorKaia: kaiaStr(cfg.policy.minBalanceWei),
      keeperFloorKaia: kaiaStr(cfg.keeper.minBalanceWei),
      sponsorshipActive: wei >= cfg.policy.minBalanceWei && budgetLeft > 0n,
      dailyBudgetKaia: kaiaStr(cfg.policy.dailyBudgetWei),
      budgetLeftTodayKaia: kaiaStr(budgetLeft),
      today: {
        day,
        sponsoredTx: s.today.sponsored,
        sponsoredSpentKaia: kaiaStr(s.today.sponsoredSpentWei),
        keeperTx: s.today.keeperTx,
        keeperLotsReleased: s.today.keeperLots,
        keeperSpentKaia: kaiaStr(s.today.keeperSpentWei),
        spentKaia: kaiaStr(spentToday),
      },
      total: {
        sponsoredTx: s.total.sponsored,
        sponsoredSpentKaia: kaiaStr(s.total.spentWei),
        keeperTx: s.total.keeperTx,
        keeperLotsReleased: s.total.keeperLots,
        keeperSpentKaia: kaiaStr(s.total.keeperWei),
        spentKaia: kaiaStr(spentTotal),
      },
      averageDailySpendKaia: kaiaStr(avg),
      // Days the current balance lasts at the average daily spend of the last 7 days with spend.
      runwayDays: avg > 0n ? Number((wei * 10n) / avg) / 10 : null,
      countersSince: s.countersSince,
      countersNote: 'Counters live in memory and restart from zero on deploy; the balance is read from chain.',
    };
  }

  async function health() {
    if (healthCache.value && now() - healthCache.at < 10000) return healthCache.value;
    const out = {
      ok: true,
      service: 'cojam-gas-server',
      version: VERSION,
      mode: cfg.mode,
      chainId: cfg.chainId,
      uptimeSec: Math.round((now() - started) / 1000),
      rpc: { ok: false },
      feePayer: { address: feePayer.feePayerAddress },
      keeper: keeper ? keeper.status : { enabled: false },
    };
    try {
      out.rpc.latestBlock = await chain.getBlockNumber();
      out.rpc.ok = true;
      const wei = await balanceWei();
      out.feePayer.balanceKaia = kaiaStr(wei);
      out.feePayer.aboveFloor = wei >= cfg.policy.minBalanceWei;
    } catch (e) {
      out.rpc.error = 'RPC unreachable';
    }
    out.degraded = !out.rpc.ok || out.feePayer.aboveFloor === false || Boolean(keeper && keeper.status.consecutiveErrors >= 3);
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
      if (url.pathname === '/api/fee-delegate') {
        if (req.method !== 'POST') return send(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST' } }, { Allow: 'POST, OPTIONS', ...cors });
        // Browsers always send Origin on a cross origin POST. Requests without one (curl,
        // scripts) are allowed: CORS is not the security boundary, the policy is.
        if (origin && !cors['Access-Control-Allow-Origin']) {
          throw new PolicyError('ORIGIN_NOT_ALLOWED', 'Origin not allowed', 403);
        }
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

      if (url.pathname === '/api/gas-wallet' && req.method === 'GET') {
        return send(res, 200, await gasWallet(), cors);
      }

      if (url.pathname === '/api/health' && (req.method === 'GET' || req.method === 'HEAD')) {
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
  return { server, gasWallet, health };
}

module.exports = { createApp };
