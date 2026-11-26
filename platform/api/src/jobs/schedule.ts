// The worker's schedule (UTC). DEV-PLAN 6.4 adapted to one common close per day (09:00 KST next day).
// Loops (sub minute) run in process; everything else is a pg-boss cron job on its own queue, so runs
// are durable, visible in SQL (pgboss schema) and never overlap (one active job per queue).

import { dayIdOf, weekOf } from '../../../shared/src/time.ts';
import { draftJob, imagesJob } from './ai.ts';
import { compensationSweep } from './compensation.ts';
import type { JobContext } from './context.ts';
import { correctionCheck, expirySweep, publishDay, resolutionSweep, settleSweep } from './markets.ts';
import { runMonitors } from './monitors.ts';
import { riskCheck } from '../risk/check.ts';
import { closeWeek, runAirdrop } from './weekly.ts';

export interface CronJob {
  name: string;
  cron: string;
  what: string;
  run: (ctx: JobContext) => Promise<unknown>;
}

export const CRON_JOBS: CronJob[] = [
  { name: 'draft', cron: '0 2,8 * * *', what: 'Draft and validate candidates for D+1..D+horizon, select 5, prepare images (02:00, catch up 08:00)', run: draftJob },
  { name: 'images', cron: '30 3 * * *', what: 'Images for scheduled questions still pending', run: imagesJob },
  {
    name: 'publish',
    cron: '0,15,30,45 12-23 * * *',
    what: 'createDay for tomorrow from 12:00, every 15 min until mined; reserve fill at 22:00; alert from 18:00',
    run: (ctx) => publishDay(ctx, dayIdOf(ctx.now()) + 1),
  },
  {
    name: 'publish-late',
    cron: '*/15 * * * *',
    what: 'Safety net: createDay for today if it is still missing (accepted until 1 hour before the day ends)',
    run: (ctx) => publishDay(ctx, dayIdOf(ctx.now())),
  },
  { name: 'resolution', cron: '*/5 * * * *', what: 'Resolution sweep: markets past resolvesAt without an outcome', run: resolutionSweep },
  { name: 'settle', cron: '*/10 * * * *', what: 'settleMany for players with ready, unsettled slots', run: settleSweep },
  { name: 'expiry', cron: '*/10 * * * *', what: 'voidExpired for markets past dayEnd + 48 h', run: expirySweep },
  { name: 'correction', cron: '*/15 * * * *', what: 'Re-check answers inside the settle window', run: correctionCheck },
  { name: 'compensation', cron: '*/10 * * * *', what: 'compensate batches for markets with a corrected outcome', run: (ctx) => compensationSweep(ctx) },
  { name: 'week-close', cron: '5 0 * * 1', what: 'Close the week that just ended in the index', run: (ctx) => closeWeek(ctx, weekOf(dayIdOf(ctx.now())) - 1) },
  {
    name: 'airdrop',
    cron: '*/15 * * * *',
    what: 'Airdrop of the last ended week once weekEnd + airdropDelay passed (Wed 12:00 UTC) and the backlog is empty',
    run: (ctx) => runAirdrop(ctx, weekOf(dayIdOf(ctx.now())) - 1),
  },
  { name: 'risk', cron: '0 * * * *', what: 'Hourly risk check over accounts active in 14 days', run: (ctx) => riskCheck(ctx, { run: 'hourly' }) },
  { name: 'monitors', cron: '* * * * *', what: 'Snapshots for the API and alert conditions', run: runMonitors },
];

/** Queue for sign up risk checks sent by the API or the registration loop: data { wallets: string[] }. */
export const RISK_SIGNUP_QUEUE = 'risk-signup';

export const LOOPS = {
  indexerMs: 2_000,
  registrationMs: 10_000,
  freezesMs: 10_000,
  requestsMs: 10_000,
  alertsMs: 30_000,
};
