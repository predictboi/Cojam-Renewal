// W4 Withdraw CT (platform/design-variants/paper/withdraw.html): where to (with Paste, and the full address repeated in
// groups once it is valid), how much (with Max), the facts right above the pinned action. User paid (KAIA from the player's
// own wallet, never sponsored), sent through Privy sendTransaction after a review with a required check. Every address with
// a capital letter must pass the EIP-55 checksum.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAddress, isAddress, type Address } from 'viem';
import { useConfig, useWallet } from '../api';
import { t } from '../i18n';
import { esc, F, parseAmount } from '../lib/fmt';
import { btn, icon, note, qbtn, rows, skel } from '../ui/h';
import { AmountField, Html, Shell } from '../ui/kit';
import { useOffline, usePreset } from '../state/app';
import { runTx, showTx, useTx, useTxBusy, type TxCfg } from '../ui/tx';
import { actions } from '../chain/chain';
import { DESIGN } from '../api/mock';

const GOOD = '0x52908400098527886E0F7030069857D2E4169EE7';
const KNOWN = (DESIGN.contracts as string[]).map((x) => x.toLowerCase());

export default function Withdraw() {
  const st = usePreset();
  const nav = useNavigate();
  const q = useWallet();
  const cfg = useConfig();
  const offline = useOffline();
  const busy = useTxBusy('withdraw');
  const loading = st === 'loading' || q.isPending;
  const bal = q.data?.ct ?? 0, kaia = q.data?.kaia ?? 0, fee = cfg.data?.userTxFeeKaia ?? 0.0021;
  const me = q.data?.address || '';
  const contracts = [...KNOWN, ...(cfg.data ? [cfg.data.contracts.ct, cfg.data.contracts.predict, cfg.data.contracts.staking].map((x) => x.toLowerCase()) : [])];
  const addr0 = ({ filled: GOOD, review: GOOD, signing: GOOD, sending: GOOD, success: GOOD, failed: GOOD, nokaia: GOOD, bad: '0x52908400098527886E0F70300', sum: '0x52908400098527886e0F7030069857D2E4169EE7', own: DESIGN.user.address, contract: DESIGN.token } as Record<string, string>)[st] || '';
  const [to, setTo] = useState(addr0);
  const [amt, setAmt] = useState(addr0 ? '250' : '');
  const [touched, setTouched] = useState(!!addr0);
  const blocked = loading || offline;

  const v = to.trim();
  let e1 = '';
  if (!v) e1 = touched ? 'x.e.empty' : '';
  else if (!/^0x[0-9a-fA-F]{40}$/.test(v)) e1 = 'x.e.bad';
  else if (!isAddress(v, { strict: true })) e1 = 'pp.x.sum';   // EIP-55: any capital letter means the checksum must be right
  else if (me && v.toLowerCase() === me.toLowerCase()) e1 = 'x.e.own';
  else if (contracts.includes(v.toLowerCase())) e1 = 'x.e.contract';
  const p = parseAmount(amt), a = p.value || 0;
  let e2 = '', fix = '';
  if (p.bad || (!p.empty && a <= 0)) e2 = t('s.e.nan');
  else if (!p.empty && ((p.decimals || 0) > 4 || Math.round(a * 1e4) / 1e4 <= 0)) e2 = t('pp.x.dec');   // nothing that rounds to 0 CT, nothing finer than the unit shown
  else if (a > bal && !loading) { e2 = t('s.e.bal', { b: F.dec(bal) }); fix = btn(t('s.fix.bal', { b: F.dec(bal) }), { sm: true, attrs: 'data-fix="' + bal + '"' }); }
  const noKaia = !loading && kaia < fee;
  const valid = !!v && !e1 && !e2 && !p.empty && !noKaia && !blocked;

  const txCfg = (dest: string, n: number, raw: string): TxCfg => {
    const A = F.dec(n);
    return {
      key: 'withdraw', label: t('x.chip', { a: A }),
      review: { title: t('x.rv.h', { a: A }), rows: [[t('x.rv.to'), '<span class="addr-v" translate="no">' + F.groups(dest) + '</span>'], [t('x.amount'), F.ct(n), true], [t('x.fee'), t('x.fee.v', { f: fee })]], check: t('x.rv.check'), confirm: t('x.rv.h', { a: A }) },
      // a finished withdrawal shows where it went and what is left
      success: { stamp: 'pp.st.sent', title: t('x.ok', { a: A }), rows: [[t('x.rv.to'), '<span class="addr-v" translate="no">' + F.groups(dest) + '</span>'], [t('pp.balance'), F.ct(Math.round((bal - n) * 1e4) / 1e4)]] },
      exec: (pr) => actions.transferCt(getAddress(dest) as Address, raw, pr),
      onSuccess: () => { setAmt(''); setTo(''); setTouched(false); },
      onDone: () => { if (!st) nav('/wallet'); },
    };
  };
  useEffect(() => {
    const show = ({ review: 'review', signing: 'signing', sending: 'sending', success: 'success', failed: 'failed' } as const)[st as 'review'];
    if (!q.data) return;   // the review and success rows need the balance
    if (show) showTx(show, txCfg(GOOD, 250, '250'));
    return () => { if (show) useTx.setState({ pending: false }); };
  }, [st, !!q.data]);

  const paste = async () => {
    setTouched(true);
    let s = '';
    try { s = await navigator.clipboard.readText(); } catch { /* */ }
    setTo((s || (/[?&]state=/.test(location.search) ? GOOD : '')).trim());
  };
  useEffect(() => { const h = (e: MouseEvent) => { const f = (e.target as Element).closest?.('[data-fix]'); if (f) setAmt(F.dec(+f.getAttribute('data-fix')!)); }; document.addEventListener('click', h); return () => document.removeEventListener('click', h); }, []);
  // the field cannot show 42 characters: a valid address is repeated in full, grouped as on the wallet, so it can be checked by eye
  const toMsg = e1 ? '<span>' + t(e1) + '</span>' : v ? '<span class="tier-cue is-on">' + icon('check', 14) + t('x.addr.ok') + '</span><span class="addr-v" translate="no">' + F.groups(v) + '</span>' : '';
  // without KAIA for the fee the pinned action is the way out: it leads to the deposit page (never a dead button that names an action)
  const toDeposit = noKaia && !valid && !blocked;
  const label = e1 ? t('pp.x.fix') : noKaia ? t('x.fix.kaia') : !p.empty && !e2 && a ? t('x.btn', { a: F.dec(a) }) : t('x.btn.empty');
  const pin = (
    <div className="pin pin--act">
      <button type="button" className={'btn btn-primary btn-block' + (busy ? ' is-busy' : '')} id="go" disabled={(!valid && !toDeposit) || !!busy} onClick={() => { if (toDeposit) { nav('/deposit'); return; } if (valid) void runTx(txCfg(v, a, amt)); }}>
        {busy ? <><span className="spin" /><span>{busy}</span></> : <span>{label}</span>}
      </button>
    </div>
  );
  return (
    <Shell tab="wallet" back="/wallet" title={t('x.title')} pin={pin} pts={loading ? 'loading' : ''}>
      <>
        {offline && <Html as="div" style={{ display: 'contents' }} html={note('warn', t('x.offline'))} />}
        <section className="msec">
          <div className="field">
            <div className="field-label"><label htmlFor="to"><b>{t('x.to')}</b></label></div>
            <div className={'field-box field-box--text field-box--mono' + (blocked ? ' is-off' : '') + (e1 ? ' is-error' : '') + (v && !e1 ? ' is-ok' : '')}>
              <input id="to" name="to" type="text" inputMode="text" autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="0x…" value={to}
                aria-describedby="to-msg" aria-invalid={e1 ? 'true' : 'false'} disabled={blocked} onChange={(e) => { setTouched(true); setTo(e.target.value); }} onBlur={() => setTouched(true)} />
              <button type="button" className="field-max" id="paste" disabled={blocked} onClick={paste}>{t('x.paste')}</button>
            </div>
            <div className={'field-msg field-msg--stack' + (e1 ? ' is-error' : '')} id="to-msg" aria-live="polite" dangerouslySetInnerHTML={{ __html: toMsg }} />
          </div>
          <AmountField id="amt" label={t('x.amount')} unit="CT" value={amt} onChange={setAmt} disabled={blocked} error={!!e2}
            side={loading ? skel('110px', '12px') : t('x.avail', { c: '<b>' + F.dec(bal) + '</b>' })} msgHtml={e2 ? '<span>' + e2 + '</span>' + fix : ''} onMax={() => setAmt(F.dec(bal))} />
        </section>
        <Html as="section" className="msec" html={rows([[t('x.kaia') + qbtn('withdraw', t('x.fee')), F.kaia(kaia)], [t('x.fee'), t('x.fee.v', { f: fee }) + '<small><b>' + t('pp.youpay') + '</b></small>'], [t('dp.net'), t('dp.net.v')]])} />
        <div id="kaia-note" dangerouslySetInnerHTML={{ __html: noKaia ? note('error', t('x.e.kaia', { f: fee, k: F.dec(kaia) }), btn(t('x.fix.kaia'), { sm: true, href: '/deposit' })) : '' }} />
      </>
    </Shell>
  );
}
