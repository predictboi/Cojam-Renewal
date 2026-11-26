// One sender loop per play key, guarded by navigator.locks so two windows of the app never sign competing nonces
// (DEV-PLAN 4.3). The loop wakes on a kick (a swipe, a flush, coming back online) or when the next window ends.
import { create } from 'zustand';
import type { OutboxItem } from '../db';
import { Outbox, type OutboxDeps } from './outbox';
import { shouldSurface } from './policy';

interface OutboxView { items: OutboxItem[]; paused: boolean; keyProblem: string | null }
export const useOutbox = create<OutboxView>(() => ({ items: [], paused: false, keyProblem: null }));

let box: Outbox | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let again = false;
let started = false;

export function outbox(): Outbox {
  if (!box) throw new Error('outbox not started');
  return box;
}
export const hasOutbox = () => !!box;

async function refresh() {
  if (!box) return;
  useOutbox.setState({ items: await box.all(), paused: box.isPaused });
}

export function startOutbox(deps: OutboxDeps): Outbox {
  if (box) return box;
  box = new Outbox({
    ...deps,
    onKeyProblem: (c) => { useOutbox.setState({ keyProblem: c }); deps.onKeyProblem?.(c); },
  });
  box.subscribe(() => { void refresh(); });
  void boot();
  return box;
}

async function boot() {
  if (started || !box) return;
  started = true;
  await box.startup();
  await refresh();
  window.addEventListener('online', kick);
  kick();
}

export function kick() {
  if (!box) return;
  if (timer) { clearTimeout(timer); timer = null; }
  if (running) { again = true; return; }
  void loop();
}

async function loop() {
  if (!box) return;
  running = true;
  const body = async () => {
    try {
      for (let i = 0; i < 20; i++) {
        if (!navigator.onLine) break;
        const r = await box!.step();
        if (r !== 'sent' && r !== 'done' && r !== 'failed' && r !== 'dropped') break;
      }
      if (navigator.onLine) await box!.poll();
    } catch (e) {
      console.warn('outbox loop', e);
    }
  };
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  const keyName = 'cojam-outbox:' + ((await box.all()).find((i) => i.signer)?.signer || 'device');
  if (locks?.request) await locks.request(keyName, body);
  else await body();
  running = false;
  if (again) { again = false; void loop(); return; }
  const wait = await box.nextWakeIn().catch(() => 1000);
  timer = setTimeout(() => void loop(), wait);
}

export async function resumeOutbox() {
  useOutbox.setState({ keyProblem: null });
  box?.resume();
  kick();
}

/** what Home shows for one market: the day progress segment and the pick bar */
export type PickView = 'held' | 'saving' | 'saved' | 'failed' | 'closed' | null;
export function viewOf(i: OutboxItem | undefined): PickView {
  if (!i) return null;
  if (i.state === 'held') return 'held';
  if (i.state === 'queued' || i.state === 'signing' || i.state === 'sent') return 'saving';
  if (i.state === 'mined' || i.state === 'done_elsewhere') return 'saved';
  return i.lastError === 'MARKET_CLOSED' ? 'closed' : 'failed';
}
/** "n picks are still being saved" after 3 attempts or 60 s (4.7) */
export function slowCount(items: OutboxItem[], now = Date.now()): number {
  return items.filter((i) => (i.state === 'queued' || i.state === 'sent') && shouldSurface(i.attempts, i.firstFailAt, now)).length;
}
