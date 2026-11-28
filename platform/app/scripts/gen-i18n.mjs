// Seeds the app's locale JSON from the approved design copy (platform/design/assets/i18n.js) plus the paper labels,
// then the app's own strings (scripts/app-i18n.mjs).
// Each entry there is [en, ko, ja]; placeholders are {name}. Run: npm run i18n
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
const src = readFileSync(new URL('../../design/assets/i18n.js', import.meta.url), 'utf8');
const store = {};
const sandbox = {
  window: {},
  location: { search: '', href: 'http://x/' },
  document: { documentElement: {} },
  localStorage: { getItem: () => null, setItem: (k, v) => (store[k] = v) },
  URLSearchParams,
  URL,
};
vm.runInNewContext(src, sandbox);
// the labels of the "Daily Paper" look (pp.*), written in EN, KO and JA in platform/design-variants/paper/assets/paper-i18n.js
vm.runInNewContext(readFileSync(new URL('../../design-variants/paper/assets/paper-i18n.js', import.meta.url), 'utf8'), sandbox);
const dict = sandbox.window.CJ_I18N.dict;
// strings of the app only (new keys and reviewed wording), merged last; a null Japanese entry keeps the existing Japanese, or reuses the English for a new key
const { S: APP } = await import('./app-i18n.mjs');
for (const [k, v] of Object.entries(APP)) { dict.en[k] = v[0]; dict.ko[k] = v[1]; dict.ja[k] = v[2] ?? (k in dict.ja ? dict.ja[k] : v[0]); }
for (const l of ['en', 'ko', 'ja']) {
  const sorted = Object.fromEntries(Object.entries(dict[l]));
  writeFileSync(new URL(`../src/i18n/${l}.json`, import.meta.url), JSON.stringify(sorted, null, 1) + '\n');
  console.log(l, Object.keys(sorted).length, 'keys');
}
