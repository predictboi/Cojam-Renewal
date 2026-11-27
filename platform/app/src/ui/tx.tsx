// The transaction sheet (port of App.tx in components.js): review, signing, the two steps of approve and stake,
// sending, slow, success and failed. Used for staking, claim, withdraw principal, convert and withdraw CT; never for picks.
// While a transaction runs the button that started it carries the status and is disabled; "Hide" lets the player move
// on, then a success confirms with a toast and only a failure brings the sheet back.
import { create } from 'zustand';
import { t } from '../i18n';
import { F } from '../lib/fmt';
import { btn, icon, rows, rstamp, type Row } from './h';
import { reduceMotion } from '../lib/fmt';
import { live, sheet, toast } from '../state/ui';
import { useNavigate } from 'react-router-dom';
import type { TxProgress } from '../chain/chain';
import { CONFIG } from '../config';
import { queryClient } from '../api';

export type TxState = 'review' | 'signing' | 'steps' | 'steps2' | 'sending' | 'slow' | 'success' | 'failed';
export interface TxCfg {
  key: string;                   // which control started it (its button shows the busy label)
  label: string;
  review?: { title?: string; rows: Row[]; check?: string; note?: string; warn?: string; confirm?: string } | null;
  stepsTitle?: string; steps?: string[];
  success: { title: string; rows?: Row[]; btn?: { label: string; href: string }; fig?: string };
  cancelMsg?: string;
  failKey?: string;
  exec: (p: TxProgress) => Promise<string>;
  onSuccess?: () => void;
  onDone?: () => void;
}
interface TxStore { cfg: TxCfg | null; state: TxState | null; hidden: boolean; pending: boolean; hash: string | null; run: number }
export const useTx = create<TxStore>(() => ({ cfg: null, state: null, hidden: false, pending: false, hash: null, run: 0 }));

/** the busy label of the button that started the running transaction, or null */
export function useTxBusy(key: string): string | null {
  return useTx((s) => (s.pending && s.cfg?.key === key ? t('tx.chip', { label: s.cfg.label }) : null));
}

let nav: (to: string) => void = (to) => { location.href = to; };
export function useTxNav() { nav = useNavigate(); }

/** The explorer from GET /v1/config, else the build time default of the network. */
const explorer = () => queryClient.getQueryData<{ explorer?: string }>(['config'])?.explorer || CONFIG.chain.explorer;

/** the success moment: what happened as a display figure beside a "Filed" stamp in the reward ink */
function doneFig(ok: TxCfg['success']): string {
  let fig = ok.fig, m: RegExpExecArray | null;
  if (!fig) {
    const txt = String(ok.title).replace(/<[^>]+>/g, ''), re = /([+\-]?\d[\d,]*(?:\.\d+)?)\s?(CT|P)(?![A-Za-z])/g;
    let hit: RegExpExecArray | null = null;
    while ((m = re.exec(txt))) { if (!hit || (m[2] === 'CT' && hit[2] !== 'CT') || m[2] === hit[2]) hit = m; }
    if (hit) fig = hit[1] + ' ' + hit[2];
  }
  const parts = fig ? /^(.*?)(?:\s(CT|P))?$/.exec(fig) : null;
  return '<div class="sheet-done" aria-hidden="true">' + rstamp('hit', t('pp.filed')) + (parts ? '<span class="sheet-done-fig">' + parts[1] + (parts[2] ? '<small>' + parts[2] + '</small>' : '') + '</span>' : '') + '</div>';
}

