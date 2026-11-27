// React parts of the shell (port of App.mount, C.header, C.tabbar, toasts, sheet and live region in components.js).
// Markup and class names match the prototype, so tokens.css and components.css style them unchanged.
import { createElement, forwardRef, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { t } from '../i18n';
import { F, reduceMotion } from '../lib/fmt';
import { datelineInner, icon, skel } from './h';
import { dropToast, sheet, useUi } from '../state/ui';
import { useMe, useToday, useWallet } from '../api';
import { useOffline } from '../state/app';
import { useOutbox } from '../chain/outbox/runner';

/* ---------- raw HTML from the string builders ---------- */
type HtmlProps = { as?: string; html: string; className?: string; id?: string; style?: CSSProperties; [k: string]: unknown };
export const Html = forwardRef<HTMLElement, HtmlProps>(function Html({ as = 'div', html, ...rest }, ref) {
  return createElement(as as string, { ...(rest as Record<string, unknown>), ref, dangerouslySetInnerHTML: { __html: html as string } });
});
export const Icon = ({ name, size = 20, cls }: { name: string; size?: number; cls?: string }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={cls} dangerouslySetInnerHTML={{ __html: icon(name, size).replace(/^<svg[^>]*>|<\/svg>$/g, '') }} />
);

/* ---------- buttons and controls ---------- */
export interface BtnProps {
  kind?: 'primary' | 'ghost' | 'danger' | 'onband' | 'onink';
  block?: boolean; sm?: boolean; cls?: string; loading?: boolean; busy?: string | null;
  icon?: string; iconEnd?: string; id?: string; to?: string; href?: string; ext?: boolean; disabled?: boolean;
  onClick?: () => void; children?: ReactNode; attrs?: Record<string, string | boolean | undefined>;
}
export function Btn(p: BtnProps) {
  const cls = 'btn' + (p.kind ? ' btn-' + p.kind : '') + (p.block ? ' btn-block' : '') + (p.sm ? ' btn-sm' : '') + (p.cls ? ' ' + p.cls : '') + (p.busy ? ' is-busy' : '');
  const inner = p.busy ? (<><span className="spin" /><span>{p.busy}</span></>) : (
    <>{p.loading && <span className="spin" />}{p.icon && <Icon name={p.icon} size={18} />}<span>{p.children}</span>{p.iconEnd && <Icon name={p.iconEnd} size={18} />}</>
  );
  if (p.to && !p.disabled) return <Link className={cls} to={p.to} id={p.id} data-rr="" {...p.attrs}>{inner}</Link>;
  if (p.href && !p.disabled) return <a className={cls} href={p.href} id={p.id} target={p.ext ? '_blank' : undefined} rel={p.ext ? 'noopener' : undefined} {...p.attrs}>{inner}</a>;
  return <button type="button" className={cls + (p.loading ? ' is-loading' : '')} id={p.id} disabled={p.disabled || !!p.busy} onClick={p.onClick} {...p.attrs}>{inner}</button>;
}

export function Seg<V extends string>({ items, value, onChange, label, disabled, lang }: { items: { label: string; value: V }[]; value: V; onChange: (v: V) => void; label: string; disabled?: boolean; lang?: boolean }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {items.map((it) => (
        <button key={it.value} type="button" className="seg-btn" data-value={it.value} aria-pressed={it.value === value} disabled={disabled} lang={lang ? it.value : undefined} onClick={() => onChange(it.value)}>{it.label}</button>
      ))}
    </div>
  );
}

