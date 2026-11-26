// P1 Profile and settings (platform/design/profile.html): identity, account, display name, language and view, help,
// log out. The invite code can be added once, within 24 hours of sign up (DECISIONS "Invite code entry").
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, useConfig, useInvite, useMe, useWallet } from '../api';
import { ApiError } from '../api/errors';
import { LANGS, LANG_NAMES, setLang, t, useLang, type Lang } from '../i18n';
import { esc, F } from '../lib/fmt';
import { addr, btn, icon, tag } from '../ui/h';
import { Html, Seg, Shell } from '../ui/kit';
import { useHold, useOffline, usePreset } from '../state/app';
import { sheet, toast } from '../state/ui';
import { loadPlayKey } from '../chain/playKey';
import { revokePlayKey } from '../chain/chain';
import { outbox, hasOutbox } from '../chain/outbox/runner';
import { walletApi } from '../wallet/wallet';
import { CONFIG } from '../config';
import { DESIGN } from '../api/mock';

function validate(v: string): string {
  if (v === '') return '';
  if (/\*|fuck|shit/i.test(v)) return 'p.name.e.word';
  if (v.length < 2 || v.length > 20 || v !== v.trim()) return 'p.name.e.len';
  if (!/^[\p{L}\p{N} _.]+$/u.test(v)) return 'p.name.e.chars';
  if (/^0x[0-9a-f]+$/i.test(v) || /cojam|admin/i.test(v)) return 'p.name.e.staff';
  return '';
}
const linkRow = (label: string, href: string, ext?: boolean) => '<a class="rowlink" href="' + href + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '><span>' + label + '</span>' + icon(ext ? 'ext' : 'chev', 18) + '</a>';

/** the invite code sheet: Apply checks the code; only a code that passed shows "Link this code", and linking is final */
export function CodeSheet({ preset, own, onLinked }: { preset?: string; own: string; onLinked: (name: string) => void }) {
  const offline = useOffline() || usePreset() === 'code-offline';
  const [val, setVal] = useState(preset || '');
  const [state, setState] = useState<{ kind: '' | 'checking' | 'ok' | 'error'; key?: string; name?: string }>({ kind: '' });
  const [linking, setLinking] = useState(false);
  const norm = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const check = async (now?: boolean) => {
    const v = norm(val); setVal(v); if (!v || state.kind === 'checking') return;
    if (offline) return setState({ kind: 'error', key: 'o.code.offline' });
    if (v.length < 6) return setState({ kind: 'error', key: 'o.code.short' });
    if (v === own) return setState({ kind: 'error', key: 'o.code.own' });
    if (!now) setState({ kind: 'checking' });
    try {
      const r = await api.inviteLookup(v);
      setState(r.valid ? { kind: 'ok', name: r.inviterName } : { kind: 'error', key: 'o.code.unknown' });
    } catch { setState({ kind: 'error', key: 'o.code.offline' }); }
  };
  useEffect(() => { if (preset) void check(true); }, []);
  const link = async () => {
    if (state.kind !== 'ok' || linking) return;
    setLinking(true);
    try { const r = await api.inviteRedeem(norm(val)); sheet.close(); onLinked(r.inviterName); }
    catch (e) {
      const c = (e as ApiError).code;
      setState({ kind: 'error', key: c === 'INVITE_OWN' ? 'o.code.own' : c === 'INVITE_UNKNOWN' ? 'o.code.unknown' : c === 'INVITE_SHORT' ? 'o.code.short' : c === 'NETWORK' ? 'o.code.offline' : 'o.code.unknown' });
    } finally { setLinking(false); }
  };
  const ok = state.kind === 'ok';
  const msg = state.kind === 'checking' ? '<span class="spin"></span><span>' + t('o.code.checking') + '</span>'
    : state.kind === 'error' ? icon('warn', 16) + '<span>' + t(state.key!) + '</span>'
      : ok ? icon('check', 16) + '<span>' + t('p.code.ok', { name: '<b translate="no">' + esc(state.name || '') + '</b>' }) + '</span>' : '';
  return (
    <>
      <h2>{t('p.code.h')}</h2>
      <p className="sheet-lead">{t('p.code.lead')}</p>
      <div className="onb-code">
        <div className={'field-box field-box--text' + (ok ? ' is-ok' : '') + (state.kind === 'error' ? ' is-error' : '')}>
          <input id="code" name="invite-code" type="text" inputMode="text" autoComplete="off" autoCapitalize="characters" autoCorrect="off" spellCheck={false} enterKeyHint="done" maxLength={8}
            placeholder={t('o.code.ph')} value={val} readOnly={ok} aria-label={t('p.code.label')} aria-describedby="code-msg" aria-invalid={state.kind === 'error' ? 'true' : undefined}
            onChange={(e) => { setVal(norm(e.target.value)); setState({ kind: '' }); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void check(); } }} />
          <button type="button" className="field-max" id="code-apply" disabled={!val || state.kind === 'checking'} onClick={() => { if (ok) { setState({ kind: '' }); } else void check(); }}>{ok ? t('o.code.change') : t('o.code.apply')}</button>
        </div>
        <div className={'onb-code-msg' + (state.kind && state.kind !== 'checking' ? ' is-' + state.kind : '')} id="code-msg" aria-live="polite" dangerouslySetInnerHTML={{ __html: msg }} />
      </div>
      <div className="sheet-acts">
        <button type="button" className="btn btn-primary btn-block" id="code-link" hidden={!ok} onClick={link}>{linking && <span className="spin" />}<span>{t('p.code.link')}</span></button>
        <button type="button" className="btn btn-ghost btn-block" data-sheet-close=""><span>{t('common.cancel')}</span></button>
      </div>
    </>
  );
}