function view(state: TxState, cfg: TxCfg, hash: string | null): string {
  const scan = hash ? explorer() + '/tx/' + hash : explorer();
  if (state === 'review') {
    const rv = cfg.review!;
    return '<h2>' + (rv.title || t('tx.review.h')) + '</h2>' + rows(rv.rows) +
      (rv.check ? '<label class="check"><input type="checkbox" id="tx-check"><span>' + rv.check + '</span></label>' : '') +
      (rv.note ? '<p class="sheet-warn" id="tx-note">' + icon('info', 18) + '<span>' + rv.note + '</span></p>' : '') +
      (rv.warn ? '<p class="sheet-warn">' + icon('lock', 18) + '<span>' + rv.warn + '</span></p>' : '') +
      '<div class="sheet-acts">' + btn(rv.confirm || t('tx.confirm'), { kind: 'primary', block: true, attrs: 'data-tx="confirm"', disabled: !!rv.check, id: 'tx-confirm' }) + btn(t('common.cancel'), { kind: 'ghost', block: true, attrs: 'data-tx="cancel"' }) + '</div>';
  }
  if (state === 'signing') {
    return '<div class="sheet-state"><div class="sheet-ic"><span class="spin"></span></div><h2>' + t('tx.sign.h') + '</h2><p class="sheet-lead">' + t('tx.sign.b') + '</p></div>' +
      '<div class="sheet-acts">' + btn(t('common.cancel'), { kind: 'ghost', block: true, attrs: 'data-tx="cancel"' }) + '</div>';
  }
  if (state === 'steps' || state === 'steps2') {
    const now = state === 'steps' ? 0 : 1;
    return '<h2>' + cfg.stepsTitle + '</h2><ol class="txsteps">' + cfg.steps!.map((s, i) => {
      const st = i < now ? 'done' : i === now ? 'now' : 'wait';
      return '<li class="is-' + st + '"><span class="n">' + (st === 'done' ? icon('check', 16) : i + 1) + '</span><span>' + s + '</span><span class="st">' + (st === 'now' ? '<span class="spin"></span>' : '') + t('tx.st.' + st) + '</span></li>';
    }).join('') + '</ol><div class="sheet-acts">' + (now === 0 ? btn(t('common.cancel'), { kind: 'ghost', block: true, attrs: 'data-tx="cancel"' }) : btn(t('tx.hide'), { block: true, attrs: 'data-tx="hide"' })) + '</div>';
  }
  if (state === 'sending' || state === 'slow') {
    return '<div class="sheet-state"><div class="sheet-ic"><span class="spin"></span></div><h2>' + t(state === 'slow' ? 'tx.slow.h' : 'tx.send.h') + '</h2><p class="sheet-lead">' + t(state === 'slow' ? 'tx.slow.b' : 'tx.send.b') + '</p></div>' +
      rows([[t('tx.hash'), '<span class="mono" translate="no">' + (hash ? F.short(hash) : '…') + '</span>']]) +
      '<div class="sheet-acts">' + btn(t('tx.hide'), { block: true, attrs: 'data-tx="hide"' }) + (state === 'slow' ? btn(t('tx.scan'), { kind: 'ghost', block: true, iconEnd: 'ext', href: scan, ext: true }) : '') + '</div>';
  }
  if (state === 'success') {
    const ok = cfg.success;
    return '<div class="sheet-state sheet-state--ok">' + doneFig(ok) + '<h2>' + ok.title + '</h2></div>' + (ok.rows ? rows(ok.rows) : '') +
      '<div class="sheet-acts">' + (ok.btn ? btn(ok.btn.label, { kind: 'primary', block: true, attrs: 'data-tx="go"' }) + btn(t('common.done'), { kind: 'ghost', block: true, attrs: 'data-tx="done"' }) : btn(t('common.done'), { kind: 'primary', block: true, attrs: 'data-tx="done"' })) +
      '<a class="linkish self-center" href="' + scan + '" target="_blank" rel="noopener">' + t('tx.scan') + icon('ext', 16) + '</a></div>';
  }
  return '<div class="sheet-state"><div class="sheet-ic is-bad">' + icon('x', 32) + '</div><h2>' + t('tx.fail.h') + '</h2><p class="sheet-lead">' + t(cfg.failKey || 'tx.fail.reverted') + '</p></div>' +
    '<div class="sheet-acts">' + btn(t('common.retry'), { kind: 'primary', block: true, attrs: 'data-tx="retry"' }) + btn(t('common.close'), { kind: 'ghost', block: true, attrs: 'data-tx="cancel"' }) + '</div>';
}

function show(state: TxState) {
  const s = useTx.getState(); const cfg = s.cfg!;
  useTx.setState({ state });
  sheet.open(view(state, cfg, s.hash), { closable: state === 'review' || state === 'success' || state === 'failed', label: cfg.label, onClose: () => { if (state === 'success') cfg.onDone?.(); } });
  setTimeout(() => {
    const sh = document.getElementById('sheet'), h = document.querySelector('#sheet h2') as HTMLElement | null;
    live(h ? h.textContent || '' : '');
    // the focus never falls out of the sheet between steps: after each swap it is on the heading, and on Done when it succeeded
    const fx = state === 'success' ? document.querySelector('#sheet [data-tx="done"]') as HTMLElement | null : state === 'review' ? null : h;
    if (fx) { if (fx.tagName === 'H2') fx.setAttribute('tabindex', '-1'); fx.focus({ preventScroll: true }); }
    else if (sh && !sh.contains(document.activeElement)) sh.focus({ preventScroll: true });
    // the filed stamp lands once the sheet is up; nothing plays on a failure
    const st = state === 'success' ? document.querySelector('#sheet .sheet-done .rstamp') as HTMLElement | null : null;
    if (st && !reduceMotion()) { st.style.setProperty('--d', '210ms'); st.classList.remove('is-land'); void st.offsetWidth; st.classList.add('is-land'); }
  }, 60);
}

