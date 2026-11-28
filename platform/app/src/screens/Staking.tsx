// S1 Staking, new stake: the rates page (platform/design-variants/paper/staking.html). The amount, the four lock periods as
// one rate table (the chosen one inverted), what it pays as one figure that rolls, the lock as one line in ink (the date and
// "No early exit"), and the action pinned with the figure beside it on short phones. How rates work is behind the "?" beside
// the title. Every stake is reviewed in a sheet first, then approve and stake run as two sponsored transactions.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useConfig, useQuote, useWallet } from '../api';
import { t, currentLang } from '../i18n';
import { F, parseAmount } from '../lib/fmt';
import { btn, errorNote, hold, icon, note, qbtn, skel } from '../ui/h';
import { AmountField, Html, Shell, useRoll } from '../ui/kit';
import { useHold, useOffline, usePreset } from '../state/app';
import { runTx, showTx, useTx, useTxBusy, type TxCfg } from '../ui/tx';
import { actions } from '../chain/chain';
import { DESIGN } from '../api/mock';

const PERIODS = [30, 90, 180, 365];
const tierOf = (a: number, th: number[]) => (a >= th[1] ? 2 : a >= th[0] ? 1 : 0);

/** New stake and My stakes; the count shows once it is known (never a "0" while the stakes still load) */
export function StakeTabs({ cur, n, hq }: { cur: 'new' | 'mine'; n?: number; hq: string }) {
  return (
    <nav className="mtabs" id="sw" aria-label={t('s.switch')}>
      <a href={'/staking' + hq} aria-current={cur === 'new' ? 'page' : undefined}>{t('s.new')}</a>
      <a href={'/stakes' + hq} aria-current={cur === 'mine' ? 'page' : undefined}>{t('s.tab.mine')}{n !== undefined && <span className="mtabs-n" id="sw-n">{n}</span>}</a>
    </nav>
  );
}

