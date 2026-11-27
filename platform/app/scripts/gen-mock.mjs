// Copies the design's mock data (platform/design/assets/mock.js) into the app's mock adapter. Run: node scripts/gen-mock.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
import { getAddress } from 'viem';
const src = readFileSync(new URL('../../design/assets/mock.js', import.meta.url), 'utf8');
const sb = { window: {}, Date, Math };
vm.runInNewContext(src, sb);
const M = sb.window.MOCK;
const out = JSON.parse(JSON.stringify(M));
for (const q of Object.values(out.questions)) if (q.img) q.img = '/' + q.img;
// the player's address in its EIP-55 checksummed form (as the Daily Paper mock), so every mixed case address on screen is valid
out.user.address = getAddress(out.user.address.toLowerCase());
writeFileSync(new URL('../src/api/mock/design-mock.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log('mock keys', Object.keys(out).join(', '));
