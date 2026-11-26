// AD2 Reward settings, ported from platform/design/admin/pages/rewards.js. States (mock): none | editing | invalid |
// review | connect | wrongwallet | signing | failed | proposed | ready | cancel | loading | error.
// Live: the contract values from GET /admin/v1/params and /admin/v1/staking. A proposal is one proposeParams
// transaction (48 hour delay) plus the staking setters (at once, new stakes only), each built unsigned by the API and
// signed by the owner wallet in this browser. Server settings live in the server environment and are read only here.
import { useEffect, useMemo, useRef, useState } from 'react';
import { CONFIG } from '../config';
import { X, begin, is, n, ic, esc, cd, addr, tx, btn, kv, note, table, errorBlock, short, T } from '../lib/x';
import { confirm, sheet, toast, go, closeSheet } from '../lib/ui';
import { api } from '../api/client';
import { usePageData, useInvalidate } from '../api/hooks';
import { usePageCtx, useActs, ctWei, nowS } from '../page';
import { Shell } from '../Shell';
import { ownerFlow, type FlowState } from '../wallet/flow';
import type { UnsignedTx } from '../wallet/owner';
import type { Address } from 'viem';

const EFFECT: Record<string, string> = { 'Prediction contract': '48 hours after the proposal', 'Staking contract': 'At once, for new stakes only', Server: 'At once' };
const strip = (v: string) => v.replace(/,/g, '').trim();
const isInt = (v: string) => /^\d+$/.test(strip(v));
const num = (v: string) => Number(strip(v));

/** Contract parameter keys of the design rows, how to read them from params() and write them back. */
const PMAP: Record<string, { get: (p: any) => number; put: (p: any, v: number) => void; fmt?: (v: number) => string; ok: (v: string, all: Record<string, string>, p: any) => boolean }> = {
  completion: { get: (p) => p.completionPoints, put: (p, v) => (p.completionPoints = v), ok: (v) => isInt(v) && num(v) <= 1000 },
  hit: { get: (p) => p.hitPoints, put: (p, v) => (p.hitPoints = v), ok: (v) => isInt(v) && num(v) <= 1000 },
  settle: { get: (p) => p.settleDelay / 3600, put: (p, v) => (p.settleDelay = Math.round(v * 3600)), ok: (v) => /^\d+(\.\d+)?$/.test(strip(v)) && num(v) <= 48 },
  rate: { get: (p) => p.pointsPerCT, put: (p, v) => (p.pointsPerCT = v), ok: (v) => isInt(v) && num(v) >= 100 && num(v) <= 100000 },
  minconv: { get: (p) => p.minConvertPoints, put: (p, v) => (p.minConvertPoints = v), ok: (v, all, p) => { const r = all.rate ? num(all.rate) : p.pointsPerCT; return isInt(v) && num(v) <= 1000000 && num(v) >= r && num(v) % r === 0; } },
  capuser: { get: (p) => p.maxConvertCtPerUserPerDay, put: (p, v) => (p.maxConvertCtPerUserPerDay = v), ok: (v) => isInt(v) && num(v) >= 1 && num(v) <= 10000 },
  capday: { get: (p) => p.maxConvertCtPerDay, put: (p, v) => (p.maxConvertCtPerDay = v), ok: (v) => isInt(v) && num(v) >= 100 && num(v) <= 1000000 },
  age: { get: (p) => p.minAccountAge / 86400, put: (p, v) => (p.minAccountAge = Math.round(v * 86400)), ok: (v) => isInt(v) && num(v) <= 30 },
  ref: { get: (p) => p.referralBps / 100, put: (p, v) => (p.referralBps = Math.round(v * 100)), ok: (v) => /^\d+(\.\d{1,2})?$/.test(strip(v)) && num(v) <= 20 },
  welcome: { get: (p) => p.welcomePoints, put: (p, v) => (p.welcomePoints = v), ok: (v) => isInt(v) && num(v) <= 1000 },
  poolcap: { get: (p) => p.maxWeeklyPool, put: (p, v) => (p.maxWeeklyPool = v), ok: (v) => isInt(v) && num(v) <= 1000000 },
  airdelay: { get: (p) => p.airdropDelay / 3600, put: (p, v) => (p.airdropDelay = Math.round(v * 3600)), ok: (v, all, p) => { const s = all.settle ? num(all.settle) : p.settleDelay / 3600; return isInt(v) && num(v) >= 48 + s && num(v) <= 168; } },
};
const MOCK_BAD: Record<string, (v: string, all: Record<string, string>) => boolean> = {
  minconv: (v) => num(v) % 1000 === 0, reviewat: (v, all) => num(v) < num(all.blockat || '80'),
};

