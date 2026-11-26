// W2 Convert points (platform/design/convert.html): 1,000P = 1 CT, in steps of 1,000P, within the daily cap,
// from 7 days after sign up. One sponsored transaction signed by the Privy wallet.
import { useEffect, useState } from 'react';
import { useConfig, useWallet } from '../api';
import { t } from '../i18n';
import { F, parseAmount } from '../lib/fmt';
import { btn, empty, hold, note, rows, skel } from '../ui/h';
import { AmountField, Html, Shell } from '../ui/kit';
import { useHold, useOffline, usePreset } from '../state/app';
import { runTx, showTx, useTx, useTxBusy, type TxCfg } from '../ui/tx';
import { actions } from '../chain/chain';

export default function Convert() {
  const st = usePreset();
  const q = useWallet();
  const cfg = useConfig();
  const offline = useOffline();
  const held = useHold() || st === 'hold';
  const busy = useTxBusy('convert');
  const loading = st === 'loading' || q.isPending;
  const d = q.data;
  const bal = d?.points ?? 0;
  const rate = d?.convert.pointsPerCT || 1000, min = d?.convert.min || 1000;
  const capLeft = d?.convert.capLeftCt ?? 50;
  const wait = !!d?.convert.firstConvertAt && d.convert.firstConvertAt > Date.now();
  const capGlobal = d ? d.convert.globalCapLeft <= 0 : false;
  const paused = !!d?.convert.paused || !!cfg.data?.flags.convertPaused;
  const initial = ({ empty: '', step: '1,250', above: '5,000', min: '500', loading: '', cap: '', capglobal: '', wait: '', paused: '1,000' } as Record<string, string>)[st] ?? '1,000';
  const [val, setVal] = useState(initial);
  const blocked = capLeft === 0 || capGlobal || paused || wait || loading || offline || held;
  const maxP = Math.min(Math.floor(bal / rate) * rate, capLeft * rate);

  const p = parseAmount(val), v = Math.floor(p.value || 0);
  let err = '', fix = '';
  const use = (f: number) => btn(t('c.fix', { f: F.int(f) }), { sm: true, attrs: 'data-fix="' + f + '"' });
  if (p.bad) err = t('c.e.min');
  else if (!p.empty && v > bal) { err = t('c.e.bal', { p: F.int(bal) }); if (maxP) fix = use(maxP); }
  else if (!p.empty && v < min) err = t('c.e.min');
  else if (!p.empty && v % rate) { const f = Math.floor(v / rate) * rate; err = t('c.e.step', { f: F.int(f) }); fix = use(f); }
  else if (!p.empty && v > capLeft * rate && capLeft) { err = t('c.cap.over', { n: capLeft, f: F.int(capLeft * rate) }); fix = use(capLeft * rate); }
  const valid = !err && !p.empty && !blocked;
  const n = valid ? v / rate : 0;

  const txCfg = (pts: number): TxCfg => ({
    key: 'convert', label: t('c.chip', { p: F.int(pts) }),
    success: { title: t('c.ok.h', { p: F.int(pts), n: pts / rate }), rows: [[t('c.ok.left'), F.pts(bal - pts)], [t('c.ok.ct'), F.ct((d?.ct || 0) + pts / rate)]] },
    exec: (pr) => actions.convert(pts, pr),
    onSuccess: () => setVal(''),
  });
  useEffect(() => {
    const show = ({ signing: 'signing', sending: 'sending', success: 'success', failed: 'failed' } as const)[st as 'signing'];
    if (show) showTx(show, txCfg(valid ? v : 1000));
    return () => { if (show) useTx.setState({ pending: false }); };
  }, [st]);

  const onClick = (e: React.MouseEvent) => { const f = (e.target as Element).closest('[data-fix]'); if (f) setVal(F.int(+f.getAttribute('data-fix')!)); };
  let body: React.ReactNode;
  const short = !loading && bal < min && !held;
  if (short) {
    body = <Html as="div" style={{ display: 'contents' }} html={'<section class="msec"><div class="mhero"><h2 class="lbl">' + t('c.avail') + '</h2><p class="fig">' + F.int(bal) + '<small>P</small></p></div></section>' +
      empty({ icon: 'bolt', title: t('c.short.h'), body: t('c.short.b', { p: F.int(bal), g: F.int(min - bal) }), action: btn(t('k.play'), { kind: 'primary', href: '/' }) })} />;
  } else {
    let waitNote = '';
    if (wait && d?.convert.firstConvertAt) { const dt = d.convert.firstConvertAt, secs = (dt - Date.now()) / 1000; waitNote = note('sky', t('c.wait.b', { date: '<b>' + F.date(dt, true) + '</b>' }) + '<br><b>' + t('c.wait.left', { d: Math.floor(secs / 86400), h: Math.floor((secs % 86400) / 3600) }) + '</b>'); }
    const notes = waitNote + (capLeft === 0 && d ? note('warn', t('c.cap.hit', { time: t('time.kst9') })) : '') + (capGlobal ? note('warn', t('c.cap.global', { time: t('time.kst9') })) : '') + (paused ? note('warn', t('c.paused')) : '') + (offline ? note('warn', t('w.offline')) : '') + (held ? hold(t('hold.convert')) : '');
    body = (
      <div style={{ display: 'contents' }} onClick={onClick}>
        {notes && <Html as="div" style={{ display: 'contents' }} html={notes} />}
        <section className="msec">
          <AmountField id="amt" label={t('c.amount')} unit="P" mode="numeric" value={val} onChange={setVal} disabled={blocked} error={!!err}
            side={loading ? skel('96px', '12px') : t('c.avail') + ' <b>' + F.pts(bal) + '</b>'} msgHtml={err ? '<span>' + err + '</span>' + fix : '<span>' + t('c.step') + '</span>'} onMax={() => setVal(F.int(maxP))} />
        </section>
        <section className="msec mgrow"><div className="mhero"><h2 className="lbl">{t('c.get')}</h2><p className="fig" id="get" aria-live="polite" dangerouslySetInnerHTML={{ __html: F.dec(n) + '<small>CT</small>' }} /></div></section>
        <Html as="section" className="msec" html={rows([[t('c.rate'), '1,000P = 1 CT'], [t('c.minimum'), '1,000P'], [t('c.capleft'), t('c.capof', { n: capLeft })], [t('c.fee'), t('c.fee.v')]])} />
      </div>
    );
  }
  const pin = short ? null : (
    <div className="pin pin--act">
      <button type="button" className={'btn btn-primary btn-block' + (busy ? ' is-busy' : '')} id="go" disabled={!valid || !!busy} onClick={() => { if (valid) void runTx(txCfg(v)); }}>
        {busy ? <><span className="spin" /><span>{busy}</span></> : <span>{valid ? t('c.btn', { p: F.int(v), n }) : t(held ? 'hold.convert.btn' : 'c.btn.empty')}</span>}
      </button>
      {!held && <p className="pin-note">{t('c.rank')}</p>}
    </div>
  );
  return <Shell tab="wallet" back="/wallet" title={t('c.title')} pin={pin} points={loading ? undefined : bal} pts={loading ? 'loading' : ''}>{body}</Shell>;
}
