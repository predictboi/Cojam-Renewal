'use strict';

// Usage store: rate limits, daily budget and the counters the admin page shows.
//
// Interface (every method may return a Promise, so a Redis version can drop in):
//   peek({ sender, ip, day })                           -> { senderCount, ipCount, spentWei }
//   reserve({ sender, ip, day, costWei, limits })       -> { ok: true, id } | { ok: false, code }
//       Atomic check and increment. limits = { sender, ip, budgetWei }.
//   release(id)                                         undo a reservation (broadcast failed)
//   commit(id, { txHash })                              the sponsored tx was broadcast
//   settle(id, { actualWei })                           replace the reserved cost with the real fee
//   recordKeeper({ day, costWei, users, lots })         gas the keeper spent on releases
//   stats(day)                                          counters for /api/gas-wallet
//
// A Redis version keeps the same keys: sp:{day}:sender:{addr}, sp:{day}:ip:{hash},
// sp:{day}:spent, sp:total:*, with INCR plus EXPIRE and a Lua script for reserve().

function utcDay(ms = Date.now()) {
  return new Date(ms).toISOString().slice(0, 10);
}

class MemoryUsageStore {
  constructor({ now = () => Date.now(), keepDays = 30 } = {}) {
    this.now = now;
    this.keepDays = keepDays;
    this.days = new Map(); // day -> { senders: Map, ips: Map, spentWei, sponsored, keeperWei, keeperTx, keeperLots }
    this.reservations = new Map();
    this.total = { sponsored: 0, spentWei: 0n, keeperWei: 0n, keeperTx: 0, keeperLots: 0 };
    this.startedAt = new Date(now()).toISOString();
    this.seq = 0;
  }

  _day(day) {
    let d = this.days.get(day);
    if (!d) {
      d = { senders: new Map(), ips: new Map(), spentWei: 0n, sponsored: 0, keeperWei: 0n, keeperTx: 0, keeperLots: 0 };
      this.days.set(day, d);
      this._prune();
    }
    return d;
  }

  _prune() {
    const keys = [...this.days.keys()].sort();
    while (keys.length > this.keepDays) this.days.delete(keys.shift());
  }

  peek({ sender, ip, day }) {
    const d = this._day(day);
    return {
      senderCount: d.senders.get(sender) || 0,
      ipCount: ip ? d.ips.get(ip) || 0 : 0,
      spentWei: d.spentWei + d.keeperWei,
    };
  }

  // Synchronous on purpose: check and increment happen in one tick, so two parallel
  // requests from the same sender cannot both pass the last free slot.
  reserve({ sender, ip, day, costWei, limits }) {
    const d = this._day(day);
    const s = d.senders.get(sender) || 0;
    const i = ip ? d.ips.get(ip) || 0 : 0;
    if (s >= limits.sender) return { ok: false, code: 'RATE_LIMITED_SENDER' };
    if (ip && i >= limits.ip) return { ok: false, code: 'RATE_LIMITED_IP' };
    if (d.spentWei + d.keeperWei + costWei > limits.budgetWei) return { ok: false, code: 'DAILY_BUDGET_EXHAUSTED' };
    d.senders.set(sender, s + 1);
    if (ip) d.ips.set(ip, i + 1);
    d.spentWei += costWei;
    const id = `r${++this.seq}`;
    this.reservations.set(id, { day, sender, ip, costWei, state: 'reserved' });
    return { ok: true, id };
  }

  release(id) {
    const r = this.reservations.get(id);
    if (!r || r.state !== 'reserved') return;
    const d = this._day(r.day);
    d.senders.set(r.sender, Math.max(0, (d.senders.get(r.sender) || 1) - 1));
    if (r.ip) d.ips.set(r.ip, Math.max(0, (d.ips.get(r.ip) || 1) - 1));
    d.spentWei -= r.costWei;
    this.reservations.delete(id);
  }

  commit(id, { txHash } = {}) {
    const r = this.reservations.get(id);
    if (!r || r.state !== 'reserved') return;
    r.state = 'committed';
    r.txHash = txHash;
    const d = this._day(r.day);
    d.sponsored += 1;
    this.total.sponsored += 1;
    this.total.spentWei += r.costWei;
  }

  settle(id, { actualWei }) {
    const r = this.reservations.get(id);
    if (!r || r.state !== 'committed') return;
    const delta = actualWei - r.costWei;
    const d = this._day(r.day);
    d.spentWei += delta;
    this.total.spentWei += delta;
    r.costWei = actualWei;
    r.state = 'settled';
    this.reservations.delete(id);
  }

  recordKeeper({ day, costWei, lots = 0 }) {
    const d = this._day(day);
    d.keeperWei += costWei;
    d.keeperTx += 1;
    d.keeperLots += lots;
    this.total.keeperWei += costWei;
    this.total.keeperTx += 1;
    this.total.keeperLots += lots;
  }

  stats(day) {
    const d = this._day(day);
    const history = [...this.days.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => ({ day: k, spentWei: v.spentWei + v.keeperWei, sponsored: v.sponsored }));
    return {
      countersSince: this.startedAt,
      today: {
        day,
        sponsored: d.sponsored,
        sponsoredSpentWei: d.spentWei,
        keeperTx: d.keeperTx,
        keeperLots: d.keeperLots,
        keeperSpentWei: d.keeperWei,
      },
      total: { ...this.total },
      history,
    };
  }
}

module.exports = { MemoryUsageStore, utcDay };