export default function Profile() {
  const st = usePreset();
  const nav = useNavigate();
  const qc = useQueryClient();
  const me = useMe();
  const w = useWallet();
  const inv = useInvite();
  const cfg = useConfig();
  const held = useHold() || st === 'hold';
  const { lang } = useLang();
  const d = me.data;
  const [name, setName] = useState(st === 'nameerror' ? 'cojam_admin' : st === 'nameword' ? 'f**k' : '');
  const [savedName, setSavedName] = useState<string | null>(null);
  const [linked, setLinked] = useState<string | null>(null);
  const [view, setView] = useState<'card' | 'term'>(() => { try { return (localStorage.getItem('cjp.view') as 'term') || 'card'; } catch { return 'card'; } });
  const [device, setDevice] = useState<{ until?: number; state: 'ready' | 'notset' | 'other' } | null>(null);
  const init = useRef(false);
  useEffect(() => { if (d && !init.current) { init.current = true; if (!name) setName(d.name || ''); } }, [d]);
  useEffect(() => {
    if (st === 'notset') return setDevice({ state: 'notset' });
    if (st === 'otherdevice') return setDevice({ state: 'other' });
    void loadPlayKey().then((k) => setDevice(k?.expiresAt ? { state: 'ready', until: k.expiresAt * 1000 } : CONFIG.mockApi ? { state: 'ready', until: Date.now() + 30 * 86400000 } : { state: 'notset' }));
  }, [st]);

  const current = savedName ?? d?.name ?? '';
  const err = validate(name);
  const canSave = !err && name !== current;
  const save = async () => {
    if (!canSave) return;
    await api.patchMe({ name });
    setSavedName(name); toast(t('p.name.saved'));
    void qc.invalidateQueries({ queryKey: ['me'] });
  };
  const ownCode = inv.data?.code || DESIGN.invite.code;
  const codePreset: Record<string, string> = { 'code-valid': 'DALGONA4', 'code-unknown': 'KAIA999', 'code-own': ownCode, 'code-offline': 'DALGONA4' };
  const signedUp = d ? Date.parse(d.signedUpAt) : 0;
  const within = !!d && !d.referrer && Date.now() - signedUp < 24 * 3600000;
  const inviter = linked || (st === 'code-linked' ? 'dalgona' : d?.referrer?.name || null);
  const codeState: '' | 'open' | 'linked' = inviter && (linked || st === 'code-linked' || within) ? 'linked' : within ? 'open' : '';
  const openCode = (preset?: string) => sheet.open(<CodeSheet preset={preset} own={ownCode} onLinked={(n) => { setLinked(n); toast(t('p.code.done', { name: n })); void qc.invalidateQueries({ queryKey: ['me'] }); }} />);
  useEffect(() => {
    if (!d) return;
    if (codeState === 'open' && /^code-/.test(st) && st !== 'code-open') openCode(codePreset[st]);
    if (st === 'logout') logout();
    if (st === 'saved') toast(t('p.name.saved'));
    if (st === 'update') toast(t('toast.update'), { btn: t('toast.reload'), fn: () => location.reload() });
    if (st === 'session') sheet.open('<div class="sheet-state"><div class="sheet-ic">' + icon('lock', 30) + '</div><h2>' + t('p.session.h') + '</h2><p class="sheet-lead">' + t('p.session.b') + '</p></div><div class="sheet-acts">' + btn(t('p.session.btn'), { kind: 'primary', block: true, href: '/login' }) + '</div>', { closable: false });
  }, [!!d, st]);

  async function doLogout() {
    sheet.close(true);
    // held picks are sent before the key is revoked (4.3.1), then the key revokes itself (4.2)
    try { if (hasOutbox()) await outbox().flush(); await revokePlayKey(); } catch { /* */ }
    try { await walletApi().logout(); } catch { /* */ }
    qc.clear();
    nav('/login');
  }
  function logout() {
    sheet.open(<><h2>{t('p.logout.h')}</h2><p className="sheet-lead">{t('p.logout.b')}</p><div className="sheet-acts"><button type="button" className="btn btn-block" onClick={doLogout}><span>{t('p.logout')}</span></button><button type="button" className="btn btn-ghost btn-block" data-sheet-close=""><span>{t('common.cancel')}</span></button></div></>);
  }

  const a = d?.wallet || w.data?.address || '';
  const nm = current || (a ? F.short(a) : '');
  const rank = d?.stats.weekRank ?? null;
  const ident = '<section class="sec pid" aria-label="' + esc(t('p.title')) + '"><p class="pid-name" id="pid-name" translate="no">' + esc(nm) + '</p><div class="stats">' +
    '<div class="stat"><b>' + (rank && !held ? rank : '&ndash;') + '</b><span>' + (rank ? t('p.rank') : t('p.norank')) + '</span></div>' +
    '<div class="stat"><b>' + F.pts(d?.stats.weekPoints || 0) + '</b><span>' + t('r.week') + '</span></div>' +
    '<div class="stat"><b>' + F.pts(w.data?.points ?? d?.stats.points ?? 0) + '</b><span>' + t('p.pts') + '</span></div></div>' +
    '<a class="inv-row" id="to-invite" href="/invite"><span class="inv-row-t"><b>' + t('inv.entry') + '</b><small>' + t('inv.entry.sub', { r: inv.data ? inv.data.referralBps / 100 : 10 }) + '</small></span><span class="inv-row-go"><span class="sr-only">' + t('inv.entry.n', { n: inv.data?.stats.joined ?? 0 }) + '</span><span aria-hidden="true">' + (inv.data?.stats.joined ?? 0) + '</span>' + icon('chev', 16) + '</span></a></section>';
  const hLeft = Math.ceil(24 - (Date.now() - signedUp) / 3600000);
  const codeRow = codeState === 'linked'
    ? '<div class="prow" id="code-row">' + icon('check', 20) + '<p class="grow"><b>' + t('p.code.by', { name: '<span translate="no">' + esc(inviter || '') + '</span>' }) + '</b><br><span class="tiny muted">' + t('p.code.fixed') + '</span></p></div>'
    : codeState === 'open' ? '<button type="button" class="rowlink" id="code-row"><span><b>' + t('p.code') + '</b><small>' + (hLeft > 1 ? t('p.code.left', { h: hLeft }) : t('p.code.left.last')) + '</small></span>' + icon('chev', 18) + '</button>' : '';
  const dev = device?.state === 'notset' ? '<div class="row">' + icon('phone', 20) + '<p class="grow">' + t('p.device.notset') + '</p></div>' + btn(t('p.device.setup'), { block: true, href: '/login?setup=1' })
    : device?.state === 'other' ? '<div class="row">' + icon('phone', 20) + '<p class="grow">' + t('p.device.other') + '</p></div>' + btn(t('h.other.btn'), { block: true, href: '/login?setup=1' })
      : '<div class="row">' + icon('check', 20) + '<p class="grow"><b>' + t('p.device.ready') + '</b><br><span class="tiny muted">' + t('p.device.until', { date: F.dateLong(device?.until || Date.now() + 30 * 86400000) }) + '</span></p></div>';
  const explorer = cfg.data?.explorer || CONFIG.chain.explorer;
  const account = '<h2 class="sect-h">' + t('p.account') + '</h2><div class="list">' +
    (held ? '<a class="rowlink" id="hold-row" href="/system/blocked"><span><b>' + t('hold.t') + '</b><small>' + t('hold.profile.sub') + '</small></span>' + tag(t('hold.tag'), '', 'pause') + icon('chev', 18) + '</a>' : '') +
    '<div class="prow">' + icon('mail', 20) + '<p class="grow">' + t('p.login', { email: '<b translate="no">' + esc(d?.email || '') + '</b>' }) + '</p></div>' +
    '<div id="code-slot">' + codeRow + '</div>' +
    '<div class="prow-addr"><p class="lbl">' + t('w.addr') + '</p>' + (a ? addr(a) : '') + '</div>' +
    linkRow(t('w.scan'), explorer + '/address/' + a, true) +
    '<div class="stack-8 prow-dev">' + dev + '</div></div>';
  const helpSec = '<h2 class="sect-h">' + t('p.help') + '</h2><div class="list">' + linkRow(t('p.how'), '/welcome?from=profile') +
    '<details class="help help--row"><summary>' + t('p.answers.q') + icon('down', 18) + '</summary><div class="help-body">' + t('p.answers.a') + '</div></details>' +
    linkRow(t('p.swap'), CONFIG.swapUrl, true) + linkRow(t('p.site'), 'https://cojam.app', true) + '</div>';
  const onClick = (e: React.MouseEvent) => { if ((e.target as Element).closest('button#code-row')) openCode(); };
  const changeLang = (l: Lang) => { setLang(l); void api.patchMe({ language: l }).catch(() => {}); };
  return (
    <Shell me back="/wallet" title={t('p.title')}>
      <div style={{ display: 'contents' }} onClick={onClick}>
        <Html as="div" style={{ display: 'contents' }} html={ident} />
        <Html as="section" className="sec" html={account} />
        <section className="sec">
          <div className="field">
            <div className="field-label"><label htmlFor="name"><b>{t('p.name')}</b></label></div>
            <div className={'field-box field-box--text' + (err ? ' is-error' : '')}>
              <input id="name" name="nickname" type="text" autoComplete="nickname" spellCheck={false} maxLength={24} value={name} aria-describedby="name-msg" aria-invalid={err ? 'true' : 'false'}
                onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void save(); }} />
              <button type="button" className="field-max" id="save" disabled={!canSave} onClick={save}>{t('p.name.save.short')}</button>
            </div>
            <div className={'field-msg' + (err ? ' is-error' : '')} id="name-msg" aria-live="polite">{err ? t(err) : t('p.name.help')}</div>
          </div>
        </section>
        <section className="sec">
          <h2 className="sect-h">{t('p.prefs')}</h2>
          <div className="stack-8"><p className="small" id="l-lang">{t('lang.label')}</p>
            <Seg<Lang> label={t('lang.label')} value={lang} onChange={changeLang} items={LANGS.map((l) => ({ label: LANG_NAMES[l], value: l }))} /></div>
          <div className="stack-8"><p className="small">{t('p.view')}</p>
            <Seg<'card' | 'term'> label={t('p.view')} value={view} onChange={(v) => { setView(v); try { localStorage.setItem('cjp.view', v); } catch { /* */ } }} items={[{ label: t('h.view.card'), value: 'card' }, { label: t('h.view.term'), value: 'term' }]} /></div>
        </section>
        <section className="sec">
          <Html as="div" style={{ display: 'contents' }} html={helpSec} />
          <div className="pfoot">
            <button type="button" className="btn btn-danger" id="logout" onClick={logout}><span>{t('p.logout')}</span></button>
            <div className="row-between small muted"><span>{t('p.version', { v: CONFIG.appVersion })}</span><button type="button" className="linkish" id="upd" onClick={() => toast(t('p.uptodate'))}>{t('p.update')}</button></div>
          </div>
        </section>
      </div>
    </Shell>
  );
}
