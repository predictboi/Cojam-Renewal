'use strict';

// Decoding and the static sponsorship policy for the spike. decodeSenderTx and splitV are copied
// unchanged from server/src/policy.js (the Cojam swap fee payer, format checked on mainnet).
// checkStatic is rewritten for the spike allowlist. A transaction is sponsored only if it is:
//   1. SpikePredict setPlayKey(key != 0, key != from, now < expiresAt <= now + MAX_PLAY_KEY_DAYS)
//   2. SpikePredict predict(marketId, choice in {1, 2})
// with type 0x31, chain 1001, value 0, gas limit and gas price under the caps, one sender signature
// that recovers to `from`, and no foreign fee payer. Anything else is rejected with a code.

const { keccak256, recoverAddress, getAddress, isHexString, ZeroAddress, Signature, Interface } = require('ethers');
const { parseTransaction, KlaytnTxFactory, TxType } = require('@kaiachain/js-ext-core');

const FD_SMART_CONTRACT_EXECUTION = TxType.FeeDelegatedSmartContractExecution; // 0x31
const MAX_RAW_BYTES = 4096;

const spikeAbi = new Interface([
  'function setPlayKey(address key, uint64 expiresAt)',
  'function predict(uint256 marketId, uint8 choice)',
  'function playerOf(address sender) view returns (address)',
  'function choiceOf(address player, uint256 marketId) view returns (uint8)',
  'error InvalidKey()',
  'error KeyInUse()',
  'error InvalidExpiry()',
  'error PlayKeyInvalid()',
  'error InvalidChoice()',
  'error AlreadyPredicted(uint256 marketId)',
  'error NoPlayKey()',
  'error Soulbound()',
]);
const SELECTORS = {
  setPlayKey: spikeAbi.getFunction('setPlayKey').selector,
  predict: spikeAbi.getFunction('predict').selector,
};

class PolicyError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'PolicyError';
    this.code = code;
    this.status = status;
  }
}

const reject = (code, message, status) => {
  throw new PolicyError(code, message, status);
};

function toBigInt(v) {
  if (v === undefined || v === null || v === '0x' || v === '') return 0n;
  return BigInt(v);
}

// Chain id and y parity from an EIP-155 style v (Kaia signs v = chainId * 2 + 35 + yParity).
function splitV(vHex) {
  const v = BigInt(vHex);
  if (v < 35n) return { chainId: null, yParity: null };
  const chainId = (v - 35n) / 2n;
  const yParity = Number((v - 35n) % 2n);
  return { chainId: Number(chainId), yParity };
}

/**
 * Decode a sender signed fee delegated transaction (senderTxHashRLP).
 * Returns plain fields plus the recovered signer address. (Copied from server/src/policy.js.)
 */
function decodeSenderTx(raw) {
  if (typeof raw !== 'string' || !isHexString(raw) || raw.length < 4) {
    reject('DECODE_FAILED', 'rawTransaction must be a 0x prefixed hex string');
  }
  if ((raw.length - 2) / 2 > MAX_RAW_BYTES) reject('DECODE_FAILED', 'rawTransaction is too large');

  const typeByte = parseInt(raw.slice(2, 4), 16);
  if (typeByte !== FD_SMART_CONTRACT_EXECUTION) {
    reject(
      'TX_TYPE_NOT_ALLOWED',
      `Only TxTypeFeeDelegatedSmartContractExecution (0x31) is sponsored, got 0x${typeByte.toString(16).padStart(2, '0')}`
    );
  }

  let p;
  try {
    p = parseTransaction(raw);
  } catch (e) {
    reject('DECODE_FAILED', `Could not decode the transaction: ${e.shortMessage || e.message}`);
  }
  if (Number(p.type) !== FD_SMART_CONTRACT_EXECUTION) reject('TX_TYPE_NOT_ALLOWED', 'Unexpected transaction type');

  const sigs = Array.isArray(p.txSignatures) ? p.txSignatures : [];
  if (sigs.length !== 1) {
    reject('SENDER_SIGNATURE_INVALID', 'Exactly one sender signature is required (multisig account keys are not sponsored)');
  }
  const [vHex, r, s] = sigs[0];
  const { chainId, yParity } = splitV(vHex);
  if (chainId === null) reject('SENDER_SIGNATURE_INVALID', 'Sender signature has no chain id');

  const fpSigs = (Array.isArray(p.feePayerSignatures) ? p.feePayerSignatures : []).filter(
    (sig) => !(sig[0] === '0x01' && sig[1] === '0x' && sig[2] === '0x')
  );

  const tx = {
    type: Number(p.type),
    nonce: Number(toBigInt(p.nonce)),
    gasPrice: toBigInt(p.gasPrice),
    gasLimit: toBigInt(p.gasLimit),
    to: p.to ? getAddress(p.to) : null,
    value: toBigInt(p.value),
    from: getAddress(p.from),
    data: (p.data || p.input || '0x').toLowerCase(),
    chainId,
    feePayer: p.feePayer && p.feePayer !== ZeroAddress ? getAddress(p.feePayer) : null,
    feePayerSignatureCount: fpSigs.length,
    txSignatures: sigs,
  };

  let signer;
  try {
    const k = KlaytnTxFactory.fromObject({
      type: tx.type,
      nonce: tx.nonce,
      gasPrice: tx.gasPrice,
      gasLimit: tx.gasLimit,
      to: tx.to,
      value: tx.value,
      from: tx.from,
      data: tx.data,
      chainId: tx.chainId,
    });
    const digest = keccak256(k.sigRLP());
    signer = recoverAddress(digest, Signature.from({ r, s, yParity }));
  } catch (e) {
    reject('SENDER_SIGNATURE_INVALID', `Sender signature could not be verified: ${e.shortMessage || e.message}`);
  }
  tx.signer = signer;
  tx.senderTxHash = keccak256(raw);
  return tx;
}