function changesOf(D: any, EDIT: Record<string, string>) {
  const out: { key: string; name: string; from: string; to: string; store: string }[] = [];
  D.params.forEach((g: any) => g.rows.forEach((r: any) => { if (EDIT[r.key]) out.push({ key: r.key, name: r.name, from: r.cur + ' ' + r.unit.replace(/ \(.*/, ''), to: EDIT[r.key] + ' ' + r.unit.replace(/ \(.*/, ''), store: r.store || g.store }); }));
  D.stakingRates.periods.forEach((p: any) => p[1].forEach((r: number, i: number) => { const k = 'rate-' + p[0] + '-' + i; if (EDIT[k] != null && num(EDIT[k]) !== r) out.push({ key: k, name: 'Staking rate, ' + p[0] + ' days, tier ' + (i + 1), from: r.toFixed(2) + ' %', to: num(EDIT[k]).toFixed(2) + ' %', store: 'Staking contract' }); }));
  D.stakingParams.forEach((r: any) => { if (EDIT[r.key]) out.push({ key: r.key, name: r.name, from: r.cur + ' ' + r.unit, to: EDIT[r.key] + ' ' + r.unit, store: 'Staking contract' }); });
  if (EDIT.split) out.push({ key: 'split', name: 'Top 10 split', from: D.split.join(' / '), to: EDIT.split, store: 'Prediction contract' });
  return out;
}

function badOf(D: any, EDIT: Record<string, string>): Record<string, 1> {
  const bad: Record<string, 1> = {};
  const all = EDIT;
  for (const g of D.params) for (const r of g.rows) {
    const v = EDIT[r.key]; if (!v) continue;
    const m = PMAP[r.key];
    if (CONFIG.mock) { const f = MOCK_BAD[r.key]; if (f && !f(v, all)) bad[r.key] = 1; }
    else if (m && D.raw && !m.ok(v, all, D.raw)) bad[r.key] = 1;
    else if (!m && r.check && !r.check(v)) bad[r.key] = 1;
  }
  for (const p of D.stakingRates.periods) p[1].forEach((_r: number, i: number) => { const k = 'rate-' + p[0] + '-' + i, v = EDIT[k]; if (v != null && !(/^\d+(\.\d{1,2})?$/.test(strip(v)) && num(v) <= 50)) bad[k] = 1; });
  for (const r of D.stakingParams) { const v = EDIT[r.key]; if (v && r.check && !r.check(v, EDIT)) bad[r.key] = 1; }
  if (EDIT.split) { const s = EDIT.split.split('/').map((x) => num(x)); if (s.reduce((a, b) => a + b, 0) !== 100 || s.some((v, i) => i > 0 && v > s[i - 1])) bad.split = 1; }
  return bad;
}

function render(D: any, EDIT: Record<string, string>): string {
  begin();
  const hasPending = !!D.pending && (!CONFIG.mock || !is('none', 'editing', 'invalid', 'review', 'connect', 'wrongwallet', 'signing', 'failed'));
  const ready = CONFIG.mock ? is('ready') : !!D.pending?.ready;
  const BAD = badOf(D, EDIT);
  const pend: Record<string, any> = {}; if (hasPending) D.pending.items.forEach((i: any) => { pend[i.key] = i; });
  const ownerOnly = !CONFIG.mock && X.role !== 'owner';

  function banner() {
    const p = D.pending;
    const diff = '<table class="tbl tight diff" style="max-width:720px"><caption class="sr">Pending change</caption><thead><tr><th scope="col">Parameter</th><th scope="col" class="num">Now</th><th scope="col" class="num">After</th><th scope="col">Stored in</th></tr></thead><tbody>' +
      p.items.map((i: any) => '<tr><td><b>' + i.name + '</b></td><td class="num"><del>' + i.from + '</del></td><td class="num"><ins>' + i.to + '</ins></td><td>Prediction contract</td></tr>').join('') + '</tbody></table>';
    const by = CONFIG.mock ? 'Proposed ' + p.proposed + ' by the owner wallet ' + addr(p.by) + ' in ' + tx(p.tx) + '. ' : 'Proposed by the owner wallet ' + addr(p.by) + '. ';
    return '<section class="banner"' + (ready ? ' data-k="ready"' : '') + ' aria-labelledby="pend-h"><div class="stack"><h2 id="pend-h">' + (ready ? 'The pending change can be applied now' : 'A change is announced on chain and waiting out its 48 hours') + '</h2>' + diff +
      '<p>' + by + (ready ? 'The 48 hours ended ' + p.applies + '. It does not apply by itself: the owner wallet signs once more.' : 'Players keep the current values until the owner applies it. No other contract value can be proposed while this one is waiting.') + '</p></div>' +
      '<div class="banner-side"><span class="dim">' + (ready ? 'Waiting for the owner since' : 'Can be applied in') + '</span><span class="cd">' + (ready ? (p.readyShort || 'Fri 16:10') : cd(p.in)) + '</span><span class="dim">' + (ready ? '' : p.applies) + '</span>' +
      '<div class="acts end">' + btn('Cancel the change', { link: 1, danger: 1, act: 'cancel', write: 1, disabled: ownerOnly, title: ownerOnly ? 'Only the Owner role can sign owner changes' : '' }) + (ready ? btn('Apply with the owner wallet', { primary: 1, act: 'apply', write: 1, disabled: ownerOnly }) : '') + '</div></div></section>';
  }
  function input(key: string, o: any) {
    const v = EDIT[key], p = pend[key];
    if (p) return '<span class="to">' + ic('clock') + p.to.replace(/ .*/, '') + '</span> <span class="unit">pending, input locked</span>';
    const locked = o.readonly || (hasPending && (o.store || o.gstore) === 'Prediction contract' && !CONFIG.mock);
    return '<label class="sr" for="p-' + key + '">New value for ' + o.name + '</label><input class="inp num' + (v ? ' changed' : '') + '" id="p-' + key + '" data-param="' + key + '" inputmode="decimal" autocomplete="off" placeholder="' + (o.readonly ? 'Server setting' : locked ? 'Locked' : 'No change') + '" value="' + esc(v || '') + '"' + (BAD[key] ? ' aria-invalid="true" aria-describedby="e-' + key + '"' : '') + (X.canWrite && !locked ? '' : ' disabled') + (o.readonly ? ' title="Set in the server environment (Render), not from the admin"' : locked ? ' title="A change is pending: no other contract value can be proposed until it is applied or cancelled"' : '') + '><span class="unit">' + o.unit.replace(/ \(.*/, '') + '</span>' +
      '<p class="err" id="e-' + key + '"' + (BAD[key] ? '' : ' hidden') + '>' + ic('warn') + o.err + '</p>';
  }
  function group(g: any) {
    return '<h3 class="sub">' + g.group + '</h3><table class="tbl ptbl fix"><caption class="sr">' + g.group + '</caption><colgroup><col style="width:31%"><col style="width:13%"><col style="width:20%"><col style="width:17%"><col style="width:19%"></colgroup>' +
      '<thead><tr><th scope="col">Parameter</th><th scope="col">Current</th><th scope="col">New value</th><th scope="col">Bounds</th><th scope="col">Stored in, takes effect</th></tr></thead><tbody>' +
      g.rows.map((r: any) => {
        const store = r.store || g.store;
        return '<tr' + (pend[r.key] ? ' class="pending"' : '') + '><td><span class="t1">' + r.name + '</span>' + (r.help ? '<span class="t2">' + r.help + '</span>' : '') + '</td><td><span class="cur">' + r.cur + '<small>' + r.unit.replace(/ \(Wed.*/, '') + '</small></span></td><td>' + input(r.key, { ...r, gstore: g.store, readonly: !CONFIG.mock && store === 'Server' }) + '</td><td class="dim">' + r.bounds + '</td><td><span class="t1" style="font-weight:600">' + store + '</span><span class="t2">' + (store === 'Server' && !CONFIG.mock ? 'Changed in the server environment' : EFFECT[store]) + '</span></td></tr>';
      }).join('') + '</tbody></table>';
  }
  function split() {
    const cur = EDIT.split ? EDIT.split.split('/').map((x) => num(x)) : D.split;
    const lockSplit = !CONFIG.mock && hasPending;
    return '<h3 class="sub">Top 10 split of the weekly pool</h3><div class="cols cols-7-5"><div><div class="splitrow" role="group" aria-label="Share of the pool per rank, in percent">' + cur.map((p: number, i: number) => '<label>Rank ' + (i + 1) + '<input class="inp" inputmode="numeric" value="' + p + '"' + (X.canWrite && !lockSplit ? '' : ' disabled') + ' data-split></label>').join('') +
      '</div><p class="hint" style="margin-top:8px" id="split-sum"><b style="color:var(--ink)">Sum 100%.</b> Ten whole percentages that add up to exactly 100, and a lower rank never gets more than a higher one. Prediction contract, 48 hours after the owner proposes it.</p></div>' +
      '<p class="hint">With this week\'s pool of ' + n(D.week.pool) + ' CT: rank 1 gets ' + n(D.rank[0].prize, 2) + ' CT, rank 10 gets ' + n(D.rank[9].prize, 2) + ' CT. Prizes are never split: equal points rank by who got there first.</p></div>';
  }
  function staking() {
    const s = D.stakingRates;
    if (!s.periods.length) return '<h3 class="sub">Staking rates, yearly percent</h3>' + note('', 'The staking contract values are not known yet. The worker writes them every minute once the staking contract is configured.');
    return '<h3 class="sub">Staking rates, yearly percent</h3><div class="cols cols-7-5"><div><table class="tbl rates"><caption class="sr">Staking rate by lock period and amount tier</caption><thead><tr><th scope="col">Lock period</th>' + s.tiers.map((t: string, i: number) => '<th scope="col">Tier ' + (i + 1) + '<br><span style="font-weight:400">' + t + '</span></th>').join('') + '</tr></thead><tbody>' +
      s.periods.map((p: any) => '<tr><th scope="row" style="border-bottom:var(--hair);font-size:13.5px;color:var(--ink);font-weight:700;padding:8px 0;vertical-align:middle">' + p[0] + ' days</th>' + p[1].map((r: number, i: number) => { const k = 'rate-' + p[0] + '-' + i, v = EDIT[k]; const ch = v != null && num(v) !== r; return '<td><label class="sr" for="' + k + '">' + p[0] + ' days, tier ' + (i + 1) + '</label><input class="inp num' + (ch ? ' changed' : '') + '" id="' + k + '" data-rate="' + r.toFixed(2) + '" inputmode="decimal" value="' + esc(v != null ? v : r.toFixed(2)) + '"' + (BAD[k] ? ' aria-invalid="true"' : '') + (X.canWrite ? '' : ' disabled') + '><span class="unit">%</span></td>'; }).join('') + '</tr>').join('') +
      '</tbody></table><p class="hint" style="margin-top:8px">0 to 50, two decimals. Staking contract: a new rate applies to stakes opened after the owner signs. An open stake keeps the rate it started with until it ends.</p></div><div>' +
      '<table class="tbl ptbl"><caption class="sr">Staking limits</caption><thead><tr><th scope="col">Limit</th><th scope="col">Current</th><th scope="col">New value</th></tr></thead><tbody>' + D.stakingParams.map((r: any) => '<tr><td><span class="t1">' + r.name + '</span><span class="t2">' + r.bounds + '</span></td><td><span class="cur">' + r.cur + '<small>' + r.unit + '</small></span></td><td>' + input(r.key, r) + '</td></tr>').join('') + '</tbody></table></div></div>';
  }
  function treasury() {
    return '<h3 class="sub">Treasury and owner</h3>' + kv([
      ['Owner of both contracts', addr(D.owner, { full: 1 }) + ' <span class="dim">The master wallet. It signs every change on this page in the browser; the server never holds its key.</span>'],
      ['Treasury (receives withdrawn reserves)', addr(D.treasury || D.owner, { full: 1 }) + ' <span class="dim">' + ((D.treasury || D.owner).toLowerCase() === D.owner.toLowerCase() ? 'Same wallet. ' : '') + 'Changing it is an owner proposal with the 48 hour delay.</span>'],
      ['Prediction contract', addr(D.contracts.prediction, { full: 1 })], ['Staking contract', addr(D.contracts.staking, { full: 1 })],
    ]) + (CONFIG.mock ? '' : '<div class="acts" style="margin-top:16px">' + btn('Withdraw from the prediction reserve', { act: 'withdraw', arg: 'reserve', write: 1, disabled: X.role !== 'owner', title: X.role !== 'owner' ? 'Only the Owner role can build owner transactions' : '' }) + btn('Withdraw free staking rewards', { act: 'withdraw', arg: 'rewards', write: 1, disabled: X.role !== 'owner' || !D.contracts.staking, title: X.role !== 'owner' ? 'Only the Owner role can build owner transactions' : '' }) + '</div><p class="hint" style="margin-top:8px">Only what is not owed can leave: the prediction reserve keeps paying conversions and the airdrop from what stays; staking principal and reserved interest are never withdrawable.</p>');
  }

  if (is('loading')) return '<section class="sec"><div class="sec-head"><h2>Prediction and conversion</h2></div>' + table({ loading: 1, cols: [{ h: 'Parameter', cell: () => '' }, { h: 'Current', cell: () => '' }, { h: 'New value', cell: () => '' }, { h: 'Bounds', cell: () => '' }, { h: 'Stored in, takes effect', cell: () => '' }] }) + '</section>';
  if (is('error')) return '<section class="sec">' + errorBlock('The current values') + '<p class="hint">The form stays closed until the values are read from the contracts, so that nothing is proposed against a stale number.</p></section>';
  return (is('proposed') ? note('up', '<b>Proposed.</b> 2 values are announced on chain and can be applied Sat 28 Nov, 14:32 KST. The staking rate applies to new stakes from now. The server setting is saved.') + '<div style="height:16px"></div>' : '') +
    (hasPending ? banner() : '') +
    '<section class="sec"><div class="sec-head"><h2>Prediction and conversion</h2><span class="sec-note">Type a new value to add it to the proposal. Empty means no change.</span></div>' + D.params.map(group).join('') + split() + '</section>' +
    '<section class="sec"><div class="sec-head"><h2>Staking</h2><span class="sec-note">' + n(D.staking.total) + ' CT staked in ' + D.staking.stakes + ' open stakes</span></div>' + staking() + '</section>' +
    '<section class="sec"><div class="sec-head"><h2>Wallets and contracts</h2></div>' + treasury() + '</section><div id="savebar-slot" style="display:contents"></div>';
}

function savebar(D: any, EDIT: Record<string, string>) {
  const c = changesOf(D, EDIT), bad = Object.keys(badOf(D, EDIT)).length;
  if (!c.length) return '';
  const ownerOnly = !CONFIG.mock && X.role !== 'owner';
  return '<div class="savebar" role="region" aria-label="Unsaved changes"><p>' + (bad ? '<span class="err">' + ic('warn') + bad + (bad === 1 ? ' value is' : ' values are') + ' outside their bounds. Fix them to continue.</span>' : c.length + ' changes, not saved yet: ' + c.map((x) => x.name).join(', ') + '.') + '</p><div class="acts">' + btn('Discard', { link: 1, act: 'discard' }) + btn('Review changes', { primary: 1, act: 'review', disabled: !!bad || ownerOnly, title: ownerOnly ? 'Only the Owner role can propose owner changes' : '' }) + '</div></div>';
}

/* ---------- live view model ---------- */
const DEFS = [
  { group: 'Daily play', store: 'Prediction contract', rows: [
    { key: 'completion', name: 'Completion points', help: 'Paid once when a player answers all 5 of the day', unit: 'P', bounds: '0 to 1,000, whole number', err: 'Enter a whole number from 0 to 1,000.' },
    { key: 'hit', name: 'Points per hit', help: 'Paid for each right answer after the correction window', unit: 'P', bounds: '0 to 1,000, whole number', err: 'Enter a whole number from 0 to 1,000.' },
    { key: 'settle', name: 'Correction window (settle delay)', help: 'Time between an answer being set and hit points being paid', unit: 'hours', bounds: '0 to 48 hours', err: 'Enter 0 to 48 hours.' }] },
  { group: 'Conversion to CT', store: 'Prediction contract', rows: [
    { key: 'rate', name: 'Points per CT', help: '', unit: 'P per CT', bounds: '100 to 100,000, whole number', err: 'Enter how many points make 1 CT, from 100 to 100,000.' },
    { key: 'minconv', name: 'Minimum conversion', help: 'Smallest amount a player can convert at once', unit: 'P', bounds: 'A multiple of the rate, up to 1,000,000', err: 'The minimum must be a multiple of the rate.' },
    { key: 'capuser', name: 'Conversion cap per player per day', unit: 'CT', bounds: '1 to 10,000', err: 'Enter 1 to 10,000.' },
    { key: 'capday', name: 'Conversion cap per day, everyone', unit: 'CT', bounds: '100 to 1,000,000', err: 'Enter 100 to 1,000,000.' },
    { key: 'age', name: 'Account age wait', help: 'Days after sign up before the first conversion', unit: 'days', bounds: '0 to 30 days', err: 'Enter 0 to 30 days.' }] },
  { group: 'Invites', store: 'Prediction contract', rows: [
    { key: 'ref', name: 'Referral rate', help: 'Bonus to the inviter on every point a friend earns', unit: '%', bounds: '0% to 20%, whole basis points', err: 'Enter a rate from 0% to 20%.' },
    { key: 'welcome', name: 'Welcome points', help: 'Paid once to an invited friend on their first finished day', unit: 'P', bounds: '0 to 1,000, whole number', err: 'Enter a whole number from 0 to 1,000.' },
    { key: 'invday', name: 'Invite links per inviter per day', unit: 'links', bounds: '1 to 1,000', err: 'Enter 1 to 1,000.', store: 'Server' }] },
  { group: 'Weekly ranking and airdrop', store: 'Prediction contract', rows: [
    { key: 'poolper', name: 'Weekly pool per qualified player', unit: 'CT', bounds: '0 or more', err: 'Enter 0 or more.', store: 'Server' },
    { key: 'poolcap', name: 'Weekly pool cap', unit: 'CT', bounds: '0 to 1,000,000', err: 'Enter 0 to 1,000,000.' },
    { key: 'airdelay', name: 'Airdrop delay', help: 'Time after the week closes before prizes are sent, so late answers can land', unit: 'hours', bounds: '48 hours plus the settle delay, up to 168', err: 'Enter at least 48 hours plus the settle delay, up to 168.' }] },
  { group: 'Abuse thresholds', store: 'Server', rows: [
    { key: 'blockat', name: 'Block at risk score', unit: 'of 100', bounds: '0 to 100', err: 'The review threshold must be below the block threshold.' },
    { key: 'reviewat', name: 'Review from risk score', unit: 'of 100', bounds: '0 to 100, below the block score', err: 'The review threshold must be below the block threshold.' }] },
];
const LABEL: Record<string, (p: any) => string> = {
  completion: (p) => n(p.completionPoints) + ' P', hit: (p) => n(p.hitPoints) + ' P', settle: (p) => +(p.settleDelay / 3600).toFixed(2) + ' hours', rate: (p) => n(p.pointsPerCT) + ' P per CT', minconv: (p) => n(p.minConvertPoints) + ' P',
  capuser: (p) => n(p.maxConvertCtPerUserPerDay) + ' CT', capday: (p) => n(p.maxConvertCtPerDay) + ' CT', age: (p) => +(p.minAccountAge / 86400).toFixed(2) + ' days', ref: (p) => +(p.referralBps / 100).toFixed(2) + '%',
  welcome: (p) => n(p.welcomePoints) + ' P', poolcap: (p) => n(p.maxWeeklyPool) + ' CT', airdelay: (p) => +(p.airdropDelay / 3600).toFixed(2) + ' hours',
};
const PNAME: Record<string, string> = Object.fromEntries(DEFS.flatMap((g) => g.rows.map((r) => [r.key, r.name])));

async function liveRewards() {
  const [pr, stk, app, rk] = await Promise.all([api('/admin/v1/params'), api('/admin/v1/staking').catch(() => null), api('/admin/v1/app').catch(() => null), api('/admin/v1/ranking/current').catch(() => null)]);
  const p = pr.current, srv = app?.server || {};
  const fmtCur = (key: string): string => {
    if (PMAP[key]) { const v = PMAP[key].get(p); return key === 'ref' || key === 'settle' || key === 'age' || key === 'airdelay' ? String(+v.toFixed(2)) : n(v); }
    return key === 'invday' ? n(srv.inviteLinksPerDay ?? 30) : key === 'poolper' ? n(srv.weeklyPoolPerPlayerCt ?? 1) : key === 'blockat' ? String(srv.riskBlockScore ?? 80) : key === 'reviewat' ? String(srv.riskReviewScore ?? 50) : '';
  };
  const params = DEFS.map((g) => ({ ...g, rows: g.rows.map((r) => ({ ...r, cur: fmtCur(r.key), help: r.key === 'rate' ? n(p.pointsPerCT) + ' P convert to 1 CT' : r.help })) }));
  let pending: any = null;
  if (pr.pending) {
    const np = pr.pending.params, items: any[] = [];
    for (const k of Object.keys(PMAP)) if (PMAP[k].get(np) !== PMAP[k].get(p)) items.push({ key: k, name: PNAME[k], from: LABEL[k](p), to: LABEL[k](np) });
    if (JSON.stringify(np.splitBps) !== JSON.stringify(p.splitBps)) items.push({ key: 'split', name: 'Top 10 split', from: p.splitBps.map((b: number) => b / 100).join(' / '), to: np.splitBps.map((b: number) => b / 100).join(' / ') });
    if (String(np.treasury).toLowerCase() !== String(p.treasury).toLowerCase()) items.push({ key: 'treasury', name: 'Treasury', from: short(p.treasury), to: short(np.treasury) });
    const at = pr.pending.applyAfter, now = nowS();
    pending = { by: pr.owner, items, applies: T.full(at), in: Math.max(0, at - now), ready: now >= at, readyShort: T.wd(at) + ' ' + T.hm(at), params: np };
  }
  const tierCt = (stk?.tiersWei || []).map((w: string) => ctWei(w) || 0);
  const minStake = ctWei(stk?.minStakeWei) ?? 0;
  const tiers = tierCt.length === 2 ? [n(minStake) + ' to ' + n(tierCt[0] - 1) + ' CT', n(tierCt[0]) + ' to ' + n(tierCt[1] - 1) + ' CT', n(tierCt[1]) + ' CT or more'] : ['Tier 1', 'Tier 2', 'Tier 3'];
  const periods = stk?.ratesBps ? (stk.lockDays as number[]).map((d, i) => [d, (stk.ratesBps[i] || []).map((b: number) => b / 100)]) : [];
  const ctOk = (v: string) => /^\d{1,12}(\.\d{1,18})?$/.test(strip(v));
  const stakingParams = stk ? [
    { key: 'tier2', name: 'Tier 2 starts at', cur: n(tierCt[0] ?? 0), unit: 'CT', bounds: 'Above the minimum stake', err: 'Tier limits must go up.', check: (v: string, E: any) => ctOk(v) && num(v) > num(E.minstake || String(minStake)) && num(v) < num(E.tier3 || String(tierCt[1])) },
    { key: 'tier3', name: 'Tier 3 starts at', cur: n(tierCt[1] ?? 0), unit: 'CT', bounds: 'Above tier 2', err: 'Tier limits must go up.', check: (v: string, E: any) => ctOk(v) && num(v) > num(E.tier2 || String(tierCt[0])) },
    { key: 'minstake', name: 'Minimum stake', cur: n(minStake), unit: 'CT', bounds: '1 to 100,000', err: 'Enter 1 to 100,000.', check: (v: string) => ctOk(v) && num(v) >= 1 && num(v) <= 100000 },
    { key: 'minclaim', name: 'Minimum interest claim', cur: n(ctWei(stk.minClaimWei) ?? 0), unit: 'CT', bounds: '0 to 1,000', err: 'Enter 0 to 1,000.', check: (v: string) => ctOk(v) && num(v) <= 1000 },
    { key: 'captotal', name: 'Cap on total principal', cur: n(ctWei(stk.maxTotalPrincipalWei) ?? 0), unit: 'CT', bounds: 'Covered by the rewards fund at the top rate', err: 'Enter a CT amount.', check: ctOk },
    { key: 'capuserstk', name: 'Cap per address', cur: n(ctWei(stk.maxUserPrincipalWei) ?? 0), unit: 'CT', bounds: 'Open principal of one address', err: 'Enter a CT amount.', check: ctOk },
    { key: 'capopen', name: 'Open stakes per address', cur: n(stk.maxOpenPositions ?? 0), unit: 'stakes', bounds: '1 to 1,000', err: 'Enter 1 to 1,000.', check: (v: string) => isInt(v) && num(v) >= 1 && num(v) <= 1000 },
  ] : [];
  const poolCt = ctWei(rk?.poolWei) ?? 0, split = p.splitBps.map((b: number) => b / 100);
  return {
    raw: p, params, pending, split,
    stakingRates: { tiers, periods }, stakingParams, stk,
    staking: { total: Math.round(ctWei(stk?.totalPrincipalWei) ?? 0), stakes: stk?.openStakes ?? 0 },
    week: { pool: poolCt }, rank: split.map((s: number) => ({ prize: (poolCt * s) / 100 })),
    owner: pr.owner, treasury: p.treasury, contracts: { prediction: '', staking: stk?.address || '' },
  };
}

export default function Rewards() {
  const { state, net } = usePageCtx('rewards');
  const inval = useInvalidate();
  const page = usePageData(['rewards'], liveRewards);
  const { loading, error, updatedAt, q } = page;
  const D = page.D;
  if (!CONFIG.mock) X.state = loading ? 'loading' : error ? 'error' : '';
  if (D && !CONFIG.mock && net) D.contracts.prediction = net.contracts?.predict || '';
  const presetEdit = useMemo(() => {
    if (!CONFIG.mock) return {};
    if (is('invalid')) return { capuser: '30', minconv: '1,500', reviewat: '85' } as Record<string, string>;
    return is('editing', 'review', 'connect', 'wrongwallet', 'signing', 'failed') ? { capuser: '30', ref: '12', invday: '20', 'rate-90-0': '11.50' } as Record<string, string> : {};
  }, [state]);
  const [edits, setEdits] = useState<Record<string, string>>(presetEdit);
  useEffect(() => { setEdits(presetEdit); }, [presetEdit]);
  const VM = D || EMPTY;
  const editsRef = useRef(edits); editsRef.current = edits;
  const html = useMemo(() => render(VM, CONFIG.mock ? presetEdit : editsRef.current), [VM, state, X.role, X.env, presetEdit]);

  // typing updates the change list (the save bar) without rebuilding the form
  useEffect(() => {
    const onInput = (e: Event) => {
      const t = e.target as HTMLInputElement;
      if (t.matches('[data-param]')) { t.classList.toggle('changed', !!t.value); setEdits((x) => { const y = { ...x }; if (t.value.trim()) y[t.dataset.param!] = t.value.trim(); else delete y[t.dataset.param!]; return y; }); }
      if (t.matches('[data-rate]')) { const ch = t.value.trim() !== '' && num(t.value) !== num(t.dataset.rate!); t.classList.toggle('changed', ch); setEdits((x) => { const y = { ...x }; if (t.value.trim() !== '' && num(t.value) !== num(t.dataset.rate!)) y[t.id] = t.value.trim(); else delete y[t.id]; return y; }); }
      if (t.matches('[data-split]')) {
        const vals = [...document.querySelectorAll<HTMLInputElement>('[data-split]')].map((i) => +i.value || 0), s = vals.reduce((a, b) => a + b, 0);
        (document.getElementById('split-sum')!.firstChild as HTMLElement).innerHTML = s === 100 ? 'Sum 100%.' : '<span style="color:var(--down)">The split must add up to 100%. Now ' + s + '%.</span>';
        const same = vals.join('/') === VM.split.join('/');
        setEdits((x) => { const y = { ...x }; if (same) delete y.split; else y.split = vals.join(' / '); return y; });
      }
    };
    document.addEventListener('input', onInput);
    return () => document.removeEventListener('input', onInput);
  }, [VM]);
  // inline errors follow the values
  useEffect(() => {
    const bad = badOf(VM, edits);
    document.querySelectorAll<HTMLInputElement>('[data-param], [data-rate]').forEach((i) => {
      const k = i.dataset.param || i.id, er = document.getElementById('e-' + k);
      if (bad[k]) { i.setAttribute('aria-invalid', 'true'); if (er) { er.hidden = false; i.setAttribute('aria-describedby', 'e-' + k); } } else { i.removeAttribute('aria-invalid'); if (er) er.hidden = true; }
    });
  }, [edits, VM]);

  const chainId = net?.chainId || 8217;
  function proposalTxs(): () => Promise<UnsignedTx[]> {
    return async () => {
      const out: UnsignedTx[] = [];
      const E = edits, p = { ...VM.raw, splitBps: [...VM.raw.splitBps] };
      let predict = false;
      for (const k of Object.keys(PMAP)) if (E[k]) { PMAP[k].put(p, num(E[k])); predict = true; }
      if (E.split) { p.splitBps = E.split.split('/').map((x: string) => Math.round(num(x) * 100)); predict = true; }
      if (predict) out.push((await api('/admin/v1/params', { body: { action: 'propose', params: p } })).unsignedTx);
      const rateKeys = Object.keys(E).filter((k) => k.startsWith('rate-'));
      if (rateKeys.length) {
        const rates = VM.stakingRates.periods.map((per: any) => per[1].map((r: number, i: number) => Math.round(num(E['rate-' + per[0] + '-' + i] ?? String(r)) * 100)));
        out.push((await api('/admin/v1/staking', { body: { action: 'setRates', ratesBps: rates } })).unsignedTx);
      }
      const sp = VM.stk;
      const cur = (w: string) => String(ctWei(w) ?? 0);
      if (E.tier2 || E.tier3) out.push((await api('/admin/v1/staking', { body: { action: 'setTiers', tiersCt: [strip(E.tier2 || cur(sp.tiersWei[0])), strip(E.tier3 || cur(sp.tiersWei[1]))] } })).unsignedTx);
      if (E.minstake || E.minclaim) out.push((await api('/admin/v1/staking', { body: { action: 'setMinimums', minStakeCt: strip(E.minstake || cur(sp.minStakeWei)), minClaimCt: strip(E.minclaim || cur(sp.minClaimWei)) } })).unsignedTx);
      if (E.captotal || E.capuserstk || E.capopen) out.push((await api('/admin/v1/staking', { body: { action: 'setCaps', maxOpenPositions: num(E.capopen || String(sp.maxOpenPositions)), maxTotalPrincipalCt: strip(E.captotal || cur(sp.maxTotalPrincipalWei)), maxUserPrincipalCt: strip(E.capuserstk || cur(sp.maxUserPrincipalWei)) } })).unsignedTx);
      return out;
    };
  }

  function reviewSheet(initial?: FlowState) {
    const c = changesOf(VM, CONFIG.mock ? presetEdit : edits);
    const at48 = T.full(nowS() + 48 * 3600);
    const eff: Record<string, string> = { 'Prediction contract': CONFIG.mock ? 'Sat 28 Nov, 14:32 KST, then the owner applies' : at48 + ', then the owner applies', 'Staking contract': 'At once, new stakes only', Server: 'At once' };
    const chainN = c.filter((x) => x.store !== 'Server').length;
    const txN = new Set(c.filter((x) => x.store !== 'Server').map((x) => (x.store === 'Prediction contract' ? 'p' : x.key.startsWith('rate-') ? 'r' : /tier/.test(x.key) ? 't' : /min/.test(x.key) ? 'm' : 'c'))).size;
    const diff = '<table class="tbl tight diff"><caption class="sr">Changes to save</caption><thead><tr><th scope="col">Parameter</th><th scope="col" class="num">Now</th><th scope="col" class="num">New</th><th scope="col">Effective from</th></tr></thead><tbody>' +
      c.map((x) => '<tr><td><b>' + x.name + '</b><span class="t2">' + x.store + '</span></td><td class="num"><del>' + x.from + '</del></td><td class="num"><ins>' + x.to + '</ins></td><td>' + eff[x.store] + '</td></tr>').join('') + '</tbody></table>';
    const hasPred = c.some((x) => x.store === 'Prediction contract');
    ownerFlow({
      title: 'Review ' + c.length + ' changes', body: diff, owner: VM.owner as Address, chainId, initial,
      wrongText: CONFIG.mock ? 'The connected wallet is ' + short(VM.A('someone-else')) + ', not the owner. Switch to the owner account in the wallet, then connect again.' : undefined,
      signTitle: 'Sign the proposal',
      signText: CONFIG.mock ? chainN + ' values on chain in 2 transactions. The server setting is saved with your admin session and needs no wallet.' : chainN + ' values on chain in ' + txN + (txN === 1 ? ' transaction.' : ' transactions, one after the other.') + ' The owner pays the network fee.',
      signingText: CONFIG.mock ? 'Confirm in the wallet. ' + chainN + ' values in 2 transactions (prediction contract, staking contract). The owner pays the network fee.' : 'Confirm in the wallet. The owner pays the network fee.',
      later: hasPred || CONFIG.mock ? [['Wait 48 hours', 'The prediction contract announces the change on chain. Anyone can read it. You can cancel it during this time.'], ['Apply', 'After 48 hours the owner wallet signs once more and the new values are live.']] : [],
      cancel: 'Back to editing',
      build: proposalTxs(),
      record: { action: 'params.propose' },
      sentText: () => hasPred ? '<b>Proposed.</b> The contract values are announced on chain and can be applied ' + at48 + '. Staking changes apply to new stakes from now.' : '<b>Saved on chain.</b> Staking changes apply to new stakes from now.',
      onDone: () => { setEdits({}); void inval(); },
    });
  }
  function cancelChange() {
    const p = VM.pending;
    const summary = CONFIG.mock ? 'Completion points stay at 100 P and Points per hit at 50 P.' : p.items.map((i: any) => i.name + ' stays at ' + i.from).join(', ') + '.';
    confirm({
      title: 'Cancel the pending change?', body: '<p>' + summary + ' The announcement is withdrawn on chain. To change them later you propose again and wait another 48 hours.</p>', placeholder: 'Why is the change withdrawn?',
      signer: 'Signed and paid by the owner wallet ' + short(VM.owner || '') + '. The next step connects it.', danger: 1, action: 'Cancel the change', cancel: 'Keep it', done: 'Connect the owner wallet to withdraw the change.',
      run: CONFIG.mock ? undefined : async (why) => {
        setTimeout(() => ownerFlow({ title: 'Withdraw the pending change', body: '<p>' + esc(summary) + '</p>', owner: VM.owner, chainId, signTitle: 'Sign the cancellation', signText: 'One transaction to the prediction contract. The owner pays the network fee.', build: async () => (await api('/admin/v1/params', { body: { action: 'cancel' } })).unsignedTx, record: { action: 'params.cancel', target: why.slice(0, 100) }, sentText: () => '<b>Withdrawn.</b> The current values stay.', onDone: () => void inval() }), 0);
        return 'Connect the owner wallet to withdraw the change.';
      },
    });
  }
  function applyChange() {
    const p = VM.pending;
    const body = CONFIG.mock ? '<p>Completion points go from 100 P to 120 P and Points per hit from 50 P to 40 P for every answer set after the transaction confirms. Hits already waiting in a correction window are paid at the old value.</p>' : '<p>' + p.items.map((i: any) => esc(i.name) + ' goes from ' + esc(i.from) + ' to ' + esc(i.to)).join(', ') + ' once the transaction confirms. Hits already waiting in a correction window are paid at the old value.</p>';
    confirm({
      title: 'Apply the pending change?', reason: false, body, signer: 'Signed and paid by the owner wallet ' + short(VM.owner || '') + ', connected in this browser.', action: 'Connect the owner wallet', done: 'Waiting for the owner wallet.',
      run: CONFIG.mock ? undefined : async () => {
        setTimeout(() => ownerFlow({ title: 'Apply the pending change', body, owner: VM.owner, chainId, initial: 'connect', signTitle: 'Sign applyParams', signText: 'One transaction to the prediction contract.', build: async () => (await api('/admin/v1/params', { body: { action: 'apply' } })).unsignedTx, record: { action: 'params.apply' }, sentText: () => '<b>Applied.</b> The new values are live.', onDone: () => void inval() }), 0);
        return 'Waiting for the owner wallet.';
      },
    });
  }
  function withdraw(kind: string) {
    const isRes = kind === 'reserve';
    sheet({ title: isRes ? 'Withdraw from the prediction reserve' : 'Withdraw free staking rewards', wide: 1,
      body: '<p>' + (isRes ? 'The reserve pays conversions and the weekly airdrop. Leave enough for the next pool and the runway.' : 'Only the free rewards balance can leave; principal and interest already reserved for open stakes stay.') + '</p>' +
        '<div class="fl"><label for="wamt">Amount <span class="cnt">CT</span></label><input class="inp num" id="wamt" inputmode="decimal" autofocus placeholder="0"></div>' +
        kv([['To', addr(VM.treasury || VM.owner, { full: 1, link: false }) + ' <span class="dim">the treasury</span>']]) +
        '<div class="fl"><label for="wwhy">Reason <span class="cnt">Required, written to the audit log</span></label><textarea class="inp" id="wwhy" rows="2"></textarea></div><div data-run-err style="display:contents"></div>',
      action: btn('Continue to the owner wallet', { primary: 1, act: 'withdraw-go', arg: kind }) });
  }

  useActs({
    review: () => (CONFIG.mock ? go('review') : reviewSheet()),
    go: (s) => go(s || ''),
    discard: () => { if (CONFIG.mock) go('none'); else { setEdits({}); document.querySelectorAll<HTMLInputElement>('[data-param]').forEach((i) => { i.value = ''; i.classList.remove('changed'); }); document.querySelectorAll<HTMLInputElement>('[data-rate]').forEach((i) => { i.value = i.dataset.rate!; i.classList.remove('changed'); }); document.querySelectorAll<HTMLInputElement>('[data-split]').forEach((i, k) => { i.value = String(VM.split[k]); }); } },
    apply: applyChange,
    cancel: cancelChange,
    withdraw: (k) => withdraw(k || 'reserve'),
    'withdraw-go': (k) => {
      const amt = (document.getElementById('wamt') as HTMLInputElement).value.trim().replace(/,/g, ''), why = (document.getElementById('wwhy') as HTMLTextAreaElement).value.trim();
      const errBox = document.querySelector('#sheet [data-run-err]') as HTMLElement;
      if (!/^\d{1,12}(\.\d{1,18})?$/.test(amt) || Number(amt) <= 0) { errBox.innerHTML = '<p class="err" role="alert">' + ic('warn') + 'Enter an amount above 0.</p>'; return; }
      if (why.length < 8) { errBox.innerHTML = '<p class="err" role="alert">' + ic('warn') + 'Give a reason.</p>'; return; }
      closeSheet(true);
      const isRes = k === 'reserve';
      ownerFlow({ title: (isRes ? 'Withdraw ' : 'Withdraw rewards: ') + n(Number(amt), 2) + ' CT', body: kv([['Amount', n(Number(amt), 2) + ' CT'], ['From', isRes ? 'Prediction reserve' : 'Staking rewards fund'], ['Reason', esc(why)]]), owner: VM.owner, chainId, signTitle: 'Sign the withdrawal', signText: 'One transaction. The owner pays the network fee.',
        build: async () => (await api(isRes ? '/admin/v1/reserve/withdraw' : '/admin/v1/staking', { body: isRes ? { amountCt: amt, reason: why } : { action: 'withdrawRewards', amountCt: amt } })).unsignedTx,
        record: { action: isRes ? 'reserve.withdraw' : 'staking.withdrawRewards', target: amt + ' CT' }, sentText: () => '<b>Withdrawn.</b> ' + n(Number(amt), 2) + ' CT went to the treasury.', onDone: () => void inval() });
    },
  });

  const after = () => {
    if (!CONFIG.mock) return;
    if (document.getElementById('sheet')) return;
    if (is('review', 'connect', 'wrongwallet', 'signing', 'failed')) reviewSheet(state as FlowState);
    if (is('cancel')) cancelChange();
  };
  useEffect(() => { if (CONFIG.mock && D) after(); }, [state, D]);
  useEffect(() => { if (CONFIG.mock && is('signing')) { /* keep the design's static signing state: no auto completion */ } }, [state]);

  const sb = D && !is('loading', 'error') ? savebar(VM, CONFIG.mock && is('none', 'editing', 'invalid', 'review', 'connect', 'wrongwallet', 'signing', 'failed') ? presetEdit : edits) : '';
  return <Shell page="rewards" title="Reward settings" sub="Changes on chain are signed by the owner wallet and wait 48 hours" states={['none', 'editing', 'invalid', 'review', 'connect', 'wrongwallet', 'signing', 'failed', 'proposed', 'ready', 'cancel', 'loading', 'error']}
    html={html} loading={loading} error={!!error} updatedAt={updatedAt} onRefresh={() => void q.refetch()} after={() => { const slot = document.getElementById('savebar-slot'); if (slot && slot.innerHTML !== sb) slot.innerHTML = sb; }} />;
}
const EMPTY: any = { params: [], pending: null, split: [], stakingRates: { tiers: [], periods: [] }, stakingParams: [], staking: { total: 0, stakes: 0 }, week: { pool: 0 }, rank: [], owner: '', contracts: {} };
void toast;
