// W2 Convert points (platform/design-variants/paper/convert.html): a sub page. The points to convert, the CT they become
// as the figure of the screen (it rolls while typing), three labelled facts, and the action naming both amounts. The rules
// are behind "?". A short review sheet says that points cannot be converted back before the one sponsored transaction.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfig, useMe, useWallet } from '../api';
import { t } from '../i18n';
import { F, parseAmount } from '../lib/fmt';
import { btn, empty, hold, note, qbtn, skel } from '../ui/h';
import { AmountField, Html, Shell, useRoll } from '../ui/kit';
import { useHold, useOffline, usePreset } from '../state/app';
import { runTx, showTx, useTx, useTxBusy, type TxCfg } from '../ui/tx';
import { actions } from '../chain/chain';

export default function Convert() {
  const st = usePreset();
  const nav = useNavigate();
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
  // the 7 day wait before the first conversion is told before the player meets it: a short labelled fact while it still applies
  const me = useMe();
  const young = !!me.data && Date.now() - Date.parse(me.data.signedUpAt) < 7 * 86400000;
  const firstFact = wait || young ? '<p class="fact" id="first-fact"><b>' + t('c.first') + '</b>' + (wait ? t('c.first.at', { date: F.date(d!.convert.firstConvertAt!) }) : t('c.first.v')) + '</p>' : '';
  const capGlobal = d ? d.convert.globalCapLeft <= 0 : false;
  const paused = !!d?.convert.paused || !!cfg.data?.flags.convertPaused;
  const initial = ({ empty: '', step: '1,250', above: '5,000', min: '500', loading: '', cap: '', capglobal: '', wait: '', paused: '1,000' } as Record<string, string>)[st] ?? '1,000';
  const [val, setVal] = useState(initial);
  const blocked = capLeft === 0 || capGlobal || paused || wait || loading || offline || held;
  const maxP = Math.min(Math.floor(bal / rate) * rate, capLeft * rate);

  const p = parseAmount(val), v = Math.floor(p.value || 0);
  let err = '', fix = '';
  const use = (f: number) => btn(t('c.fix', { f: F.int(f) }), { sm: true, attrs: 'data-fix="' + f + '"' });
  if (p.bad) err = t('pp.c.nan');
  else if (!p.empty && (p.decimals || 0) > 0) err = t('pp.c.whole');   // a value with decimals is refused, never rounded to another number
  else if (!p.empty && v > bal) { err = t('c.e.bal', { p: F.int(bal) }); if (maxP) fix = use(maxP); }
  else if (!p.empty && v < min) err = t('c.e.min');
  else if (!p.empty && v % rate) { const f = Math.floor(v / rate) * rate; err = t('c.e.step', { f: F.int(f) }); fix = use(f); }
  else if (!p.empty && v > capLeft * rate && capLeft) { err = t('c.cap.over', { n: capLeft, f: F.int(capLeft * rate) }); fix = use(capLeft * rate); }
  const valid = !err && !p.empty && !blocked;
  const n = valid ? v / rate : 0;
  // the result rolls to its new value and retargets while typing; a zero drops to plain grey text
  const getHtml = useRoll(n, (x) => (Math.round(x) ? F.dec(Math.round(x)) + '<small>CT</small>' : '<span class="is-zero">0 CT</span>'));

  const txCfg = (pts: number): TxCfg => ({
    key: 'convert', label: t('c.chip', { p: F.int(pts) }),
    review: { title: t('c.btn', { p: F.int(pts), n: pts / rate }), rows: [[t('pp.points'), F.pts(pts)], [t('c.get'), F.ct(pts / rate), true], [t('c.ok.left'), F.pts(bal - pts)]], note: t('pp.c.final'), confirm: t('c.btn', { p: F.int(pts), n: pts / rate }) },
    success: { stamp: 'pp.st.conv', title: t('c.ok.h', { p: F.int(pts), n: pts / rate }), rows: [[t('c.ok.left'), F.pts(bal - pts)], [t('c.ok.ct'), F.ct((d?.ct || 0) + pts / rate)]] },
    exec: (pr) => actions.convert(pts, pr),
    onSuccess: () => setVal(''),
    // after a conversion the form is cleared and the wallet opens
    onDone: () => { if (!st) nav('/wallet'); },
  });
  useEffect(() => {
    if (!d) return;
    const show = ({ signing: 'signing', sending: 'sending', success: 'success', failed: 'failed' } as const)[st as 'signing'];
    if (show) showTx(show, txCfg(valid ? v : 1000));
    return () => { if (show) useTx.setState({ pending: false }); };
  }, [st, !!d]);

  // the fix buttons sit inside HTML strings: one delegated listener
  useEffect(() => { const h = (e: MouseEvent) => { const f = (e.target as Element).closest?.('[data-fix]'); if (f) setVal(F.int(+f.getAttribute('data-fix')!)); }; document.addEventListener('click', h); return () => document.removeEventListener('click', h); }, []);
  let body: React.ReactNode;
  const short = !loading && bal < min && !held;
  if (short) {
    body = <Html as="div" style={{ display: 'contents' }} html={'<section class="msec"><div class="mhero"><h2 class="lbl">' + t('c.avail') + '</h2><p class="fig fig--xl">' + (bal ? F.int(bal) + '<small>P</small>' : '<span class="is-zero">0P</span>') + '</p></div>' + firstFact + '</section>' +
      empty({ icon: 'bolt', title: t('c.short.h'), body: t('c.short.b', { p: F.int(bal), g: F.int(min - bal) }), action: btn(t('k.play'), { kind: 'primary', href: '/' }) })} />;
  } else {
    let waitNote = '';
    if (wait && d?.convert.firstConvertAt) { const dt = d.convert.firstConvertAt, secs = (dt - Date.now()) / 1000; waitNote = note('', t('c.wait.b', { date: '<b>' + F.date(dt, true) + '</b>' }) + '<br><b>' + t('c.wait.left', { d: Math.floor(secs / 86400), h: Math.floor((secs % 86400) / 3600) }) + '</b>'); }
    const notes = waitNote + (capLeft === 0 && d ? note('warn', t('c.cap.hit', { time: t('time.kst9') })) : '') + (capGlobal ? note('warn', t('c.cap.global', { time: t('time.kst9') })) : '') + (paused ? note('warn', t('c.paused')) : '') + (offline ? note('warn', t('w.offline')) : '') + (held ? hold(t('hold.convert')) : '');
    body = (
      <>
        {notes && <Html as="div" style={{ display: 'contents' }} html={notes} />}
        <section className="msec">
          <AmountField id="amt" label={t('pp.points')} unit="P" mode="numeric" value={val} onChange={setVal} disabled={blocked} error={!!err}
            side={loading ? skel('96px', '12px') : t('c.avail') + ' <b>' + F.pts(bal) + '</b>'} msgHtml={err ? '<span>' + err + '</span>' + fix : '<span>' + t('c.step') + '</span>'} onMax={() => setVal(F.int(maxP))} />
        </section>
        {/* the result is the figure of this screen; the rate, the fee and what is left today are three labelled facts, every other rule is behind "?" */}
        <section className="msec mgrow">
          <div className="getbox">
            <h2 className="lbl lbl--q" dangerouslySetInnerHTML={{ __html: t('c.get') + qbtn('convert', t('c.title')) }} />
            <p className="fig" id="get" aria-live="polite" dangerouslySetInnerHTML={{ __html: getHtml }} />
            <p className="fact" id="left" dangerouslySetInnerHTML={{ __html: valid ? t('c.ok.left') + ' <b>' + F.pts(bal - v) + '</b>' : '' }} />
          </div>
          <dl className="facts3">
            <div><dt>{t('c.rate')}</dt><dd>{F.int(rate)}P = 1 CT</dd></div>
            {/* on hold converting is off, so there is no fee to state */}
            {!held && <div><dt>{t('c.fee')}</dt><dd>{t('pp.none')}</dd></div>}
            <div><dt>{t('pp.lefttoday')}</dt><dd>{F.dec(capLeft)} CT</dd></div>
          </dl>
        </section>
      </>
    );
  }
  // an amount in error: the sentence is under the field, once; the disabled action keeps its own words or says why it is off
  const why = held || paused ? t('hold.convert.btn') : wait && d?.convert.firstConvertAt ? t('pp.c.wait', { date: F.date(d.convert.firstConvertAt, true) }) : capLeft === 0 || capGlobal ? t('pp.c.cap') : offline ? t('off.bar').split('.')[0] : t('c.btn.empty');
  const pin = short ? null : (
    <div className="pin pin--act">
      <button type="button" className={'btn btn-primary btn-block' + (busy ? ' is-busy' : '')} id="go" disabled={!valid || !!busy} onClick={() => { if (valid) void runTx(txCfg(v)); }}>
        {busy ? <><span className="spin" /><span>{busy}</span></> : <span>{valid ? t('c.btn', { p: F.int(v), n }) : why}</span>}
      </button>
    </div>
  );
  return <Shell tab="wallet" back="/wallet" title={t('c.title')} pin={pin} points={loading ? undefined : bal} pts={loading ? 'loading' : ''}>{body}</Shell>;
}