/** C.amount: label row, the field box with its unit and Max, and the message line */
export function AmountField(p: {
  id: string; label: string; unit: string; value: string; onChange: (v: string) => void; side?: string; msg?: ReactNode; msgHtml?: string; error?: boolean;
  disabled?: boolean; mode?: 'decimal' | 'numeric'; onMax?: () => void; max?: boolean;
}) {
  return (
    <div className="field">
      <div className="field-label"><label htmlFor={p.id}><b>{p.label}</b></label>{p.side !== undefined && <span dangerouslySetInnerHTML={{ __html: p.side }} />}</div>
      <div className={'field-box field-box--fig' + (p.error ? ' is-error' : '') + (p.disabled ? ' is-off' : '')}>
        <input id={p.id} name={p.id} type="text" inputMode={p.mode || 'decimal'} autoComplete="off" spellCheck={false} placeholder="0" value={p.value} disabled={p.disabled}
          aria-describedby={p.id + '-msg'} aria-invalid={p.error ? 'true' : 'false'} onChange={(e) => p.onChange(e.target.value)} />
        <span className="field-unit">{p.unit}</span>
        {p.max !== false && <button type="button" className="field-max" data-max={p.id} disabled={p.disabled} onClick={p.onMax}>{t('s.max')}</button>}
      </div>
      {p.msgHtml !== undefined
        ? <div className={'field-msg' + (p.error ? ' is-error' : '')} id={p.id + '-msg'} aria-live="polite" dangerouslySetInnerHTML={{ __html: p.msgHtml }} />
        : <div className={'field-msg' + (p.error ? ' is-error' : '')} id={p.id + '-msg'} aria-live="polite">{p.msg}</div>}
    </div>
  );
}

/* ---------- a figure that rolls to its new value (App.countTo); a new target retargets from where the figure is ---------- */
export function useRoll(target: number, fmt: (n: number) => string, dur = 260): string {
  const [shown, setShown] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    const from = cur.current;
    if (from === target) return;
    if (reduceMotion()) { cur.current = target; setShown(target); return; }
    const t0 = performance.now(); let raf = 0;
    const step = (now: number) => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4); cur.current = from + (target - from) * e; setShown(cur.current); if (k < 1) raf = requestAnimationFrame(step); else cur.current = target; };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return fmt(shown);
}