function go(state: TxState) {
  const s = useTx.getState(); const cfg = s.cfg; if (!cfg) return;
  if (state === 'success' || state === 'failed') useTx.setState({ pending: false });
  if (!s.hidden) { show(state); return; }
  useTx.setState({ state });
  if (state === 'failed') { useTx.setState({ hidden: false }); show(state); }
  else if (state === 'success') {
    useTx.setState({ hidden: false });
    const ok = cfg.success; const msg = String(ok.title || cfg.label || '');
    toast(msg, ok.btn ? { btn: ok.btn.label, fn: () => nav(ok.btn!.href) } : {});
    live(msg.replace(/<[^>]+>/g, '')); cfg.onDone?.();
  }
}

/** run the flow: review first when the config has one, then sign, send and wait */
export async function runTx(cfg: TxCfg, confirmed = false) {
  const s = useTx.getState();
  if (s.pending) return; // one at a time
  const run = s.run + 1;
  useTx.setState({ cfg, hidden: false, hash: null, run });
  if (cfg.review && !confirmed) { show('review'); return; }
  useTx.setState({ pending: true });
  show('signing');
  let slowT: ReturnType<typeof setTimeout> | null = null;
  const alive = () => useTx.getState().run === run && useTx.getState().pending;
  try {
    await cfg.exec({
      step: (i) => { if (alive()) go(i === 0 ? 'steps' : 'steps2'); },
      signed: () => {},
      sent: (hash) => { if (!alive()) return; useTx.setState({ hash }); go('sending'); slowT = setTimeout(() => { if (alive() && useTx.getState().state === 'sending') go('slow'); }, 12_000); },
    });
    if (useTx.getState().run !== run) return;
    if (slowT) clearTimeout(slowT);
    void queryClient.invalidateQueries();
    cfg.onSuccess?.();
    go('success');
  } catch (e) {
    if (slowT) clearTimeout(slowT);
    if (useTx.getState().run !== run || !useTx.getState().pending) return;
    console.warn('transaction failed', e);
    go('failed');
  }
}
/** open a given state of the sheet directly (design review presets) */
export function showTx(state: TxState, cfg: TxCfg, hidden = false) {
  useTx.setState({ cfg, state, hidden, pending: hidden || !['review', 'success', 'failed'].includes(state), hash: state === 'sending' || state === 'slow' || state === 'success' ? '0x8c41f0a7d2be6953c1e07a4f9b25d83e61a0c7f4b9d2e8351a6f0c4d7e92b3a1' : null });
  if (!hidden) show(state);
}

/* sheet buttons (delegated, as in the prototype) */
let installed = false;
export function installTxHandlers() {
  if (installed) return; installed = true;
  document.addEventListener('click', (e) => {
    const b = (e.target as Element).closest?.('[data-tx]'); if (!b) return;
    const a = b.getAttribute('data-tx'); const s = useTx.getState(); const cfg = s.cfg; if (!cfg) return;
    if (a === 'confirm') { void runTx(cfg, true); }
    else if (a === 'cancel') {
      const running = s.state !== 'review' && s.state !== 'failed';
      // cancelling stops waiting for it here; a signature already sent cannot be called back
      useTx.setState({ pending: false, run: s.run + 1 }); sheet.close(true);
      if (running) toast(cfg.cancelMsg || t('tx.fail.cancel'));
    } else if (a === 'hide') { useTx.setState({ hidden: true }); sheet.close(true); }
    else if (a === 'done') { sheet.close(true); cfg.onDone?.(); }
    else if (a === 'go') { sheet.close(true); cfg.onDone?.(); if (cfg.success.btn) nav(cfg.success.btn.href); }
    else if (a === 'retry') { useTx.setState({ pending: false }); void runTx({ ...cfg, review: null }); }
  });
  document.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement;
    if (el.id === 'tx-check') { const c = document.querySelector('#tx-confirm') as HTMLButtonElement | null; if (c) c.disabled = !el.checked; }
  });
}
