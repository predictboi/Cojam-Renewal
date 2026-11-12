'use strict';

// Entry point. RUN_MODE (or the first CLI argument) picks what runs in this process:
//   all     API and keeper together (default, one Render web service)
//   api     only the HTTP API
//   keeper  only the keeper (a Render background worker)
//
// Start up fails fast: bad config, a node on the wrong chain, a swap address with no code,
// or a swap whose OLD_TOKEN differs from OLD_CT_ADDRESS all stop the process with exit 1.

const { Wallet } = require('@kaiachain/ethers-ext/v6');
const { formatUnits, getAddress } = require('ethers');
const { loadConfig, ConfigError } = require('./config');
const { createLogger } = require('./log');
const { createKaiaChain } = require('./chain');
const { MemoryUsageStore } = require('./store');
const { createFeePayerService } = require('./feePayer');
const { createKeeper } = require('./keeper');
const { createApp } = require('./server');
const { swapAbi } = require('./abi');

async function main() {
  const logger = createLogger({ base: { svc: 'cojam-gas' } });
  const env = { ...process.env };
  if (process.argv[2]) env.RUN_MODE = process.argv[2];

  let cfg;
  try {
    cfg = loadConfig(env);
  } catch (e) {
    if (e instanceof ConfigError) {
      logger.error('configuration invalid, exiting', { problems: e.problems });
      process.exit(1);
    }
    throw e;
  }

  const chain = createKaiaChain({ rpcUrl: cfg.rpcUrl, chainId: cfg.chainId });
  const wallet = new Wallet(cfg.feePayerPrivateKey);

  const remoteChainId = await chain.getChainId();
  if (remoteChainId !== cfg.chainId) {
    logger.error('KAIA_RPC_URL serves another chain, exiting', { expected: cfg.chainId, actual: remoteChainId });
    process.exit(1);
  }
  const code = await chain.getCode(cfg.swapAddress);
  if (!code || code === '0x') {
    logger.error('SWAP_CONTRACT_ADDRESS has no contract code on this chain, exiting', { swap: cfg.swapAddress });
    process.exit(1);
  }
  const [oldToken] = swapAbi.decodeFunctionResult(
    'OLD_TOKEN',
    await chain.call({ to: cfg.swapAddress, data: swapAbi.encodeFunctionData('OLD_TOKEN', []) })
  );
  if (getAddress(oldToken) !== cfg.oldCtAddress) {
    logger.error('the swap contract points at another old token than OLD_CT_ADDRESS, exiting', {
      swapOldToken: oldToken,
      configured: cfg.oldCtAddress,
    });
    process.exit(1);
  }

  const balance = await chain.getBalance(wallet.address);
  logger.info('starting', {
    mode: cfg.mode,
    chainId: cfg.chainId,
    swap: cfg.swapAddress,
    oldCt: cfg.oldCtAddress,
    gasWallet: wallet.address,
    gasWalletKaia: formatUnits(balance, 18),
    origins: cfg.allowedOrigins,
  });

  const store = new MemoryUsageStore();
  const keeper = cfg.keeper.enabled
    ? createKeeper({ cfg, chain, store, wallet, logger: logger.child({ part: 'keeper' }) })
    : null;

  let server = null;
  if (cfg.mode === 'all' || cfg.mode === 'api') {
    const feePayer = createFeePayerService({ cfg, chain, store, wallet, logger: logger.child({ part: 'api' }) });
    ({ server } = createApp({ cfg, chain, store, feePayer, keeper, logger }));
    server.listen(cfg.port, () => logger.info('api listening', { port: cfg.port }));
  }
  if (keeper) keeper.start();

  const shutdown = (signal) => {
    logger.info('shutting down', { signal });
    if (keeper) keeper.stop();
    if (server) server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
    if (!server) process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((e) => {
  process.stdout.write(`${JSON.stringify({ ts: new Date().toISOString(), level: 'error', msg: 'start up failed', error: e.message })}\n`);
  process.exit(1);
});
