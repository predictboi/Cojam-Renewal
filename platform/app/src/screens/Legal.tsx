// The Terms of Use and the Privacy Policy (/terms, /privacy): plain pages in the paper's cover style, reachable from the
// login sentence and from Profile, Help. Both are drafts marked as such until the founder's lawyer has reviewed them.
import { useLayoutEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { t, useLang } from '../i18n';
import { esc, F } from '../lib/fmt';
import { icon, plate, SUPPORT_MAIL } from '../ui/h';
import { Html, Shell, usePlateFit } from '../ui/kit';

const SECTIONS = { terms: 7, privacy: 5 } as const;
/** the date of the draft (shown on the page; change it with the text) */
const UPDATED = Date.UTC(2026, 10, 28, 3);

export default function Legal({ kind }: { kind: 'terms' | 'privacy' }) {
  useLang();
  const nav = useNavigate();
  const mail = '<a href="mailto:' + SUPPORT_MAIL + '" translate="no">' + SUPPORT_MAIL + '</a>';
  const body = Array.from({ length: SECTIONS[kind] }, (_, i) => '<section><h2>' + t(kind + '.' + (i + 1) + '.h') + '</h2><p>' + t(kind + '.' + (i + 1) + '.b', { mail }) + '</p></section>').join('');
  const other = kind === 'terms' ? ['/privacy', 'a.privacy'] : ['/terms', 'a.terms'];
  const raw = '<div class="auth"><header class="gate-bar"><a class="mast-back" href="/login" aria-label="' + esc(t('hd.back')) + '" data-back>' + icon('back', 22) + '</a>' +
    '<span class="mast-home">' + plate() + '</span></header><div class="oxford" aria-hidden="true"></div>' +
    '<article class="legal" id="legal"><p class="legal-draft" role="note">' + icon('info', 16) + '<span>' + t('legal.draft') + '</span></p>' +
    '<h1>' + t(kind + '.h') + '</h1><p class="legal-date">' + t('legal.updated', { date: F.dateLong(UPDATED) }) + '</p>' + body +
    '<p class="legal-other"><a class="linkish" href="' + other[0] + '">' + t(other[1]) + icon('chev', 16) + '</a></p></article></div>';
  const plateRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => { plateRef.current = document.querySelector('#legal')?.closest('.auth')?.querySelector('.gate-bar .plate') as HTMLElement | null; });
  usePlateFit(plateRef, undefined, [kind]);
  // Back returns to where the reader came from (log in or Profile); a direct visit goes to log in
  const onClick = (e: React.MouseEvent) => {
    if ((e.target as Element).closest('[data-back]') && (window.history.state?.idx ?? 0) > 0) { e.preventDefault(); nav(-1); }
  };
  return <Shell bare docTitle={t(kind + '.h')} raw={<Html as="div" style={{ display: 'contents' }} html={raw} onClick={onClick} />} />;
}
