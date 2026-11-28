import { describe, expect, it } from 'vitest';
import { ENABLED_LANGS, ENABLED_LANG_NAMES, resolveLang } from '../src/i18n/langs';

describe('language flag', () => {
  it('a hidden language (ja by ?lang= or a saved choice) falls back to English; en stays default, ko by choice', () => {
    expect(ENABLED_LANGS).not.toContain('ja');
    expect(Object.keys(ENABLED_LANG_NAMES)).toEqual(ENABLED_LANGS);
    expect(resolveLang('ja', null)).toBe('en');
    expect(resolveLang(null, 'ja')).toBe('en');
    expect(resolveLang('ja', 'ko')).toBe('en');
    expect(resolveLang(null, null)).toBe('en');
    expect(resolveLang('ko', null)).toBe('ko');
    expect(resolveLang(null, 'ko')).toBe('ko');
  });
});
