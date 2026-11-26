// Play key lifecycle in the running app (DEV-PLAN 4.2): renew when fewer than 7 days remain, re-authorise after
// PLAY_KEY_INVALID, detect "set up on another device" (and never take the key back on our own, which would ping pong
// between devices), and start the outbox with the right dependencies.
import { create } from 'zustand';
import { encodeFunctionData, decodeFunctionResult, type Address, type Hex } from 'viem';
import { CONFIG } from '../config';
import { t } from '../i18n';
import { toast } from './ui';
import { predictAbi } from '../chain/abi';
import { ensurePlayKey, mockOutboxDeps, realOutboxDeps } from '../chain/chain';
import { loadPlayKey, playKeyNeedsRenew } from '../chain/playKey';
import { resumeOutbox, startOutbox, kick, useOutbox } from '../chain/outbox/runner';
import { rpc } from '../chain/rpc';
import { useWalletStore } from '../wallet/wallet';
import type { AppConfig } from '../api/types';
import type { OutboxItem } from '../chain/db';
import { queryClient } from '../api';

export type PlayStatus = 'ok' | 'reconnect' | 'reconnectfail' | 'otherdevice' | 'frozen';
export const usePlay = create<{ status: PlayStatus; failed: OutboxItem[] }>(() => ({ status: 'ok', failed: [] }));

function onFailed(item: OutboxItem, closed: boolean) {
  usePlay.setState((s) => ({ failed: [...s.failed, item] }));
  if (!closed) toast(t('h.toast.fail', { n: item.slot + 1 }), { btn: t('common.retry'), key: 'fail-' + item.id });
}

async function keyOnChain(c: AppConfig, player: string): Promise<string | null> {
  const data = encodeFunctionData({ abi: predictAbi, functionName: 'playKeyOf', args: [player as Address] });
  const out = await rpc<Hex>(c.rpcUrl, 'eth_call', [{ to: c.contracts.predict, data }, 'latest']);
  const [key] = decodeFunctionResult({ abi: predictAbi, functionName: 'playKeyOf', data: out }) as readonly [string, bigint];
  return /^0x0{40}$/i.test(key) ? null : key;
}

let cfgRef: AppConfig | null = null;
async function onKeyProblem(code: string) {
  const player = useWalletStore.getState().address;
  if (!player || !cfgRef) return;
  const mine = await loadPlayKey();
  try {
    const onChain = await keyOnChain(cfgRef, player).catch(() => undefined);
    // replaced by another device: do not re-authorise on our own (4.2)
    if (code === 'PLAY_KEY_INVALID' && onChain && mine && onChain.toLowerCase() !== mine.address.toLowerCase()) { usePlay.setState({ status: 'otherdevice' }); return; }
    usePlay.setState({ status: 'reconnect' });
    await ensurePlayKey(player, { force: true });
    usePlay.setState({ status: 'ok' });
    await resumeOutbox();
  } catch (e) {
    console.warn('play key re-authorisation failed', e);
    usePlay.setState({ status: 'reconnectfail' });
  }
}

/** "Play on this device": take the key back on purpose (one Privy signature) */
export async function playHere() {
  const player = useWalletStore.getState().address; if (!player) return;
  usePlay.setState({ status: 'reconnect' });
  try { await ensurePlayKey(player, { force: true }); usePlay.setState({ status: 'ok' }); await resumeOutbox(); }
  catch { usePlay.setState({ status: 'reconnectfail' }); }
}
export async function retryReconnect() { await onKeyProblem('RETRY'); }

let started = false;
export function startPlay(c: AppConfig) {
  cfgRef = c;
  if (started) return;
  started = true;
  const deps = CONFIG.mockApi
    ? mockOutboxDeps(onFailed)
    : realOutboxDeps((code) => { void onKeyProblem(code); }, () => { usePlay.setState({ status: 'frozen' }); void queryClient.invalidateQueries({ queryKey: ['me'] }); }, onFailed);
  startOutbox(deps);
  // every mined pick refreshes today's set and the points (the completion reward lands with the fifth)
  let minedCount = 0;
  useOutbox.subscribe((s) => {
    const n = s.items.filter((i) => i.state === 'mined' || i.state === 'done_elsewhere').length;
    if (n !== minedCount) { minedCount = n; void queryClient.invalidateQueries({ queryKey: ['today'] }); void queryClient.invalidateQueries({ queryKey: ['wallet'] }); }
  });
  // silent renewal when fewer than 7 days remain (one Privy signature, no UI unless it fails)
  if (!CONFIG.mockApi) void (async () => {
    const k = await loadPlayKey();
    const player = useWalletStore.getState().address;
    if (k && player && playKeyNeedsRenew(k)) {
      try { await ensurePlayKey(player, { force: true }); kick(); } catch { usePlay.setState({ status: 'reconnectfail' }); }
    }
  })();
}
