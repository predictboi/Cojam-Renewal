// Copied from the proven spike (platform/spike/web/src/lib/kaiaTx.ts).
// Building and assembling Kaia TxTypeFeeDelegatedSmartContractExecution (0x31) transactions by hand,
// so that any "sign this 32 byte hash" primitive can be the sender: a Privy embedded wallet through
// `secp256k1_sign`, or a local ethers key (the play key, or the ?devkey=1 stand in).
//
// Why by hand and not `@kaiachain/ethers-ext`'s Wallet: the ethers-ext signers need a private key
// (Wallet) or a Kaia aware injected wallet (klay_signTransaction). A Privy embedded wallet is neither:
// it only exposes an EIP-1193 provider whose raw signing method signs a hash. So we use the transaction
// object of `@kaiachain/js-ext-core` (the core library ethers-ext is built on, also used by server/):
//   KlaytnTxFactory.fromObject(fields) -> tx
//   sigHash = keccak256(tx.sigRLP())                    (Kaia SigRLP, docs.kaia.io fee delegation)
//   signature = signer.signHash(sigHash)                (65 bytes r || s || v from Privy or ethers)
//   tx.addSenderSig([vKaia, r, s])                      vKaia = chainId * 2 + 35 + yParity
//   raw = tx.senderTxHashRLP()                          (0x31 || rlp([..., txSignatures]))
// `raw` is posted to the fee payer, which co-signs and broadcasts it.
//
// Pure module: no DOM, no React, so node --test can import it (test/kaiaTx.test.ts).

import { KlaytnTxFactory, TxType } from '@kaiachain/js-ext-core';
import { Signature, getAddress, keccak256, recoverAddress } from 'ethers';

export const FD_SCE = TxType.FeeDelegatedSmartContractExecution as number; // 0x31 = 49


export interface FdCall {
  chainId: number;
  from: string;
  to: string;
  data: string;
  nonce: number;
  gasLimit: bigint;
  gasPrice: bigint;
}

export interface SignatureInfo {
  /** What the signer returned, as given. */
  returned: string;
  /** Byte length of the returned hex (65 expected). */
  byteLength: number;
  /** The last byte as returned (27/28 or 0/1). */
  vReturned: number | null;
  yParity: 0 | 1;
  /** The v put into the Kaia txSignatures tuple: chainId * 2 + 35 + yParity. */
  vKaia: number;
  r: string;
  s: string;
  /** Address recovered from the hash and the signature. */
  recovered: string;
  conversion: string;
}

export interface BuiltTx {
  call: FdCall;
  sigHash: string;
  // The js-ext-core transaction object (kept to attach the signature).
  tx: ReturnType<typeof KlaytnTxFactory.fromObject>;
}

/** Build the unsigned 0x31 object and its sender signature hash. */
export function buildFdCall(call: FdCall): BuiltTx {
  const tx = KlaytnTxFactory.fromObject({
    type: FD_SCE,
    chainId: call.chainId,
    nonce: call.nonce,
    gasPrice: call.gasPrice,
    gasLimit: call.gasLimit,
    to: getAddress(call.to),
    value: 0,
    from: getAddress(call.from),
    data: call.data,
  });
  const sigHash = keccak256(tx.sigRLP());
  return { call, sigHash, tx };
}

/**
 * Read any common secp256k1 signature encoding (65 bytes with v 27/28 or 0/1, or 64 byte EIP-2098
 * compact) and turn it into the Kaia sender tuple for `chainId`. Throws when the signature does not
 * recover to `expectedSigner`.
 */
export function toKaiaSignature(sigHash: string, returned: string, chainId: number, expectedSigner: string): SignatureInfo {
  if (typeof returned !== 'string' || !/^0x[0-9a-fA-F]+$/.test(returned)) {
    throw new Error(`The signer returned ${JSON.stringify(returned)}, not a hex string`);
  }
  const byteLength = (returned.length - 2) / 2;
  let vReturned: number | null = null;
  let normalised = returned;
  if (byteLength === 65) {
    vReturned = parseInt(returned.slice(-2), 16);
    if (vReturned === 0 || vReturned === 1) normalised = returned.slice(0, -2) + (vReturned + 27).toString(16);
    else if (vReturned !== 27 && vReturned !== 28) throw new Error(`Unexpected v byte ${vReturned} in a 65 byte signature`);
  } else if (byteLength !== 64) {
    throw new Error(`Unexpected signature length ${byteLength} bytes (65 or 64 expected)`);
  }
  const sig = Signature.from(normalised);
  const yParity = sig.yParity as 0 | 1;
  const recovered = recoverAddress(sigHash, sig);
  if (recovered.toLowerCase() !== expectedSigner.toLowerCase()) {
    throw new Error(`The signature recovers to ${recovered}, expected ${expectedSigner}`);
  }
  const vKaia = chainId * 2 + 35 + yParity;
  const conversion =
    byteLength === 64
      ? `64 byte compact signature: yParity ${yParity} from the top bit of s, v = ${chainId} * 2 + 35 + ${yParity} = ${vKaia}`
      : `v ${vReturned} -> yParity ${yParity} -> v = ${chainId} * 2 + 35 + ${yParity} = ${vKaia}`;
  return { returned, byteLength, vReturned, yParity, vKaia, r: sig.r, s: sig.s, recovered, conversion };
}

/** Attach the sender signature and return the sender signed raw transaction (senderTxHashRLP). */
export function assembleSenderRaw(built: BuiltTx, sig: SignatureInfo): string {
  built.tx.addSenderSig(['0x' + sig.vKaia.toString(16), sig.r, sig.s]);
  const raw = built.tx.senderTxHashRLP();
  if (!/^0x31/i.test(raw)) throw new Error('Assembly did not produce a 0x31 transaction');
  return raw;
}

/** One call: build, sign with any hash signer, convert and assemble. */
export async function signFdCall(
  call: FdCall,
  signHash: (hash: string) => Promise<string>
): Promise<{ raw: string; sigHash: string; sig: SignatureInfo; signMs: number }> {
  const built = buildFdCall(call);
  const t0 = performance.now();
  const returned = await signHash(built.sigHash);
  const signMs = Math.round((performance.now() - t0) * 10) / 10;
  const sig = toKaiaSignature(built.sigHash, returned, call.chainId, call.from);
  return { raw: assembleSenderRaw(built, sig), sigHash: built.sigHash, sig, signMs };
}