/* ---------- count up (App.countTo) ---------- */
export function useCountUp(target: number, fmt: (n: number) => string = F.pts): [string, boolean] {
  const [shown, setShown] = useState(target);
  const [pulse, setPulse] = useState(false);
  const prev = useRef(target);
  useEffect(() => {
    const from = prev.current; prev.current = target;
    if (from === target) return;
    if (reduceMotion()) { setShown(target); return; }
    setPulse(true); setTimeout(() => setPulse(false), 220);
    const t0 = performance.now(); let raf = 0;
    const step = (now: number) => { const k = Math.min(1, (now - t0) / 400), e = 1 - Math.pow(1 - k, 3); setShown(from + (target - from) * e); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return [fmt(shown), pulse];
}

/* ---------- masthead ---------- */
export type PtsState = '' | 'loading' | 'pending' | 'hits' | 'stale';
/** the masthead: the nameplate (or, on a sub page, the back arrow and the page title), the points as a boxed figure,
    the profile. A thick and thin rule closes it. The nameplate's words give way first when the row is too narrow. */
export function Header({ back, title, pts = '', points, me }: { back?: string; title?: string; pts?: PtsState; points?: number; me?: boolean }) {
  const nav = useNavigate();
  const loc = useLocation();
  const w = useWallet();
  const meQ = useMe();
  const loading = pts === 'loading' || (points === undefined && !w.data);
  const value = points ?? w.data?.points ?? 0;
  const [txt, pulse] = useCountUp(value);
  const hit = w.data?.pendingHit;
  const name = meQ.data?.name || meQ.data?.wallet || '';
  const label = loading ? t('hd.points.loading') : t('hd.points', { p: F.int(value) }) + (pts === 'pending' ? ' ' + t('hd.points.pending') : pts === 'hits' && hit ? ' ' + t('hd.points.hits', { n: hit.points, time: F.time(hit.landsAt) }) : pts === 'stale' ? ' ' + t('hd.points.stale') : '');
  const homeHref = homePath();
  const plateRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const pl = plateRef.current; if (!pl) return;
    const fit = () => { pl.classList.remove('is-mark'); const sp = pl.querySelector('span'); if (sp && sp.scrollWidth > sp.clientWidth + 1) pl.classList.add('is-mark'); };
    fit();
    window.addEventListener('resize', fit);
    void document.fonts?.ready.then(fit);
    return () => window.removeEventListener('resize', fit);
  }, [back]);
  const onBack = (e: React.MouseEvent) => {
    // back to where the player came from when that was inside the app, else to the fixed parent
    if (window.history.length > 1 && (loc.key !== 'default') && !/[?&]state=/.test(loc.search)) { e.preventDefault(); nav(-1); }
  };
  return (
    <header className={'mast' + (back ? ' mast--sub' : '')}>
      <div className="mast-in">
        {back ? (
          <><Link className="mast-back" to={back} aria-label={t('hd.back')} onClick={onBack} data-rr=""><Icon name="back" size={22} /></Link><h1 className="mast-title">{title}</h1></>
        ) : (
          <Link className="mast-home" to={homeHref} aria-label={t('hd.home')} data-rr="">
            <span className="plate" translate="no" ref={plateRef}><img src="/assets/cojam-mark.svg" alt="" width={28} height={28} /><span>Cojam Daily</span></span>
          </Link>
        )}
        <div className="mast-end">
          <Link className={'pts' + (pulse ? ' is-pulse' : '')} id="pts" to="/wallet" aria-label={label} data-rr="">
            <span className="pts-in">
              {loading ? <span dangerouslySetInnerHTML={{ __html: skel('44px', '12px') }} style={{ display: 'contents' }} /> : (
                <>{pts === 'pending' && <span className="spin" />}<span id="pts-val">{txt}</span>{pts === 'hits' && hit && <span className="pts-tag">+{hit.points}</span>}{pts === 'stale' && <span className="pts-dot" />}</>
              )}
            </span>
          </Link>
          <Link className="me" to="/profile" aria-label={t('hd.profile')} aria-current={me ? 'page' : undefined} data-rr=""><span className="me-in" aria-hidden="true">{name.charAt(0).toUpperCase()}</span></Link>
        </div>
      </div>
      <div className="oxford" aria-hidden="true" />
    </header>
  );
}
export function homePath() { let v = 'card'; try { v = localStorage.getItem('cjp.view') || 'card'; } catch { /* */ } return v === 'term' ? '/list' : '/'; }

/* ---------- tab bar: the section index ---------- */
const TABS = [
  { id: 'home', icon: 'cards', href: homePath },
  { id: 'results', icon: 'list', href: () => '/results' },
  { id: 'rank', icon: 'podium', href: () => '/ranking' },
  { id: 'stake', icon: 'lock', href: () => '/stakes' },
  { id: 'wallet', icon: 'wallet', href: () => '/wallet' },
];
const TAB_ORDER: Record<string, number> = { home: 0, results: 1, rank: 2, stake: 3, wallet: 4 };
export type Badges = Partial<Record<'home' | 'results' | 'stake', 'dot' | number | 0>>;
export const SEEN_KEY = 'cjp.seen';
export function useBadges(over?: Badges): Badges {
  const today = useToday();
  const me = useMe();
  const items = useOutbox((s) => s.items);
  const answered = today.data ? today.data.markets.filter((m) => m.choice.chain || items.some((i) => i.marketId === m.marketId && i.state !== 'failed')).length : 5;
  let seen = false; try { seen = sessionStorage.getItem(SEEN_KEY) === '1'; } catch { /* */ }
  const b: Badges = { home: today.data && today.data.state === 'open' && answered < 5 && !me.data?.frozen ? 'dot' : 0, results: seen ? 0 : me.data?.stats.newAnswers || 0 };
  // the badges follow the session: no "predictions left" once the five are picked, no "new answers" once Results was opened
  const out = { ...b, ...over };
  if (answered >= 5) out.home = 0;
  if (seen) out.results = 0;
  return out;
}
export function TabBar({ current, badges }: { current?: string; badges: Badges }) {
  return (
    <nav className="tb" aria-label={t('nav.tabs')}>
      {TABS.map((tb) => {
        const b = tb.id === 'results' && current === 'results' ? 0 : badges[tb.id as keyof Badges];
        const said = b === 'dot' ? t('tab.badge.' + tb.id) : typeof b === 'number' && b > 0 ? t('tab.badge.results', { n: b }) : '';
        return (
          <Link key={tb.id} to={tb.href()} aria-current={tb.id === current ? 'page' : undefined} data-rr="">
            <span className="tb-ic">
              <Icon name={tb.id === current ? tb.icon + 'On' : tb.icon} size={22} />
              {b === 'dot' && <span className="tb-dot" />}
              {typeof b === 'number' && b > 0 && <span className="tb-n" aria-hidden="true">{b > 9 ? '9+' : b}</span>}
            </span>
            <span>{t('tab.' + tb.id)}</span>
            {said && <span className="sr-only">, {said}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function OffBar() {
  const [since] = useState(() => Date.now() - 23 * 60000);
  return <div className="offbar" role="status"><Icon name="offline" size={16} /><div>{t('off.bar')}<small>{t('off.last', { time: F.date(since, true) })}</small></div></div>;
}

/** the dateline: date, issue and one live fact of the screen */
export const Dateline = ({ live, cls }: { live?: string; cls?: string }) => <div className={'dateline' + (cls ? ' ' + cls : '')} dangerouslySetInnerHTML={{ __html: datelineInner(live) }} />;

/* ---------- the screen shell (App.mount) ---------- */
export interface ShellProps {
  tab?: string; back?: string; title?: string; docTitle?: string; head?: ReactNode; pin?: ReactNode; bare?: boolean; offline?: boolean;
  /** the dateline's live cell (HTML); the dateline shows on every tab root (not on sub pages, bare or raw screens) */
  live?: string; noDateline?: boolean;
  pts?: PtsState; points?: number; me?: boolean; badges?: Badges; cls?: string; raw?: ReactNode; children?: ReactNode;
}
export function Shell(p: ShellProps) {
  const off = useOffline();
  const offline = p.offline ?? off;
  const badges = useBadges(p.badges);
  const appRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const loc = useLocation();
  useEffect(() => { document.title = (p.docTitle || p.title || 'Cojam') + ' | Cojam Daily'; }, [p.docTitle, p.title]);
  useEffect(() => { useUi.setState({ bare: !!p.bare }); }, [p.bare]);
  useEffect(() => { if (p.tab === 'results') { try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* */ } } }, [p.tab]);
  /* a section change is a quick page turn (under 200 ms, on the content only, never on the chrome): a tab further right comes
     from the right, a sub page comes from the right, going back comes from the left; the same section again only settles */
  useLayoutEffect(() => {
    const now = { i: p.tab && TAB_ORDER[p.tab] !== undefined && !p.back ? TAB_ORDER[p.tab] : 5, sub: !!p.back || !!p.bare };
    let was: { i: number; sub: boolean } | null = null;
    try { was = JSON.parse(sessionStorage.getItem('cjp.nav') || 'null'); sessionStorage.setItem('cjp.nav', JSON.stringify(now)); } catch { /* */ }
    const dir = !was ? 'same' : now.sub && !was.sub ? 'fwd' : !now.sub && was.sub ? 'back' : now.i > was.i ? 'fwd' : now.i < was.i ? 'back' : 'same';
    if (mainRef.current && !reduceMotion()) mainRef.current.setAttribute('data-in', dir);
  }, [loc.pathname]); // eslint-disable-line
  // the page's bottom padding equals the height of the pinned bar; a bar taller than a quarter of the view unpins (App.pinFit)
  useLayoutEffect(() => {
    const app = appRef.current; if (!app || !p.pin) return;
    const fit = () => {
      const pin = app.querySelector(':scope > .pin') as HTMLElement | null; if (!pin) { app.style.setProperty('--pin-h', '0px'); return; }
      pin.classList.remove('is-flow'); const big = pin.offsetHeight > innerHeight * 0.25; pin.classList.toggle('is-flow', big);
      app.style.setProperty('--pin-h', (big ? 0 : pin.offsetHeight) + 'px');
    };
    fit();
    const pin = app.querySelector(':scope > .pin');
    const ro = new ResizeObserver(fit); if (pin) ro.observe(pin);
    window.addEventListener('resize', fit);
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  });
  const showDateline = !p.back && !p.bare && !p.raw && !p.noDateline;
  return (
    <>
      <a className="skip" href="#main" data-rr="">{t('nav.skip')}</a>
      <div ref={appRef} className={'app' + (p.pin ? ' app--pin' : '') + (p.bare ? ' app--bare' : '') + (p.cls ? ' ' + p.cls : '')}>
        {!p.bare && <Header back={p.back} title={p.title} pts={p.pts} points={p.points} me={p.me} />}
        {offline && !p.bare && <OffBar />}
        <main id="main" tabIndex={-1} ref={mainRef}>
          {p.raw ?? (<>{showDateline && <Dateline live={p.live} />}{p.head && <section className="ph">{p.head}</section>}<div className="pg">{p.children}</div></>)}
        </main>
        {p.pin}
        {!p.bare && <TabBar current={p.tab} badges={badges} />}
      </div>
    </>
  );
}

/* ---------- toasts, sheet, live region (rendered once, beside .app) ---------- */
export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  const bare = useUi((s) => s.bare);
  const cur = toasts[0];
  const [out, setOut] = useState(false);
  useEffect(() => {
    if (!cur) return;
    setOut(false);
    const tm = setTimeout(() => setOut(true), cur.o.ms || (cur.o.btn ? 60_000 : 4000));
    return () => clearTimeout(tm);
  }, [cur?.id]);
  useEffect(() => { if (!out || !cur) return; const tm = setTimeout(() => dropToast(cur.id), 200); return () => clearTimeout(tm); }, [out, cur?.id]);
  return (
    <div className={'toasts' + (bare ? ' is-bare' : '')} id="toasts" role="status" aria-live="polite">
      {cur && (
        <div className={'toast' + (out ? ' is-out' : '')} key={cur.id}>
          <span dangerouslySetInnerHTML={{ __html: cur.msg }} />
          {cur.o.btn && <button type="button" onClick={() => { cur.o.fn?.(); setOut(true); }}>{cur.o.btn}</button>}
        </div>
      )}
    </div>
  );
}
export function LiveRegion() { const msg = useUi((s) => s.live); return <div className="sr-only" id="live" aria-live="polite">{msg}</div>; }

export function SheetRoot() {
  const s = useUi((x) => x.sheet);
  const [shown, setShown] = useState<typeof s>(null);
  const ref = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<Element | null>(null);
  useEffect(() => {
    const app = document.querySelector('.app');
    if (s) {
      if (!shown) { lastFocus.current = document.activeElement; setTimeout(() => ref.current?.focus(), 50); }
      setShown(s); app?.setAttribute('inert', '');
      if (ref.current) ref.current.style.transform = '';
    } else {
      app?.removeAttribute('inert');
      if (shown) { (lastFocus.current as HTMLElement | null)?.focus?.(); const tm = setTimeout(() => setShown(null), 260); return () => clearTimeout(tm); }
    }
  }, [s]);
  useLayoutEffect(() => {
    const h = ref.current?.querySelector('h2');
    if (h) { h.id = 'sheet-h'; ref.current!.setAttribute('aria-labelledby', 'sheet-h'); } else ref.current?.removeAttribute('aria-labelledby');
  });
  const c = (s || shown)?.content;
  return (
    <div className={'sheet-root' + (s ? ' is-open' : '')} id="sheet-root">
      <div className="sheet-scrim" data-sheet-scrim="" onClick={() => { if (sheet.closable()) sheet.close(); }} />
      <div className="sheet" id="sheet" role="dialog" aria-modal="true" tabIndex={-1} ref={ref} aria-label={(s || shown)?.o.label}>
        <div className="sheet-grip" data-grip="" aria-hidden="true" />
        {typeof c === 'string' ? <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: c }} /> : c}
      </div>
    </div>
  );
}

/* ---------- countdown and ticker as React (for parts React owns) ---------- */
export function useNow(every = 1000) {
  const [n, setN] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setN(Date.now()), every); return () => clearInterval(i); }, [every]);
  return n;
}
