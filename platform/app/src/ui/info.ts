// The sheets behind "?" (App.info of the "Daily Paper" prototype): every explanation that left the surface of a screen
// lives here, one tap away (see platform/design-variants/paper/COPY.md). Figures come from the cached API reads
// (config, ranking, invite), so the sheets say what the server says.
import { t } from '../i18n';
import { F, esc } from '../lib/fmt';
import { queryClient } from '../api';
import type { AppConfig, InviteInfo, Ranking, WalletInfo } from '../api/types';
import { btn, icon, rows } from './h';

function cached<T>(name: string): T | undefined {
  return queryClient.getQueriesData<T>({ predicate: (q) => q.queryKey[0] === name }).map(([, d]) => d).find(Boolean);
}
const lines = (keys: string[], vars?: Record<string, string | number>) =>
  '<div class="stack-8">' + keys.map((k) => '<p class="sheet-lead">' + (k.charAt(0) === '<' ? k : t(k, vars)) + '</p>').join('') + '</div>';
const closeBtn = () => '<div class="sheet-acts">' + btn(t('common.close'), { block: true, attrs: 'data-sheet-close' }) + '</div>';
const plainSteps = (items: string[]) => '<ol class="txsteps txsteps--plain">' + items.map((x, i) => '<li><span class="n">' + (i + 1) + '</span><span>' + x + '</span></li>').join('') + '</ol>';

export const INFO: Record<string, () => string> = {
  kaia: () => '<h2>' + t('pp.i.kaia') + '</h2>' + lines(['w.kaia.note', 'x.gas']) + closeBtn(),
  hits: () => '<h2>' + t('h.ai.h') + '</h2>' + lines(['d.hit.1', 'd.hit.2']) + plainSteps(['h.ai.1', 'h.ai.2', 'h.ai.3'].map((k) => t(k))) + closeBtn(),
  points: () => {
    const p = cached<AppConfig>('config')?.params;
    const rate = F.int(p?.pointsPerCT ?? 1000) + 'P = 1 CT', min = F.pts(p?.minConvertPoints ?? 1000);
    return '<h2>' + t('pp.i.points') + '</h2>' + rows([[t('c.rate'), rate], [t('c.minimum'), min], [t('c.fee'), t('c.fee.v')]]) + lines(['c.rank']) + closeBtn();
  },
  convert: () => {
    const p = cached<AppConfig>('config')?.params;
    const rate = F.int(p?.pointsPerCT ?? 1000) + 'P = 1 CT', min = F.pts(p?.minConvertPoints ?? 1000);
    return '<h2>' + t('pp.i.convert') + '</h2>' + rows([[t('c.rate'), rate], [t('c.minimum'), min], [t('c.capleft'), t('c.capof', { n: F.dec(cached<WalletInfo>('wallet')?.convert.capLeftCt ?? p?.maxConvertCtPerUserPerDay ?? 50) })], [t('c.fee'), t('c.fee.v')]]) + lines(['c.step', 'c.rank']) + closeBtn();
  },
  staking: () => {
    const p = cached<AppConfig>('config')?.params;
    const locks = p?.lockDays ?? [30, 90, 180, 365];
    return '<h2>' + t('s.help.q') + '</h2>' + lines(['s.help.a', 's.fee']) + '<div class="scrollx"><table class="ratetable"><tr><th>' + t('s.th.lock') + '</th><th>' + t('s.th.1') + '</th><th>' + t('s.th.2') + '</th><th>' + t('s.th.3') + '</th></tr>' +
      locks.map((d) => '<tr><td>' + t('s.days', { d }) + '</td>' + (p?.ratesPct[String(d)] ?? []).map((r) => '<td>' + r + '%</td>').join('') + '</tr>').join('') + '</table></div>' +
      lines(['pp.claimfrom'], { n: p?.minClaim ?? 10 }) + closeBtn();
  },
  deposit: () => {
    const token = cached<AppConfig>('config')?.contracts.ct;
    return '<h2>' + t('pp.i.deposit') + '</h2>' + lines(['dp.lead', 'dp.w1', 'dp.w2', 'dp.w3']) +
      (token ? '<div class="stack-8"><p class="hold-why">' + icon('warn', 16) + '<span>' + t('w.token') + '</span></p><p class="addr-v" translate="no">' + F.groups(token) + '</p></div>' : '') + closeBtn();
  },
  withdraw: () => '<h2>' + t('pp.i.withdraw') + '</h2>' + lines(['x.gas', 'w.kaia.note']) + closeBtn(),
  invite: () => {
    const v = cached<InviteInfo>('invite'), p = cached<AppConfig>('config')?.params;
    const welcome = v?.welcomePoints ?? p?.welcomePoints ?? 100, rate = (v?.referralBps ?? p?.referralBps ?? 1000) / 100;
    return '<h2>' + t('inv.how.h') + '</h2>' + plainSteps([t('inv.how.1'), t('inv.how.2', { w: welcome }), t('inv.how.3', { r: rate })]) +
      lines(['inv.hero.sub', 'inv.rule.1', 'inv.rule.2', 'inv.rule.3', 'inv.rule.4'], { r: rate, w: welcome }) + closeBtn();
  },
  email: () => {
    const names = cached<AppConfig>('config')?.providerNames || '';
    return '<h2>' + t('pp.i.email') + '</h2>' + lines(['a.email.cap', 'a.lede'], { list: '<span translate="no">' + esc(names) + '</span>' }) + closeBtn();
  },
  name: () => '<h2>' + t('p.name') + '</h2>' + lines(['p.name.help']) + closeBtn(),
  device: () => {
    const days = cached<AppConfig>('config')?.params.playKeyTtlDays ?? 30;
    return '<h2>' + t('pp.i.device') + '</h2>' + lines(['p.device.ready', 'p.device.until'], { date: F.dateLong(Date.now() + days * 86400_000) }) + closeBtn();
  },
  prizes: () => {
    const r = cached<Ranking>('ranking'); const ct = r?.pool.ct ?? 0; const split = r?.pool.splitPct ?? [];
    return '<h2>' + t('k.split.q') + '</h2>' + lines(['k.pool.line', '<span>' + t('k.tie') + ' ' + t('k.tie.note') + '</span>', 'k.split.note'], { n: F.int(ct) }) +
      '<div class="split">' + split.map((p, i) => '<div><span>' + t('k.rankth', { n: i + 1 }) + '</span><span>' + p + '%</span><b>' + F.prize((ct * p) / 100) + ' CT</b></div>').join('') + '</div>' + closeBtn();
  },
};
