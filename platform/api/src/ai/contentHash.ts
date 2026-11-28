// The market content hash written on chain by `createDay` (DEV-PLAN 3.3). The definition (canonical
// JSON of the three languages, the times and the sources) lives in platform/shared/src/content.ts so
// the worker, the API and the PWA hash the same bytes; this file adds the keccak256.
import { keccak256, toBytes } from 'viem';
import { canonicalJson, contentHashPayload, type ContentHashInput } from '../../../shared/src/content.ts';

export { canonicalJson, contentHashPayload as hashPayload };
export type HashInput = ContentHashInput;

export function contentHash(h: HashInput): `0x${string}` {
  return keccak256(toBytes(canonicalJson(contentHashPayload(h))));
}
