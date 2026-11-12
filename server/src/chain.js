'use strict';

// Thin wrapper over the Kaia JSON-RPC endpoint. Everything that touches the network goes
// through this object, so tests replace it with a mock and no other module talks to RPC.

const { JsonRpcProvider, Network, FetchRequest } = require('ethers');

class RpcError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'RpcError';
    this.cause = cause;
    // A JSON-RPC error reply (for example "execution reverted") means the node answered;
    // anything else (timeout, connection refused, HTTP 5xx) means the RPC is unavailable.
    const reply = cause && (cause.error || (cause.info && cause.info.error));
    this.isNodeReply = Boolean(reply && typeof reply.code === 'number');
    this.nodeMessage = reply ? String(reply.message || '') : '';
  }
}

function hexOrNumber(v) {
  if (v === undefined || v === null) return undefined;
  return BigInt(v);
}

function createKaiaChain({ rpcUrl, chainId, timeoutMs = 15000 }) {
  const network = Network.from(chainId);
  const request = new FetchRequest(rpcUrl);
  request.timeout = timeoutMs;
  const provider = new JsonRpcProvider(request, network, { staticNetwork: network, batchMaxCount: 1 });

  const send = async (method, params) => {
    try {
      return await provider.send(method, params);
    } catch (e) {
      throw new RpcError(`${method} failed: ${e.shortMessage || e.message}`, e);
    }
  };

  return {
    provider,
    async getChainId() {
      return Number(BigInt(await send('eth_chainId', [])));
    },
    async getBlockNumber() {
      return Number(BigInt(await send('eth_blockNumber', [])));
    },
    async getBlockTimestamp(tag = 'latest') {
      const b = await send('eth_getBlockByNumber', [typeof tag === 'number' ? `0x${tag.toString(16)}` : tag, false]);
      return Number(BigInt(b.timestamp));
    },
    async getBalance(address) {
      return BigInt(await send('eth_getBalance', [address, 'latest']));
    },
    async getCode(address) {
      return send('eth_getCode', [address, 'latest']);
    },
    async getGasPrice() {
      return BigInt(await send('eth_gasPrice', []));
    },
    async getNonce(address, tag = 'pending') {
      return Number(BigInt(await send('eth_getTransactionCount', [address, tag])));
    },
    async call({ to, data, from }) {
      return send('eth_call', [{ to, data, ...(from ? { from } : {}) }, 'latest']);
    },
    // Throws when the call would revert, which is how simulation rejects a doomed tx.
    async estimateGas({ from, to, data, value = 0n }) {
      return BigInt(await send('eth_estimateGas', [{ from, to, data, value: `0x${value.toString(16)}` }]));
    },
    // Kaia native tx types (0x31 and friends) go through kaia_sendRawTransaction.
    async sendKaiaRawTransaction(signed) {
      return send('kaia_sendRawTransaction', [signed]);
    },
    // Plain legacy transactions from the keeper.
    async sendRawTransaction(signed) {
      return send('eth_sendRawTransaction', [signed]);
    },
    async getReceipt(hash) {
      const r = await send('kaia_getTransactionReceipt', [hash]);
      if (!r) return null;
      return {
        status: Number(BigInt(r.status)),
        gasUsed: hexOrNumber(r.gasUsed),
        effectiveGasPrice: hexOrNumber(r.effectiveGasPrice) ?? hexOrNumber(r.gasPrice),
        blockNumber: Number(BigInt(r.blockNumber)),
      };
    },
    async getLogs({ address, topics, fromBlock, toBlock }) {
      return send('eth_getLogs', [
        { address, topics, fromBlock: `0x${fromBlock.toString(16)}`, toBlock: `0x${toBlock.toString(16)}` },
      ]);
    },
  };
}

module.exports = { createKaiaChain, RpcError };
