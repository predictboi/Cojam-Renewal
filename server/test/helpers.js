'use strict';

// Shared test fixtures. Every key here is generated at random for the run and thrown away;
// no real key is used or stored anywhere in the tests.

const { Wallet: KaiaWallet, TxType } = require('@kaiachain/ethers-ext/v6');
const { Wallet, parseUnits, getAddress, keccak256 } = require('ethers');
const { loadConfig } = require('../src/config');
const { oldCtAbi, swapAbi } = require('../src/abi');

const SWAP = getAddress('0x5a0b54d5dc17e0aadc383d2db43b0a0d3e029c4c');
const OLD_CT = getAddress('0x7f223b1607171b81ebd68d22f1ca79157fd4a44b');
const GKEI = 1_000_000_000n;

function randomKey() {
  return Wallet.createRandom().privateKey;
}

function testEnv(overrides = {}) {
  return {
    KAIA_RPC_URL: 'http://127.0.0.1:1',
    CHAIN_ID: '8217',
    SWAP_CONTRACT_ADDRESS: SWAP,
    FEE_PAYER_PRIVATE_KEY: randomKey(),
    ALLOWED_ORIGINS: 'https://cojam.example,http://localhost:8811',
    SWAP_DEPLOY_BLOCK: '100',
    RUN_MODE: 'all',
    ...overrides,
  };
}

function testConfig(overrides) {
  return loadConfig(testEnv(overrides));
}

async function senderSign(wallet, { to, data, value = 0n, gasLimit = 100000n, gasPrice = 27n * GKEI + GKEI / 2n, chainId = 8217, nonce = 0, type = TxType.FeeDelegatedSmartContractExecution }) {
  return wallet.signTransaction({ type, from: wallet.address, to, data, value, gasLimit, gasPrice, chainId, nonce });
}

const calls = {
  approve: (spender, amount = parseUnits('1000', 18)) => oldCtAbi.encodeFunctionData('approve', [spender, amount]),
  migrate: (amount = parseUnits('1000', 18)) => swapAbi.encodeFunctionData('migrate', [amount]),
  claim: (maxLots = 10) => swapAbi.encodeFunctionData('claim', [maxLots]),
  claimFor: (user, maxLots = 10) => swapAbi.encodeFunctionData('claimFor', [user, maxLots]),
};

function nodeError(message) {
  return Object.assign(new Error(message), { name: 'RpcError', isNodeReply: true, nodeMessage: message });
}

function transportError() {
  return Object.assign(new Error('timeout'), { name: 'RpcError', isNodeReply: false });
}

// Mock Kaia RPC for the fee payer: balance, balanceOf, estimateGas, broadcast, receipts.
function mockChain(opts = {}) {
  const state = {
    feePayerBalance: opts.feePayerBalance ?? parseUnits('100', 18),
    oldCtBalance: opts.oldCtBalance ?? parseUnits('5000', 18),
    estimate: opts.estimate ?? 60000n,
    estimateError: opts.estimateError ?? null,
    sendError: opts.sendError ?? null,
    sent: [],
    receipts: new Map(),
  };
  return {
    state,
    async getBalance() {
      if (opts.balanceError) throw opts.balanceError;
      return state.feePayerBalance;
    },
    async call({ to, data }) {
      if (to.toLowerCase() === OLD_CT.toLowerCase() && data.startsWith(oldCtAbi.getFunction('balanceOf').selector)) {
        return oldCtAbi.encodeFunctionResult('balanceOf', [state.oldCtBalance]);
      }
      throw nodeError('unexpected call in mock');
    },
    async estimateGas() {
      if (state.estimateError) throw state.estimateError;
      return state.estimate;
    },
    async sendKaiaRawTransaction(signed) {
      if (state.sendError) throw state.sendError;
      state.sent.push(signed);
      const hash = keccak256(signed);
      state.receipts.set(hash, { status: 1, gasUsed: 50000n, effectiveGasPrice: 27n * GKEI + GKEI / 2n, blockNumber: 1 });
      return hash;
    },
    async getReceipt(hash) {
      return state.receipts.get(hash) || null;
    },
    async getBlockNumber() {
      return 1234;
    },
  };
}

module.exports = { SWAP, OLD_CT, GKEI, KaiaWallet, randomKey, testEnv, testConfig, senderSign, calls, nodeError, transportError, mockChain };
