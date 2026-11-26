// Live adapters shared by several screens: admin API shapes to the design's view model pieces.
import { T } from './lib/x';
import { ctWei } from './page';

const KST = 9 * 3600;
/** Design style question id: Q-MMDD-slot (slot 1 to 5), from the day id (the day opens 09:00 KST). */
export function qid(dayId: number, slot: number) {
  const d = new Date((dayId * 86400 + KST) * 1000);
  return 'Q-' + String(d.getUTCMonth() + 1).padStart(2, '0') + String(d.getUTCDate()).padStart(2, '0') + '-' + (slot + 1);
}
export const dayIdOf = (unix: number) => Math.floor(unix / 86400);
export const CAT = (c: string | null | undefined) => (c ? c.charAt(0).toUpperCase() + c.slice(1).toLowerCase() : '');
export const STATUS: Record<string, string> = { draft: 'Draft', scheduled: 'Scheduled', cancelled: 'Cancelled', published: 'Live', closed: 'Closed', resolved: 'Answer set', voided: 'Cancelled', corrected: 'Corrected' };
export const IMG_STATE: Record<string, string> = { generated: 'Generated', fallback: 'Fallback', replaced: 'Replaced', rejected: 'Rejected by check', pending: 'Pending' };

/** audit_log rows to log viewer rows */
export function auditRows(entries: any[], now = Date.now() / 1000) {
  return (entries || []).map((e) => {
    const at = typeof e.created_at === 'number' ? e.created_at : Math.floor(new Date(e.created_at).getTime() / 1000);
    const p = e.payload || {};
    const why = p.reason ? ' Reason: ' + p.reason : p.note ? ' ' + p.note : '';
    return { t: T.logt(at, now), lv: /fail|error/.test(e.action) ? 'error' : /block|void|cancel|remove|maintenance\.on|freeze/.test(e.action) ? 'warn' : 'info', who: e.actor, msg: actionText(e.action, e.target) + '.' + why, tx: e.tx_hash || null, json: JSON.stringify({ id: e.id, action: e.action, target: e.target, payload: e.payload }) } as const;
  });
}
function actionText(action: string, target: string | null) {
  const t = target ? ' ' + target : '';
  const map: Record<string, string> = {
    'player.block': 'Blocked' + t, 'player.unblock': 'Unblocked' + t, 'player.clear': 'Cleared' + t + ' for 30 days', 'player.reset_name': 'Reset the display name of' + t,
    'question.cancel': 'Cancelled question' + t, 'question.void': 'Voided question' + t, 'question.replace': 'Replaced the text of question' + t, 'question.replace.requested': 'Asked the worker to replace question' + t,
    'question.swap': 'Swapped question' + t + ' with a draft', 'question.add': 'Added question' + t + ' by hand', 'draft.schedule': 'Scheduled a draft as question' + t, 'draft.discard': 'Discarded draft' + t,
    'question.image.regenerate': 'Asked for a new image for' + t, 'question.image.fallback': 'Switched' + t + ' to the category illustration', 'question.image.upload': 'Uploaded an image for' + t,
    'answer.rerun': 'Re-ran the answer of' + t, 'answer.correct': 'Corrected the answer of' + t + ' inside the window', 'answer.correct.owner_tx_built': 'Built the owner correction for' + t,
    'airdrop.trigger': 'Started the airdrop of week' + t, 'email_domain.add': 'Added' + t + ' to the email allow list', 'email_domain.update': 'Changed' + t + ' on the email allow list',
    'admin.upsert': 'Added or changed admin' + t, 'admin.remove': 'Removed admin' + t, 'app.maintenance.on': 'Turned maintenance mode on', 'app.maintenance.off': 'Turned maintenance mode off', 'job.run': 'Started' + t + ' now',
    'params.propose.built': 'Built a reward settings proposal', 'params.apply.built': 'Built the apply transaction', 'params.cancel.built': 'Built the cancel transaction', 'reserve.withdraw.built': 'Built a reserve withdrawal',
  };
  if (map[action]) return map[action];
  if (action.startsWith('owner_tx.')) return 'Owner wallet sent ' + action.slice(9).replace(/\./g, ' ') + t;
  if (action.startsWith('staking.')) return 'Built the staking owner transaction ' + action.slice(8).replace('.built', '');
  return action + t;
}

export interface ReserveRow { id: string; name: string; what: string; bal: number | null; unit: string; perDay: number | null; runway: number | null; floor: number | null; k: string; note: string }
/** dashboard.reserves (+ system budgets) to the reserves table rows */
export function reserveRows(r: any, gas: any, budgets: any, staking: any): ReserveRow[] {
  const kaia = (w: string | null | undefined) => (w == null ? null : Number(BigInt(w) / 10n ** 15n) / 1000);
  const state = (runway: number | null, bal: number | null, floor: number | null) => (bal != null && floor != null && bal < floor ? 'down' : runway != null && runway < 30 ? 'warn' : 'ok');
  const predBal = ctWei(r?.predictReserveWei), conv = ctWei(r?.conversionsPerDayWei);
  const feeBal = kaia(r?.feePayerWei), fee7 = kaia(gas?.perDay7Wei), feeFloor = budgets?.minFeePayerBalanceKaia != null ? Number(budgets.minFeePayerBalanceKaia) : null;
  const stakeBal = ctWei(r?.stakingAvailableRewardsWei);
  const opBal = kaia(r?.operatorWei);
  return [
    { id: 'pred', name: 'Prediction reserve', what: 'Pays conversions and the weekly airdrop', bal: predBal, unit: 'CT', perDay: conv, runway: r?.predictRunwayDays ?? null, floor: null, k: state(r?.predictRunwayDays ?? null, predBal, null), note: conv != null ? Math.round(conv).toLocaleString('en-US') + ' CT a day in conversions, plus the next weekly pool' : 'Conversions of the last 7 days' },
    { id: 'stake', name: 'Staking rewards fund', what: 'Free balance that new stakes reserve their interest from', bal: stakeBal, unit: 'CT', perDay: null, runway: null, floor: null, k: 'ok', note: staking ? Math.round(ctWei(staking.totalPrincipalWei) || 0).toLocaleString('en-US') + ' CT staked, ' + Math.round(ctWei(staking.owedInterestWei) || 0).toLocaleString('en-US') + ' CT interest already reserved for open stakes' : 'Staked principal and reserved interest are not part of it' },
    { id: 'fee', name: 'Fee payer', what: 'Pays the network fee for every sponsored transaction', bal: feeBal, unit: 'KAIA', perDay: fee7, runway: r?.feePayerRunwayDays ?? null, floor: feeFloor, k: state(r?.feePayerRunwayDays ?? null, feeBal, feeFloor), note: (gas?.sponsoredToday ?? 0).toLocaleString('en-US') + ' sponsored transactions today' },
    { id: 'op', name: 'Operator wallet', what: 'Registers players, sets answers, settles, blocks and airdrops', bal: opBal, unit: 'KAIA', perDay: null, runway: null, floor: null, k: 'ok', note: 'Sent by the worker only' },
  ];
}
