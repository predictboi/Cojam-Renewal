import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { CojamDb, type OutboxItem } from '../src/chain/db';
import { Outbox, type OutboxDeps } from '../src/chain/outbox/outbox';

const HOUR = 3600_000;
let seq = 0;

/** A fake chain and fee payer: records what is sent, can be told to fail. */
function harness(opts: { pending?: number } = {}) {
  const db = new CojamDb('t' + ++seq);
  let now = 1_000_000;
  const chain = { pending: opts.pending ?? 0, choices: {} as Record<string, number>, sent: [] as { raw: string; nonce: number }[] };
  const failures: { code: string; status?: number; txHash?: string }[] = [];
  let key: { address: string } | null = { address: '0xkey1' };
  const events = { key: [] as string[], frozen: 0, failed: [] as OutboxItem[] };
  const receipts: Record<string, { status: number } | null> = {};
  const deps: OutboxDeps = {
    db, now: () => now, rand: () => 0.5,
    key: async () => key,
    pendingNonce: async () => chain.pending,
    sign: async (item, nonce, k) => JSON.stringify({ m: item.marketId, c: item.choice, nonce, k }),
    sponsor: async (raw) => {
      const f = failures.shift();
      if (f) throw f;
      const p = JSON.parse(raw);
      chain.sent.push({ raw, nonce: p.nonce });
      const hash = '0xh' + p.m + '-' + p.nonce;
      receipts[hash] = null;
      return { txHash: hash };
    },
    receipt: async (h) => receipts[h] ?? null,
    readChoice: async (i) => (chain.choices[i.marketId] || 0) as 0 | 1 | 2,
    resend: async () => {},
    onKeyProblem: (c) => events.key.push(c),
    onFrozen: () => { events.frozen++; },
    onFailed: (i) => events.failed.push(i),
  };
  const box = new Outbox(deps);
  const mine = (hash: string, status = 1) => {
    receipts[hash] = { status };
    if (status === 1) { const [m] = hash.slice(3).split('-'); chain.pending++; chain.choices[m] = 1; }
  };
  return { db, box, chain, failures, events, mine, receipts, tick: (ms: number) => { now += ms; }, setKey: (k: typeof key) => { key = k; }, get now() { return now; } };
}
const pick = (m: number, closesIn = 10 * HOUR, now = 1_000_000) => ({ marketId: String(m), dayId: 1, slot: m % 5, choice: 1 as const, closesAt: now + closesIn, player: '0xPlayer' });
const states = async (h: ReturnType<typeof harness>) => (await h.box.all()).map((i) => i.state);

describe('outbox: hold, Undo, flush (4.3.1)', () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => { h = harness(); });

  it('a swipe is held for 3 s: nothing is signed or sent while held', async () => {
    await h.box.commit(pick(1));
    expect(await states(h)).toEqual(['held']);
    expect(await h.box.step()).toBe('held');
    expect(h.chain.sent).toHaveLength(0);
    h.tick(2999);
    expect(await h.box.step()).toBe('held');
    h.tick(1);
    expect(await h.box.step()).toBe('sent');
    expect(h.chain.sent.map((s) => s.nonce)).toEqual([0]);
  });

  it('the same market cannot be committed twice (idempotency key)', async () => {
    expect(await h.box.commit(pick(1))).not.toBeNull();
    expect(await h.box.commit(pick(1))).toBeNull();
    expect(await h.box.all()).toHaveLength(1);
  });

  it('Undo deletes the newest held pick only, and the market can be picked again', async () => {
    await h.box.commit(pick(1)); h.tick(500);
    await h.box.commit(pick(2)); h.tick(500);
    const u = await h.box.undo();
    expect(u?.marketId).toBe('2');
    expect((await h.box.all()).map((i) => i.marketId)).toEqual(['1']);
    expect(await h.box.commit(pick(2))).not.toBeNull();
  });

  it('Undo loses the race once the window is over (conditional on state held)', async () => {
    await h.box.commit(pick(1));
    h.tick(3000);
    await h.box.promoteDue();
    expect(await h.box.undo()).toBeNull();
    expect(await states(h)).toEqual(['queued']);
  });

  it('Finish now flushes every held pick, which then go out in commit order with consecutive nonces', async () => {
    for (let m = 1; m <= 5; m++) { await h.box.commit(pick(m)); h.tick(200); }
    expect(await h.box.flush()).toBe(5);
    for (let i = 0; i < 5; i++) expect(await h.box.step()).toBe('sent');
    expect(h.chain.sent.map((s) => [JSON.parse(s.raw).m, s.nonce])).toEqual([['1', 0], ['2', 1], ['3', 2], ['4', 3], ['5', 4]]);
    expect(await h.box.step()).toBe('idle');
  });

  it('an older held pick is never overtaken by a newer queued one', async () => {
    await h.box.commit(pick(1));                 // held for 3 s
    await h.box.commit(pick(2, 10_000));         // closes within 15 s: queued at once, no hold
    expect(await states(h)).toEqual(['held', 'queued']);
    expect(await h.box.step()).toBe('held');
    expect(h.chain.sent).toHaveLength(0);
  });

  it('a held item survives a restart and is promoted to queued (the player did not undo it)', async () => {
    await h.box.commit(pick(1));
    const again = new Outbox({ ...(h.box as unknown as { d: OutboxDeps }).d });
    await again.startup();
    expect(await states(h)).toEqual(['queued']);
  });
});