export default function Staking() {
  const st = usePreset();
  const cfg = useConfig();
  const w = useWallet();
  const offline = useOffline();
  const held = useHold() || st === 'hold';
  const busy = useTxBusy('stake');
  const params = cfg.data?.params;
  const rates = params?.ratesPct || (DESIGN.rates as unknown as Record<string, number[]>);
  const th = params?.tierThresholds || [1000, 10000];
  const minStake = params?.minStake ?? 100;
  const bal = w.data?.ct ?? 0;
  const loading = st === 'loading' || w.isPending;
  const initial = ({ empty: '', below: '50', above: '5,000', zero: '', big: '12,000', review: '12,000', loading: '', hold: '' } as Record<string, string>)[st] ?? '500';
  const [val, setVal] = useState(initial);
  const [period, setPeriod] = useState(90);
  const paused = st === 'paused' || !!cfg.data?.flags.stakingPaused;
  const [qVal, setQVal] = useState(val);
  useEffect(() => { const tm = setTimeout(() => setQVal(val), 400); return () => clearTimeout(tm); }, [val]);
  const pa = parseAmount(qVal);
  const quote = useQuote(pa.value || 0, period, !st && !paused && !!pa.value && (pa.value || 0) >= minStake && (pa.decimals || 0) <= 4);
  const room = st === 'full' ? 300 : st === 'fullnone' ? 0 : quote.data?.capacityLeft ?? Infinity;
  const full = room <= 0;   // no room left at all: one notice, and the action says so
  const max20 = st === 'max20' || (w.data?.openStakes ?? 0) >= (params?.maxOpenPositions ?? 20);
  const blocked = paused || st === 'fullnone' || max20 || bal === 0 || loading || offline || held;
  const lastTier = useRef<number | null>(null);
  const [roll, setRoll] = useState<{ dir: 'up' | 'down'; seq: number } | null>(null);
  const ko = currentLang() === 'ko';

  const p = parseAmount(val), a = p.value || 0;
  let err = '', fix = '';
  if (p.bad) err = t('s.e.nan');
  else if ((p.decimals || 0) > 4) { const cut = Math.floor(a * 1e4) / 1e4; err = t('s.e.dec'); fix = btn(t('s.fix.dec', { b: F.dec(cut) }), { sm: true, attrs: 'data-fix="' + cut + '"' }); }
  else if (!p.empty && a < minStake) { err = t('s.e.min'); if (bal >= minStake) fix = btn(t('s.fix.min'), { sm: true, attrs: 'data-fix="' + minStake + '"' }); }
  else if (a > bal && !loading) { err = t('s.e.bal', { b: F.dec(bal) }); fix = btn(t('s.fix.bal', { b: F.dec(bal) }), { sm: true, attrs: 'data-fix="' + bal + '"' }); }
  const ti = err ? 0 : tierOf(a, th);
  useEffect(() => { if (lastTier.current !== null && lastTier.current !== ti) setRoll({ dir: ti > lastTier.current ? 'up' : 'down', seq: Date.now() }); lastTier.current = ti; }, [ti]);
  // under the field: the minimum until it is met, then the next tier as a short cue (the full sentence is in the "?" sheet)
  const cue = a < minStake ? t('s.min') : ti === 0 ? t('pp.tier1') : ti === 1 ? t('pp.tier2') : t('s.tier.cue2');
  const msgHtml = err ? '<span>' + err + '</span>' + fix : '<span class="tier-cue' + (a >= minStake && ti ? ' is-on' : '') + '">' + (a >= minStake && ti ? icon('check', 16) : '') + '<span>' + cue + '</span></span>' + (ko && a ? '<span>' + F.krw(a) + '</span>' : '');
  // over the room left: only when there is some room (with none, the one "full" notice says it and nothing offers "Stake 0 CT")
  const over = !err && room > 0 && a > room;
  const valid = !err && !p.empty && !blocked && !over && !full;
  const r = rates[String(period)][ti], interest = ((a * r) / 100) * period / 365;
  const shown = !err && !p.empty;
  const unlock = F.dateLong(Date.now() + period * 86400000);
  const sumHtml = useRoll(shown ? interest : 0, (x) => (shown ? F.dec(x) + '<small>CT</small>' : '<span class="is-zero">0 CT</span>'));

  const txCfg = (amt: number): TxCfg => {
    const rr = rates[String(period)][tierOf(amt, th)], A = F.dec(amt);
    return {
      key: 'stake', label: t('s.chip', { a: A }), stepsTitle: t('tx.stake.h', { a: A }), steps: [t('tx.step1', { a: A }), t('tx.step2', { a: A })], cancelMsg: t('s.cancelled'),
      review: { title: t('s.rv.h', { a: A, d: period }), rows: [[t('s.amount'), F.ct(amt)], [t('s.period'), t('s.days', { d: period })], [t('s.apr'), rr + '%'], [t('s.interest', { d: period }), F.ct(((amt * rr) / 100) * period / 365), true]], warn: t('s.noexit', { date: unlock }), confirm: t('s.btn', { a: A }) },
      success: { stamp: 'pp.st.staked', title: t('s.ok.h', { a: A }), rows: [[t('s.unlock'), unlock], [t('s.apr'), rr + '%']], btn: { label: t('s.ok.btn'), href: '/stakes' } },
      exec: (pr) => actions.stake(String(amt), period, pr),
      onSuccess: () => setVal(''),
      onDone: () => { if (!st) void w.refetch(); },
    };
  };
  // design review presets of the sheet
  useEffect(() => {
    if (!w.data) return;
    const show = ({ review: 'review', signing: 'signing', steps: 'steps2', sending: 'sending', slow: 'slow', success: 'success', failed: 'failed' } as const)[st as 'review'];
    if (show) showTx(show, txCfg(a && valid ? a : 500));
    if (st === 'hidden') showTx('sending', txCfg(500), true);
    return () => { if (show || st === 'hidden') useTx.setState({ pending: false }); };
  }, [st, !!w.data]);

  const onClick = (e: React.MouseEvent) => {
    const f = (e.target as Element).closest('[data-fix]'); if (f) setVal(F.dec(+f.getAttribute('data-fix')!));
  };
  const hq = held ? '?state=hold' : '';
  const openN = w.data ? w.data.openStakes + (st === 'hold' ? 1 : 0) : undefined;
  // a switched off action says why, like Convert and Withdraw: the state of staking first, then what is wrong with the amount
  const why = held || paused ? t('hold.stake.btn') : full ? t('s.btn.full') : max20 ? t('s.btn.max') : offline ? t('off.bar').split('.')[0]
    : !loading && bal === 0 ? t('s.btn.nobal') : p.bad ? t('s.btn.nan') : (p.decimals || 0) > 4 ? t('s.btn.dec') : p.empty ? t('s.btn.empty')
      : a < minStake ? t('s.btn.min', { n: F.int(minStake) }) : a > bal ? t('s.btn.bal') : over ? t('s.btn.room', { x: F.dec(room) }) : t('s.btn.idle');
  const goLabel = busy ? null : valid ? t('s.btn', { a: F.dec(a) }) : why;
  const pin = st === 'error' || w.isError ? null : (
    <div className="pin pin--act">
      <p className="pin-fig" id="pin-fig" aria-hidden="true"><span>{t('s.interest', { d: period })}</span><b className="nw">{shown ? F.dec(interest) : '0'} CT</b></p>
      {/* short phones: the lock line (no early exit) rides in the pinned bar above the action, so it is never under the bar */}
      <p className="pin-lock" id="pin-lock" dangerouslySetInnerHTML={{ __html: icon('lock', 16) + '<span>' + t('s.rules', { date: unlock }) + '</span>' }} />
      <button type="button" className={'btn btn-primary btn-block' + (busy ? ' is-busy' : '')} id="go" disabled={!valid || !!busy} onClick={() => { if (valid) void runTx(txCfg(a)); }}>
        {busy ? <><span className="spin" /><span>{busy}</span></> : <span>{goLabel}</span>}
      </button>
      <p className="pin-note">{held ? t('pp.youpay') : t('pp.nofee2')}</p>
    </div>
  );
  const head = <Html className="ph-top ph-top--q" html={'<h1>' + t('s.title') + '</h1>' + qbtn('staking', t('s.title'))} />;
  if (st === 'error' || w.isError) return <Shell tab="stake" docTitle={t('s.title')} head={head}><StakeTabs cur="new" n={openN} hq={hq} /><Html as="div" style={{ display: 'contents' }} html={errorNote()} /></Shell>;
  const notes = (paused ? note('warn', t('s.paused')) : '') + (full ? note('warn', t('s.full') + ' ' + t('s.full.none')) : '') + (max20 ? note('warn', t('s.max20'), btn(t('s.mine', { n: 20 }), { sm: true, href: '/stakes' })) : '');
  const after = (offline ? note('warn', t('s.offline')) : '') +
    (held ? hold(t('hold.stake'), { action: btn(t('s.tab.mine'), { sm: true, href: '/stakes?state=hold', iconEnd: 'right', id: 'hold-mine' }) }) : '') +
    (!loading && bal === 0 ? note('', t('s.zero'), '<div class="row">' + btn(t('w.deposit'), { sm: true, href: '/deposit' }) + btn(t('w.convert'), { sm: true, href: '/convert' }) + '</div>') : '');
  return (
    <Shell tab="stake" docTitle={t('s.title')} head={head} pin={pin} pts={loading ? 'loading' : ''}>
      <div style={{ display: 'contents' }} onClick={onClick}>
        <StakeTabs cur="new" n={openN} hq={hq} />
        {notes && <Html as="div" style={{ display: 'contents' }} html={notes} />}
        <div id="full-note" dangerouslySetInnerHTML={{ __html: over ? note('warn', t('s.full') + ' ' + t('s.full.room', { x: F.dec(room), d: period }), btn(t('s.fix.stake', { x: F.dec(room) }), { sm: true, attrs: 'data-fix="' + room + '"' })) : '' }} />
        {after && <Html as="div" style={{ display: 'contents' }} html={after} />}
        <section className="msec" id="form">
          <AmountField id="amt" label={t('s.amount')} unit="CT" value={val} onChange={setVal} disabled={blocked}
            side={loading ? skel('110px', '12px') : t('s.avail') + ' <b id="avail">' + F.ct(bal) + '</b>'} msgHtml={msgHtml} error={!!err} onMax={() => setVal(F.dec(bal))} />
          <div className="stack-8">
            <p className="field-label"><b id="per-l">{t('s.period')}</b><span>{t('pp.peryear')}</span></p>
            <div className="period" role="group" aria-labelledby="per-l" id="period">
              {PERIODS.map((d, i) => (
                <button key={d} type="button" data-d={d} aria-pressed={d === period} disabled={blocked} onClick={() => setPeriod(d)}>
                  <span className="per-d">{t('s.days', { d })}</span>
                  <b data-rate={d} key={roll ? roll.seq + ':' + d : d} className={roll ? 'is-' + roll.dir : undefined} style={{ ['--i' as string]: i }}>{rates[String(d)][ti]}%</b>
                </button>
              ))}
            </div>
          </div>
        </section>
        <section className="msec stk-sum">
          <div className="mhero" aria-live="polite">
            <h2 className="lbl" id="sum-l">{t('s.interest', { d: period })}</h2>
            <p className="fig" id="sum-v" dangerouslySetInnerHTML={{ __html: loading ? skel('170px', '40px') : sumHtml }} />
            <p className="sub" id="sum-k" hidden={!(ko && shown)}>{shown ? F.krw(interest) : ''}</p>
          </div>
          <p className="stk-lock" id="rules" dangerouslySetInnerHTML={{ __html: icon('lock', 18) + '<span>' + t('s.rules', { date: unlock }) + '</span>' }} />
        </section>
      </div>
    </Shell>
  );
}
