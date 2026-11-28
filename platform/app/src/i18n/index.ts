// i18next seeded from the design copy (scripts/gen-i18n.mjs). English for everyone by default; Korean (and Japanese once enabled in ./langs)
// only by the player's choice, remembered on the device (and in users.language). The device language is never read.
import i18next from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import en from './en.json';
import ko from './ko.json';
import ja from './ja.json';

import { ENABLED_LANGS, isEnabledLang, resolveLang, type Lang } from './langs';
export type { Lang } from './langs';
export { ALL_LANGS, ENABLED_LANGS, ENABLED_LANG_NAMES, LANG_NAMES, isEnabledLang, resolveLang } from './langs';
/** the languages every control lists: only the enabled ones (see ENABLED_LANGS in ./langs) */
export const LANGS: Lang[] = ENABLED_LANGS;
const KEY = 'cjp.lang';

function initialLang(): Lang {
  const q = new URLSearchParams(location.search).get('lang');
  let saved: string | null = null;
  try { saved = localStorage.getItem(KEY); } catch { /* storage off */ }
  const l = resolveLang(q, saved);
  // remember a request only when it was honoured (?lang=ja while hidden is not saved)
  if (q && q === l) { try { localStorage.setItem(KEY, l); } catch { /* */ } }
  return l;
}

/* the display faces of Korean and Japanese are self hosted sheets that load only when that language is shown */
const FONT_SHEETS: Partial<Record<Lang, () => Promise<unknown>>> = {
  ko: () => import('../styles/fonts/ko.css'),
  ja: () => import('../styles/fonts/ja.css'),
};
function loadFonts(l: Lang) { FONT_SHEETS[l]?.().catch(() => { /* offline before first use: the fallback faces stand in */ }); }

const lang = initialLang();
document.documentElement.lang = lang;
loadFonts(lang);

void i18next.use(initReactI18next).init({
  resources: { en: { t: en }, ko: { t: ko }, ja: { t: ja } },
  lng: lang,
  fallbackLng: 'en',
  ns: ['t'],
  defaultNS: 't',
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false, prefix: '{', suffix: '}' },
  returnNull: false,
  parseMissingKeyHandler: (k: string) => '[' + k + ']',
  react: { useSuspense: false },
});

export function setLang(l: Lang) {
  if (!isEnabledLang(l)) return;
  try { localStorage.setItem(KEY, l); } catch { /* */ }
  document.documentElement.lang = l;
  loadFonts(l);
  void i18next.changeLanguage(l);
}
export function currentLang(): Lang { return (i18next.language as Lang) || 'en'; }

export type Vars = Record<string, string | number>;
/** t(key, vars): vars are inserted as given (HTML allowed: escape user data with esc()). Missing keys read "[key]". */
export function t(key: string, vars?: Vars): string {
  // i18next leaves unknown {x} placeholders untouched, as the design's t() does
  return i18next.t(key, vars as never) as unknown as string;
}
export function useLang(): { lang: Lang; t: typeof t } {
  const { i18n } = useTranslation();
  return { lang: (i18n.language as Lang) || 'en', t };
}
export default i18next;
