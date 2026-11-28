// Decoding of sender signed fee delegated transactions (type 0x31) and the fee payer co-signature.
// Ported from server/src/policy.js (format checked on mainnet) and platform/spike/api (proven on Kairos with
// real phones), with viem for hashing and secp256k1 and @kaiachain/js-ext-core for Kaia's RLP.
import { parseTransaction, KlaytnTxFactory, TxType } from "@kaiachain/js-ext-core";
import { getAddress, isHex, keccak256, recoverAddress, toHex, type Address, type Hex } from "viem";
import { sign } from "viem/accounts";
import { ApiError } from "../server/errors.ts";

export const FD_SMART_CONTRACT_EXECUTION = Number(TxType.FeeDelegatedSmartContractExecution); // 0x31
export const MAX_RAW_BYTES = 4096;
const ZERO = "0x0000000000000000000000000000000000000000";

export interface SenderTx {
  type: number;
  nonce: number;
  gasPrice: bigint;
  gasLimit: bigint;
  to: Address | null;
  value: bigint;
  from: Address;
  data: Hex;
  chainId: number;
  feePayer: Address | null;
  feePayerSignatureCount: number;
  txSignatures: [string, string, string][];
  signer: Address;
  senderTxHash: Hex;
}

function toBigInt(v: unknown): bigint {
  if (v === undefined || v === null || v === "0x" || v === "") return 0n;
  return BigInt(v as string);
}

/** Chain id and y parity from an EIP-155 style v (Kaia signs v = chainId * 2 + 35 + yParity). */
export function splitV(vHex: string): { chainId: number | null; yParity: 0 | 1 | null } {
  const v = BigInt(vHex);
  if (v < 35n) return { chainId: null, yParity: null };
  return { chainId: Number((v - 35n) / 2n), yParity: Number((v - 35n) % 2n) as 0 | 1 };
}

/** Decode a senderTxHashRLP and recover the signer. Throws ApiError with a readable code. */
export async function decodeSenderTx(raw: unknown): Promise<SenderTx> {
  if (typeof raw !== "string" || !isHex(raw) || raw.length < 4) {
    throw new ApiError("DECODE_FAILED", "rawTransaction must be a 0x prefixed hex string");
  }
  if ((raw.length - 2) / 2 > MAX_RAW_BYTES) throw new ApiError("DECODE_FAILED", "rawTransaction is too large");
  const typeByte = parseInt(raw.slice(2, 4), 16);
  if (typeByte !== FD_SMART_CONTRACT_EXECUTION) {
    throw new ApiError(
      "TX_TYPE_NOT_ALLOWED",
      `Only TxTypeFeeDelegatedSmartContractExecution (0x31) is sponsored, got 0x${typeByte.toString(16).padStart(2, "0")}`,
    );
  }
  let p: any;
  try {
    p = parseTransaction(raw);
  } catch (e) {
    throw new ApiError("DECODE_FAILED", `Could not decode the transaction: ${(e as Error).message}`);
  }
  if (Number(p.type) !== FD_SMART_CONTRACT_EXECUTION) throw new ApiError("TX_TYPE_NOT_ALLOWED", "Unexpected transaction type");

  const sigs: [string, string, string][] = Array.isArray(p.txSignatures) ? p.txSignatures : [];
  if (sigs.length !== 1) {
    throw new ApiError("SENDER_SIGNATURE_INVALID", "Exactly one sender signature is required (multisig account keys are not sponsored)");
  }
  const [vHex, r, s] = sigs[0];
  const { chainId, yParity } = splitV(vHex);
  if (chainId === null || yParity === null) throw new ApiError("SENDER_SIGNATURE_INVALID", "Sender signature has no chain id");

  const fpSigs = (Array.isArray(p.feePayerSignatures) ? p.feePayerSignatures : []).filter(
    (sig: string[]) => !(sig[0] === "0x01" && sig[1] === "0x" && sig[2] === "0x"),
  );
  const tx = {
    type: Number(p.type),
    nonce: Number(toBigInt(p.nonce)),
    gasPrice: toBigInt(p.gasPrice),
    gasLimit: toBigInt(p.gasLimit),
    to: p.to ? getAddress(p.to) : null,
    value: toBigInt(p.value),
    from: getAddress(p.from),
    data: String(p.data || p.input || "0x").toLowerCase() as Hex,
    chainId,
    feePayer: p.feePayer && p.feePayer.toLowerCase() !== ZERO ? getAddress(p.feePayer) : null,
    feePayerSignatureCount: fpSigs.length,
    txSignatures: sigs,
  };

  let signer: Address;
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
    } as any);
    const digest = keccak256(k.sigRLP() as Hex);
    signer = await recoverAddress({ hash: digest, signature: { r: r as Hex, s: s as Hex, yParity } });
  } catch (e) {
    throw new ApiError("SENDER_SIGNATURE_INVALID", `Sender signature could not be verified: ${(e as Error).message}`);
  }
  return { ...tx, signer, senderTxHash: keccak256(raw) };
}

/** Kaia tuple signature [v, r, s] with v = chainId * 2 + 35 + yParity. */
export async function signKaiaDigest(digest: Hex, privateKey: Hex, chainId: number): Promise<[Hex, Hex, Hex]> {
  const sig = await sign({ hash: digest, privateKey });
  const yParity = sig.yParity ?? (sig.v !== undefined ? Number(sig.v) - 27 : 0);
  const v = BigInt(chainId) * 2n + 35n + BigInt(yParity);
  return [toHex(v), sig.r, sig.s];
}

/** Adds the fee payer signature and returns the fully signed RLP (for kaia_sendRawTransaction). */
export async function coSignAsFeePayer(tx: SenderTx, feePayer: Address, privateKey: Hex): Promise<Hex> {
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
    txSignatures: tx.txSignatures,
    feePayer,
  } as any);
  const digest = keccak256(k.sigFeePayerRLP() as Hex);
  k.addFeePayerSig(await signKaiaDigest(digest, privateKey, tx.chainId));
  return k.txHashRLP() as Hex;
}

/** Builds and signs a sender 0x31 transaction (tests, scripts and the dev seed). */
export async function signSenderTx(
  privateKey: Hex,
  t: { from: Address; to: Address; data: Hex; nonce?: number; gasLimit?: bigint | number; gasPrice?: bigint; chainId: number; value?: bigint },
): Promise<Hex> {
  const k = KlaytnTxFactory.fromObject({
    type: FD_SMART_CONTRACT_EXECUTION,
    nonce: t.nonce ?? 0,
    gasPrice: t.gasPrice ?? 27_500_000_000n,
    gasLimit: BigInt(t.gasLimit ?? 150_000),
    to: t.to,
    value: t.value ?? 0n,
    from: t.from,
    data: t.data,
    chainId: t.chainId,
  } as any);
  const digest = keccak256(k.sigRLP() as Hex);
  k.addSenderSig(await signKaiaDigest(digest, privateKey, t.chainId));
  return k.senderTxHashRLP() as Hex;
}
