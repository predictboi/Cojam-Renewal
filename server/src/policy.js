'use strict';

// Decoding and the static part of the sponsorship policy. "Static" means it needs no
// network: transaction type, chain id, value, target, calldata, gas caps and the sender
// signature. Checks that need the chain (balances, simulation, budget) live in feePayer.js.
//
// The policy is an allowlist. A transaction is sponsored only if it is exactly one of:
//   1. old CT  approve(spender == SWAP_CONTRACT, any amount)
//   2. swap    migrate(amount > 0)
//   3. swap    claim(1 <= maxLots <= MAX_CLAIM_LOTS)
//   4. swap    claimFor(user != 0, 1 <= maxLots <= MAX_CLAIM_LOTS)
// Anything else is rejected with a code. Nothing else is ever signed.

const { keccak256, recoverAddress, getAddress, isHexString, ZeroAddress, Signature } = require('ethers');
const { parseTransaction, KlaytnTxFactory, TxType } = require('@kaiachain/js-ext-core');
const { oldCtAbi, swapAbi, SELECTORS } = require('./abi');

const FD_SMART_CONTRACT_EXECUTION = TxType.FeeDelegatedSmartContractExecution; // 0x31
const MAX_RAW_BYTES = 4096;

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
 * Returns plain fields plus the recovered signer address.
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

  // Fee payer fields: a sender RLP may carry an empty or zero fee payer. A different
  // fee payer, or fee payer signatures already present, means it is not meant for us.
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

  // Recover the sender from its signature over SigRLP and compare with `from`.
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

function decodeCall(iface, name, data) {
  let args;
  try {
    args = iface.decodeFunctionData(name, data);
  } catch {
    reject('CALLDATA_INVALID', `Calldata for ${name} could not be decoded`);
  }
  // Strict: the calldata must be exactly the canonical encoding (no trailing bytes).
  if (iface.encodeFunctionData(name, args).toLowerCase() !== data) {
    reject('CALLDATA_INVALID', `Calldata for ${name} is not canonical`);
  }
  return args;
}

/**
 * Static policy. Returns { action, args, maxCostWei } or throws PolicyError.
 * cfg: { chainId, oldCtAddress, swapAddress, feePayerAddress, policy: {...} }
 */
function checkStatic(tx, cfg) {
  const pol = cfg.policy;

  if (tx.chainId !== cfg.chainId) {
    reject('CHAIN_ID_MISMATCH', `Signed for chain ${tx.chainId}, this service sponsors chain ${cfg.chainId}`);
  }
  if (tx.signer.toLowerCase() !== tx.from.toLowerCase()) {
    reject('SENDER_SIGNATURE_INVALID', 'The sender signature does not match the from address');
  }
  if (tx.feePayer && tx.feePayer.toLowerCase() !== cfg.feePayerAddress.toLowerCase()) {
    reject('FEE_PAYER_MISMATCH', 'The transaction names a different fee payer');
  }
  if (tx.feePayerSignatureCount > 0) reject('FEE_PAYER_MISMATCH', 'The transaction already carries a fee payer signature');
  if (tx.value !== 0n) reject('VALUE_NOT_ZERO', 'Sponsored transactions must not transfer KAIA');
  if (!tx.to) reject('TARGET_NOT_ALLOWED', 'Contract deployment is not sponsored');

  const data = tx.data;
  if (data.length < 10) reject('SELECTOR_NOT_ALLOWED', 'Missing function selector');
  const selector = data.slice(0, 10);
  const to = tx.to.toLowerCase();

  let action;
  let args;
  let gasCap;

  if (to === cfg.oldCtAddress.toLowerCase()) {
    if (selector !== SELECTORS.approve) reject('SELECTOR_NOT_ALLOWED', 'Only approve is sponsored on old CT');
    const [spender, amount] = decodeCall(oldCtAbi, 'approve', data);
    if (spender.toLowerCase() !== cfg.swapAddress.toLowerCase()) {
      reject('SPENDER_NOT_ALLOWED', 'approve is sponsored only when the spender is the swap contract');
    }
    action = 'approve';
    args = { spender: getAddress(spender), amount: amount.toString() };
    gasCap = pol.maxGasLimitApprove;
  } else if (to === cfg.swapAddress.toLowerCase()) {
    if (selector === SELECTORS.migrate) {
      const [amount] = decodeCall(swapAbi, 'migrate', data);
      if (amount === 0n) reject('CALLDATA_INVALID', 'migrate amount must be above zero');
      action = 'migrate';
      args = { amount: amount.toString() };
    } else if (selector === SELECTORS.claim) {
      const [maxLots] = decodeCall(swapAbi, 'claim', data);
      if (maxLots < 1n || maxLots > BigInt(pol.maxClaimLots)) {
        reject('CALLDATA_INVALID', `claim maxLots must be between 1 and ${pol.maxClaimLots}`);
      }
      action = 'claim';
      args = { maxLots: Number(maxLots) };
    } else if (selector === SELECTORS.claimFor) {
      const [user, maxLots] = decodeCall(swapAbi, 'claimFor', data);
      if (user === ZeroAddress) reject('CALLDATA_INVALID', 'claimFor user must not be the zero address');
      if (maxLots < 1n || maxLots > BigInt(pol.maxClaimLots)) {
        reject('CALLDATA_INVALID', `claimFor maxLots must be between 1 and ${pol.maxClaimLots}`);
      }
      action = 'claimFor';
      args = { user: getAddress(user), maxLots: Number(maxLots) };
    } else {
      reject('SELECTOR_NOT_ALLOWED', 'Only migrate, claim and claimFor are sponsored on the swap contract');
    }
    gasCap = pol.maxGasLimitSwap;
  } else {
    reject('TARGET_NOT_ALLOWED', 'Only the old CT token and the swap contract are sponsored');
  }

  if (tx.gasLimit > BigInt(gasCap)) {
    reject('GAS_LIMIT_TOO_HIGH', `Gas limit ${tx.gasLimit} is above the cap ${gasCap} for ${action}`);
  }
  if (tx.gasPrice > pol.maxGasPriceWei) {
    reject('GAS_PRICE_TOO_HIGH', `Gas price ${tx.gasPrice} kei is above the cap ${pol.maxGasPriceWei} kei`);
  }
  if (tx.gasPrice === 0n || tx.gasLimit === 0n) reject('CALLDATA_INVALID', 'Gas price and gas limit must be set');

  // On Kaia the full gasPrice is charged for this tx type (no refund of the tip), so the
  // worst case cost the fee payer can be charged is gasLimit * gasPrice.
  return { action, args, maxCostWei: tx.gasLimit * tx.gasPrice };
}

module.exports = { decodeSenderTx, checkStatic, PolicyError, FD_SMART_CONTRACT_EXECUTION };