function decodeCall(name, data) {
  let args;
  try {
    args = spikeAbi.decodeFunctionData(name, data);
  } catch {
    reject('CALLDATA_INVALID', `Calldata for ${name} could not be decoded`);
  }
  if (spikeAbi.encodeFunctionData(name, args).toLowerCase() !== data) {
    reject('CALLDATA_INVALID', `Calldata for ${name} is not canonical`);
  }
  return args;
}

/**
 * Static policy. Returns { action, args, maxCostWei } or throws PolicyError.
 * cfg: { chainId, spikeAddress, feePayerAddress, policy: {...} }; nowSec: unix seconds.
 */
function checkStatic(tx, cfg, nowSec = Math.floor(Date.now() / 1000)) {
  const pol = cfg.policy;

  if (tx.chainId !== cfg.chainId) {
    reject('CHAIN_ID_MISMATCH', `Signed for chain ${tx.chainId}, this service sponsors chain ${cfg.chainId}`);
  }
  if (tx.signer.toLowerCase() !== tx.from.toLowerCase()) {
    reject('SENDER_SIGNATURE_INVALID', `The sender signature recovers to ${tx.signer}, not to the from address ${tx.from}`);
  }
  if (tx.feePayer && tx.feePayer.toLowerCase() !== cfg.feePayerAddress.toLowerCase()) {
    reject('FEE_PAYER_MISMATCH', 'The transaction names a different fee payer');
  }
  if (tx.feePayerSignatureCount > 0) reject('FEE_PAYER_MISMATCH', 'The transaction already carries a fee payer signature');
  if (tx.value !== 0n) reject('VALUE_NOT_ZERO', 'Sponsored transactions must not transfer KAIA');
  if (!tx.to) reject('TARGET_NOT_ALLOWED', 'Contract deployment is not sponsored');
  if (tx.to.toLowerCase() !== cfg.spikeAddress.toLowerCase()) {
    reject('TARGET_NOT_ALLOWED', `Only the SpikePredict contract ${cfg.spikeAddress} is sponsored`);
  }

  const data = tx.data;
  if (data.length < 10) reject('SELECTOR_NOT_ALLOWED', 'Missing function selector');
  const selector = data.slice(0, 10);

  let action;
  let args;
  if (selector === SELECTORS.setPlayKey) {
    const [key, expiresAt] = decodeCall('setPlayKey', data);
    if (key === ZeroAddress || key.toLowerCase() === tx.from.toLowerCase()) {
      reject('CALLDATA_INVALID', 'setPlayKey key must be a new address, not zero and not the sender');
    }
    if (expiresAt <= BigInt(nowSec) || expiresAt > BigInt(nowSec + pol.maxKeyLifetimeSec)) {
      reject('CALLDATA_INVALID', `setPlayKey expiresAt must be in the future and at most ${pol.maxKeyLifetimeSec / 86400} days ahead`);
    }
    action = 'setPlayKey';
    args = { key: getAddress(key), expiresAt: Number(expiresAt) };
  } else if (selector === SELECTORS.predict) {
    const [marketId, choice] = decodeCall('predict', data);
    if (choice !== 1n && choice !== 2n) reject('CALLDATA_INVALID', 'predict choice must be 1 or 2');
    action = 'predict';
    args = { marketId: marketId.toString(), choice: Number(choice) };
  } else {
    reject('SELECTOR_NOT_ALLOWED', 'Only setPlayKey and predict are sponsored');
  }

  if (tx.gasPrice === 0n || tx.gasLimit === 0n) reject('CALLDATA_INVALID', 'Gas price and gas limit must be set');
  if (tx.gasLimit > BigInt(pol.maxGasLimit)) {
    reject('GAS_LIMIT_TOO_HIGH', `Gas limit ${tx.gasLimit} is above the cap ${pol.maxGasLimit}`);
  }
  if (tx.gasPrice > pol.maxGasPriceWei) {
    reject('GAS_PRICE_TOO_HIGH', `Gas price ${tx.gasPrice} kei is above the cap ${pol.maxGasPriceWei} kei`);
  }

  return { action, args, maxCostWei: tx.gasLimit * tx.gasPrice };
}

/** Name a SpikePredict revert from the node's error data, for clear client codes. */
function revertName(data) {
  if (typeof data !== 'string' || !/^0x[0-9a-fA-F]{8}/.test(data)) return null;
  try {
    const e = spikeAbi.parseError(data);
    return e ? e.name : null;
  } catch {
    return null;
  }
}

module.exports = { decodeSenderTx, checkStatic, splitV, revertName, spikeAbi, SELECTORS, PolicyError, FD_SMART_CONTRACT_EXECUTION };
