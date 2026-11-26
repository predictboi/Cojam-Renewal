// S1 New stake (platform/design/staking.html): amount, lock period with the rate per tier, what it pays, the review sheet,
// then approve and stake as two sponsored transactions (the sheet shows the two steps).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useConfig, useWallet } from '../api';
import { t, currentLang } from '../i18n';
import { F, parseAmount } from '../lib/fmt';
import { btn, errorNote, help, hold, icon, note, skel } from '../ui/h';
import { AmountField, Html, Shell } from '../ui/kit';
import { useHold, useOffline, usePreset } from '../state/app';
import { runTx, showTx, useTx, useTxBusy, type TxCfg } from '../ui/tx';
import { actions } from '../chain/chain';
import { DESIGN } from '../api/mock';

const PERIODS = [30, 90, 180, 365];
const tierOf = (a: number, th: number[]) => (a >= th[1] ? 2 : a >= th[0] ? 1 : 0);

export function StakeTabs({ cur, n, hq }: { cur: 'new' | 'mine'; n: number; hq: string }) {
  return (
    <nav className="mtabs" id="sw" aria-label={t('s.switch')}>
      <a href={'/staking' + hq} aria-current={cur === 'new' ? 'page' : undefined}>{t('s.new')}</a>
      <a href={'/stakes' + hq} aria-current={cur === 'mine' ? 'page' : undefined}>{t('s.tab.mine')}<span className="mtabs-n" id="sw-n">{n}</span></a>
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
  const room = st === 'full' ? 300 : st === 'fullnone' ? 0 : Infinity;
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
  const cue = a < minStake ? t('s.min') : t('s.tier.cue' + ti);
  const msgHtml = err ? '<span>' + err + '</span>' + fix : '<span class="tier-cue' + (a >= minStake && ti ? ' is-on' : '') + '">' + (a >= minStake ? icon(ti ? 'check' : 'chart', 14) : '') + '<span>' + cue + '</span></span>' + (ko && a ? '<span>' + F.krw(a) + '</span>' : '');
  const over = !err && a > room;
  const valid = !err && !p.empty && !blocked && !over;
  const r = rates[String(period)][ti], interest = ((a * r) / 100) * period / 365;
  const shown = !err && !p.empty;
  const unlock = F.dateLong(Date.now() + period * 86400000);

  const txCfg = (amt: number): TxCfg => {
    const rr = rates[String(period)][tierOf(amt, th)], A = F.dec(amt);
    return {
      key: 'stake', label: t('s.chip', { a: A }), stepsTitle: t('tx.stake.h', { a: A }), steps: [t('tx.step1', { a: A }), t('tx.step2', { a: A })], cancelMsg: t('s.cancelled'),
      review: { title: t('s.rv.h', { a: A, d: period }), rows: [[t('s.amount'), F.ct(amt)], [t('s.period'), t('s.days', { d: period })], [t('s.apr'), rr + '%'], [t('s.interest', { d: period }), F.ct(((amt * rr) / 100) * period / 365), true]], warn: t('s.noexit', { date: unlock }), confirm: t('s.btn', { a: A }) },
      success: { title: t('s.ok.h', { a: A }), rows: [[t('s.unlock'), unlock], [t('s.apr'), rr + '%']], btn: { label: t('s.ok.btn'), href: '/stakes' } },
      exec: (pr) => actions.stake(String(amt), period, pr),
      onSuccess: () => setVal(''),
    };
  };
  // design review presets of the sheet
  useEffect(() => {
    const show = ({ review: 'review', signing: 'signing', steps: 'steps2', sending: 'sending', slow: 'slow', success: 'success', failed: 'failed' } as const)[st as 'review'];
    if (show) showTx(show, txCfg(a && valid ? a : 500));
    if (st === 'hidden') showTx('sending', txCfg(500), true);
    return () => { if (show || st === 'hidden') useTx.setState({ pending: false }); };
  }, [st]);

  const onClick = (e: React.MouseEvent) => {
    const f = (e.target as Element).closest('[data-fix]'); if (f) setVal(F.dec(+f.getAttribute('data-fix')!));
  };
  const hq = held ? '?state=hold' : '';
  const openN = (w.data?.openStakes ?? DESIGN.stakes.length) + (st === 'hold' ? 1 : 0);
  const goLabel = busy ? null : valid ? t('s.btn', { a: F.dec(a) }) : t(held ? 'hold.stake.btn' : 's.btn.idle');
  const pin = st === 'error' || w.isError ? null : (
    <div className="pin pin--act">
      <button type="button" className={'btn btn-primary btn-block' + (busy ? ' is-busy' : '')} id="go" disabled={!valid || !!busy} onClick={() => { if (valid) void runTx(txCfg(a)); }}>
        {busy ? <><span className="spin" /><span>{busy}</span></> : <span>{goLabel}</span>}
      </button>
      {!held && <p className="pin-note">{t('s.fee')}</p>}
    </div>
  );
  const head = <Html className="ph-top" html={'<h1>' + t('s.title') + '</h1>'} />;
  if (st === 'error' || w.isError) return <Shell tab="stake" docTitle={t('s.title')} head={head}><StakeTabs cur="new" n={openN} hq={hq} /><Html as="div" style={{ display: 'contents' }} html={errorNote()} /></Shell>;
  const notes = (paused ? note('warn', t('s.paused')) : '') + (st === 'fullnone' ? note('warn', t('s.full') + ' ' + t('s.full.none')) : '') + (max20 ? note('warn', t('s.max20'), btn(t('s.mine', { n: 20 }), { sm: true, href: '/stakes' })) : '');
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
          <div>
            <p className="field-label"><b id="per-l">{t('s.period')}</b></p>
            <div className="period" role="group" aria-labelledby="per-l" id="period">
              {PERIODS.map((d, i) => (
                <button key={d} type="button" data-d={d} aria-pressed={d === period} disabled={blocked} onClick={() => setPeriod(d)}>
                  <b>{d}<small>{t('s.d')}</small></b>
                  <span data-rate={d} key={roll ? roll.seq + ':' + d : d} className={roll ? 'is-' + roll.dir : undefined} style={{ ['--i' as string]: i }}>{rates[String(d)][ti]}%</span>
                </button>
              ))}
            </div>
          </div>
        </section>
        <section className="msec stk-sum">
          <div className="mhero" aria-live="polite">
            <h2 className="lbl" id="sum-l">{t('s.interest', { d: period })}</h2>
            <p className="fig" id="sum-v" dangerouslySetInnerHTML={{ __html: loading ? skel('170px', '30px') : shown ? F.dec(interest) + '<small>CT</small>' : '–' }} />
            <p className="sub" id="sum-k" hidden={!(ko && shown)}>{shown ? F.krw(interest) : ''}</p>
          </div>
          <p className="stk-lock" id="rules" dangerouslySetInnerHTML={{ __html: icon('lock', 18) + '<span>' + t('s.rules', { date: unlock }) + '</span>' }} />
        </section>
        <Html as="div" style={{ display: 'contents' }} html={help(t('s.help.q'), '<p>' + t('s.help.a') + '</p><div class="scrollx"><table class="ratetable"><tr><th>' + t('s.th.lock') + '</th><th>' + t('s.th.1') + '</th><th>' + t('s.th.2') + '</th><th>' + t('s.th.3') + '</th></tr>' +
          PERIODS.map((d) => '<tr><td>' + t('s.days', { d }) + '</td>' + rates[String(d)].map((x) => '<td>' + x + '%</td>').join('') + '</tr>').join('') + '</table></div>')} />
      </div>
    </Shell>
  );
}
