'use strict';
// Deploys SpikePredict to Kairos (chain 1001) with the test key PRIVATE_KEY from contracts/.env.
// Usage (from platform/spike/contract): npm install && node deploy.js
// The key is never printed. Writes deployment.kairos.json next to this file.
const fs = require('node:fs');
const path = require('node:path');
const { JsonRpcProvider, Wallet, ContractFactory, formatEther } = require('ethers');
const { compile } = require('./compile');
const { spikeEnv } = require('./env');

async function main() {
  const { privateKey, rpcUrl } = spikeEnv();
  const provider = new JsonRpcProvider(rpcUrl, 1001, { staticNetwork: true });
  const chainId = Number((await provider.getNetwork()).chainId);
  if (chainId !== 1001) throw new Error(`RPC is on chain ${chainId}, expected Kairos 1001`);
  const wallet = new Wallet(privateKey, provider);
  const bal = await provider.getBalance(wallet.address);
  console.log(`deployer ${wallet.address}, balance ${formatEther(bal)} test KAIA`);
  if (bal === 0n) throw new Error('The deployer holds no test KAIA: use the faucet at https://www.kaia.io/faucet');

  const a = compile();
  const factory = new ContractFactory(a.abi, a.bytecode, wallet);
  const gasPrice = BigInt(await provider.send('eth_gasPrice', []));
  const c = await factory.deploy({ gasPrice, type: 0 });
  const tx = c.deploymentTransaction();
  console.log(`deploy tx ${tx.hash}`);
  const rc = await tx.wait();
  const address = await c.getAddress();
  const out = {
    network: 'kairos',
    chainId: 1001,
    contract: 'SpikePredict',
    address,
    deployTx: tx.hash,
    block: rc.blockNumber,
    deployer: wallet.address,
    compiler: a.compiler,
    deployedAt: new Date().toISOString(),
    explorer: `https://kairos.kaiascan.io/address/${address}`,
  };
  fs.writeFileSync(path.join(__dirname, 'deployment.kairos.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(`deploy failed: ${e.shortMessage || e.message}`);
  process.exit(1);
});
