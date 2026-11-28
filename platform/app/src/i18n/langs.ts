// Which languages players can see. Japanese is fully kept in the code (strings, fonts, :lang(ja) styles) but hidden
// until it is ready: adding 'ja' to ENABLED_LANGS brings it back everywhere (gate, login, first run, profile).
// No side effects here, so the rules can be unit tested.
export type Lang = 'en' | 'ko' | 'ja';
export const ALL_LANGS: Lang[] = ['en', 'ko', 'ja'];
export const ENABLED_LANGS: Lang[] = ['en', 'ko'];
export const LANG_NAMES: Record<Lang, string> = { en: 'English', ko: '한국어', ja: '日本語' };

export function isEnabledLang(l: unknown): l is Lang { return typeof l === 'string' && (ENABLED_LANGS as string[]).includes(l); }

/** The language to show: the ?lang= request, else the saved choice, else English. A disabled or unknown language
 *  (for example ja while hidden) falls back to English. The device language is never read. */
export function resolveLang(query: string | null, saved: string | null): Lang {
  const l = query || saved || 'en';
  return isEnabledLang(l) ? l : 'en';
}

/** names of the enabled languages only, in order, for every language control */
export const ENABLED_LANG_NAMES: Record<string, string> = Object.fromEntries(ENABLED_LANGS.map((l) => [l, LANG_NAMES[l]]));