describe('outbox: nonces and failures (4.4, 4.7)', () => {
  it('starts at the account pending nonce and remembers the last used one', async () => {
    const h = harness({ pending: 7 });
    await h.box.commit(pick(1)); await h.box.commit(pick(2));
    await h.box.flush();
    await h.box.step(); await h.box.step();
    expect(h.chain.sent.map((s) => s.nonce)).toEqual([7, 8]); // the node still says 7 for the second
  });

  it('a refusal before broadcast keeps the nonce for the retry, with back off', async () => {
    const h = harness();
    h.failures.push({ code: 'RATE_LIMITED_BURST', status: 429 });
    await h.box.commit(pick(1)); await h.box.flush();
    expect(await h.box.step()).toBe('backoff');
    let it = (await h.box.all())[0];
    expect(it.state).toBe('queued');
    expect(it.attempts).toBe(1);
    expect(it.nextTryAt! - h.now).toBe(1000);
    expect(await h.box.step()).toBe('backoff');  // not before nextTryAt
    h.tick(1000);
    expect(await h.box.step()).toBe('sent');
    expect(h.chain.sent.map((s) => s.nonce)).toEqual([0]);
    it = (await h.box.all())[0];
    expect(it.state).toBe('sent');
  });

  it('before a retry it reads the chain: a pick already stored is done', async () => {
    const h = harness();
    h.failures.push({ code: 'NETWORK' });
    await h.box.commit(pick(1)); await h.box.flush();
    await h.box.step();
    h.chain.choices['1'] = 1;
    h.tick(2000);
    expect(await h.box.step()).toBe('done');
    expect(await states(h)).toEqual(['done_elsewhere']);
    expect(h.chain.sent).toHaveLength(0);
  });

  it('ALREADY_DONE ends the item as done elsewhere without using the nonce', async () => {
    const h = harness();
    h.failures.push({ code: 'ALREADY_DONE' });
    await h.box.commit(pick(1)); await h.box.commit(pick(2)); await h.box.flush();
    expect(await h.box.step()).toBe('done');
    expect(await h.box.step()).toBe('sent');
    expect(h.chain.sent.map((s) => s.nonce)).toEqual([0]); // the second pick reused nonce 0
  });

  it('PLAY_KEY_INVALID pauses the loop, and after a new key the pick is signed by it from its own nonce', async () => {
    const h = harness();
    h.failures.push({ code: 'PLAY_KEY_INVALID' });
    await h.box.commit(pick(1)); await h.box.flush();
    expect(await h.box.step()).toBe('paused');
    expect(h.events.key).toEqual(['PLAY_KEY_INVALID']);
    expect(await h.box.step()).toBe('paused');
    h.setKey({ address: '0xkey2' }); h.chain.pending = 0;
    h.box.resume();
    expect(await h.box.step()).toBe('sent');
    expect(JSON.parse(h.chain.sent[0].raw).k).toBe('0xkey2');
  });

  it('no key on the device pauses before signing', async () => {
    const h = harness();
    h.setKey(null);
    await h.box.commit(pick(1)); await h.box.flush();
    expect(await h.box.step()).toBe('paused');
    expect(h.events.key).toEqual(['NO_KEY']);
  });

  it('a non retryable code fails the pick and the loop moves on', async () => {
    const h = harness();
    h.failures.push({ code: 'MARKET_CLOSED' });
    await h.box.commit(pick(1)); await h.box.commit(pick(2)); await h.box.flush();
    expect(await h.box.step()).toBe('failed');
    expect(h.events.failed).toHaveLength(1);
    expect(await h.box.step()).toBe('sent');
    expect(h.chain.sent.map((s) => s.nonce)).toEqual([0]);
  });

  it('a pick that cannot reach the chain before its market closes is dropped as not counted', async () => {
    const h = harness();
    h.failures.push({ code: 'NETWORK' });
    await h.box.commit(pick(1, 20_000)); await h.box.flush();
    await h.box.step();
    h.tick(25_000);
    expect(await h.box.step()).toBe('failed');
    expect((await h.box.all())[0].lastError).toBe('MARKET_CLOSED');
  });

  it('sponsorship down waits 60 s and retries', async () => {
    const h = harness();
    h.failures.push({ code: 'FEE_PAYER_BALANCE_LOW' });
    await h.box.commit(pick(1)); await h.box.flush();
    expect(await h.box.step()).toBe('backoff');
    expect((await h.box.all())[0].nextTryAt! - h.now).toBe(60_000);
  });

  it('FROZEN drops held and queued picks and stops', async () => {
    const h = harness();
    h.failures.push({ code: 'FROZEN' });
    await h.box.commit(pick(1)); await h.box.commit(pick(2)); await h.box.commit(pick(3));
    await h.box.promoteDue(); await h.box.flush();
    expect(await h.box.step()).toBe('frozen');
    expect(h.events.frozen).toBe(1);
    expect(await h.box.all()).toHaveLength(0);
    expect(await h.box.step()).toBe('paused');
  });

  it('BROADCAST_UNCERTAIN pauses the loop until the account nonce moves', async () => {
    const h = harness();
    h.failures.push({ code: 'BROADCAST_UNCERTAIN', txHash: '0xu' });
    await h.box.commit(pick(1)); await h.box.commit(pick(2)); await h.box.flush();
    expect(await h.box.step()).toBe('waiting');
    expect(await h.box.step()).toBe('waiting');
    h.chain.pending = 1;
    await h.box.poll();
    expect(await h.box.step()).toBe('sent');
    expect(h.chain.sent.map((s) => s.nonce)).toEqual([1]);
  });

  it('poll marks mined from receipts; a revert with the choice not stored is re-queued for a new nonce', async () => {
    const h = harness();
    await h.box.commit(pick(1)); await h.box.commit(pick(2)); await h.box.flush();
    await h.box.step(); await h.box.step();
    h.mine('0xh1-0');
    h.receipts['0xh2-1'] = { status: 0 };
    await h.box.poll();
    const [a, b] = await h.box.all();
    expect(a.state).toBe('mined');
    expect(b.state).toBe('queued');
    expect(b.nonce).toBeUndefined();
  });

  it('a send that is not mined after 90 s is re-signed with the same nonce', async () => {
    const h = harness();
    await h.box.commit(pick(1)); await h.box.flush();
    await h.box.step();
    h.tick(91_000);
    await h.box.poll();
    expect((await h.box.all())[0].state).toBe('queued');
    h.chain.pending = 5; // even if the node now says something else, the same nonce is kept
    expect(await h.box.step()).toBe('sent');
    expect(h.chain.sent.map((s) => s.nonce)).toEqual([0, 0]);
  });
});
