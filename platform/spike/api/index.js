'use strict';

// Spike fee payer entry point: `node index.js` (or `npm start`). Kairos only.
// Start up fails fast on bad config, a node on the wrong chain, or a contract address with no code.

const { Wallet } = require('@kaiachain/ethers-ext/v6');
const { formatUnits } = require('ethers');
const { loadConfig, ConfigError } = require('./src/config');
const { createLogger } = require('./src/log');
const { createKaiaChain } = require('./src/chain');
const { MemoryUsageStore } = require('./src/store');
const { createFeePayerService } = require('./src/feePayer');
const { createApp } = require('./src/server');

async function main() {
  const logger = createLogger({ base: { svc: 'cojam-spike-api' } });
  let cfg;
  try {
    cfg = loadConfig(process.env);
  } catch (e) {
    if (e instanceof ConfigError) {
      logger.error('configuration invalid', { problems: e.problems });
      process.exit(1);
    }
    throw e;
  }

  const chain = createKaiaChain({ rpcUrl: cfg.rpcUrl, chainId: cfg.chainId });
  const nodeChain = await chain.getChainId();
  if (nodeChain !== cfg.chainId) {
    logger.error('RPC is on the wrong chain', { expected: cfg.chainId, got: nodeChain });
    process.exit(1);
  }
  const code = await chain.getCode(cfg.spikeAddress);
  if (!code || code === '0x') {
    logger.error('SPIKE_CONTRACT_ADDRESS has no code on this chain', { address: cfg.spikeAddress });
    process.exit(1);
  }

  const wallet = new Wallet(cfg.feePayerPrivateKey);
  const store = new MemoryUsageStore();
  const feePayer = createFeePayerService({ cfg, chain, store, wallet, logger });
  const { server } = createApp({ cfg, chain, feePayer, logger });

  const balance = await chain.getBalance(wallet.address).catch(() => null);
  server.listen(cfg.port, () => {
    logger.info('spike fee payer listening', {
      port: cfg.port,
      chainId: cfg.chainId,
      spikeContract: cfg.spikeAddress,
      feePayer: wallet.address,
      feePayerBalanceKaia: balance === null ? 'unknown' : formatUnits(balance, 18),
      origins: cfg.allowedOrigins.join(','),
    });
  });

  const stop = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

main().catch((e) => {
  process.stderr.write(`fatal: ${e && e.message}\n`);
  process.exit(1);
});
