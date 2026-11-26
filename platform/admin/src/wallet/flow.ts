// The owner signing sheet (design: Reward settings review, Answers "Review and sign"): connect the master wallet in
// this browser, check it is the owner and on the right chain, sign, then show the hash. Built on the same sheet as
// every confirmation. In mock mode the wallet step is simulated so every design state can be walked.
import type { Address, Hex } from 'viem';
import { CONFIG } from '../config';
import { X, addr, btn, esc, ic, note, short } from '../lib/x';
import { acts, closeSheet, sheet, toast } from '../lib/ui';
import { api } from '../api/client';
import { connectOwner, discoverWallets, sendOwnerTx, waitReceipt, WalletError, type UnsignedTx, type WalletChoice } from './owner';

export type FlowState = 'review' | 'connect' | 'wrongwallet' | 'signing' | 'failed' | 'sent' | 'done';
export interface OwnerFlow {
  title: string;
  /** above the steps: what changes (a diff table, a kv list) */
  body: string;
  owner: Address;
  chainId: number;
  /** step 2 title and copy */
  signTitle?: string;
  signText: string;
  signingText?: string;
  /** later steps shown after signing (e.g. "Wait 48 hours", "Apply") */
  later?: [string, string][];
  cancel?: string;
  /** builds the unsigned transaction (the admin API call); runs when the owner presses Sign */
  build: () => Promise<UnsignedTx | UnsignedTx[]>;
  /** audit record of the sent hash (POST /admin/v1/owner-tx) */
  record?: { action: string; target?: string };
  /** after the wallet accepted: the message under the hash */
  sentText?: (hash: Hex) => string;
  onDone?: (hash: Hex) => void;
  initial?: FlowState;
  /** shown in failed state */
  error?: string;
  /** shown in wrongwallet state (mock preset) */
  wrongText?: string;
}

const MOCK_WALLETS = ['Kaia Wallet', 'MetaMask'];

export function ownerFlow(f: OwnerFlow) {
  let st: FlowState = f.initial || 'review';
  let wallets: WalletChoice[] = [];
  let wallet: WalletChoice | null = null;
  let account: Address | null = null;
  let wrong = f.wrongText || '';
  let err = f.error || '';
  let hash: Hex | null = null;

  const step = (i: number, t1: string, t2: string, s: 'done' | 'now' | 'wait', end = '') =>
    '<li data-s="' + s + '"><span class="nb" data-k="' + (s === 'done' ? 'ink' : s === 'now' ? '' : 'off') + '">' + (s === 'done' ? ic('check', 14) : i) + '</span><div><p class="t1">' + t1 + '</p><p class="t2">' + t2 + '</p></div>' + end + '</li>';

  function render() {
    const s1 = st === 'review' || st === 'failed' || st === 'connect' || st === 'wrongwallet' ? 'now' : 'done';
    const s2 = st === 'signing' ? 'now' : st === 'sent' || st === 'done' ? 'done' : 'wait';
    const who = account || f.owner;
    const connectUI = st === 'connect'
      ? '<div class="acts">' + (CONFIG.mock ? MOCK_WALLETS.map((w) => btn(w, { act: 'flow-wallet', arg: w })).join('') : wallets.length ? wallets.map((w) => btn((w.icon ? '<img src="' + esc(w.icon) + '" alt="" width="16" height="16">' : '') + esc(w.name), { act: 'flow-wallet', arg: w.id })).join('') : '<p class="err" role="alert">' + ic('warn') + 'No browser wallet was found. Install or unlock Kaia Wallet or MetaMask in this browser, then press Connect again.</p>') + '</div>'
      : '';
    let steps = '<ol class="steps">' +
      step(1, 'Connect the owner wallet', s1 === 'done' ? 'Connected: ' + addr(who, { link: false }) : 'It must be the master wallet ' + addr(f.owner, { full: 1, link: false }) + '. It is connected in this browser for this one signature.', s1) +
      (connectUI ? '<li style="padding-top:0;border-top:0"><span></span>' + connectUI + '</li>' : '') +
      (st === 'wrongwallet' ? '<li style="padding-top:0;border-top:0"><span></span><p class="err" role="alert">' + ic('warn') + esc(wrong) + '</p></li>' : '') +
      step(2, f.signTitle || 'Sign the transaction', st === 'signing' ? (f.signingText || 'Confirm in the wallet. The owner pays the network fee.') : st === 'sent' || st === 'done' ? 'Sent ' + (hash ? addr(hash) : '') + (st === 'sent' ? ' Waiting for the block.' : ' Confirmed on chain.') : f.signText, s2, st === 'signing' || st === 'sent' ? '<span class="spin" aria-label="Waiting for the wallet"></span>' : '');
    (f.later || []).forEach((l, i) => { steps += step(3 + i, l[0], l[1], st === 'done' && i === 0 ? 'now' : 'wait'); });
    steps += '</ol>';
    const action = st === 'review' || st === 'failed' ? btn('Connect the owner wallet', { primary: 1, act: 'flow-go', arg: 'connect' })
      : st === 'wrongwallet' ? btn('Connect again', { primary: 1, act: 'flow-go', arg: 'connect' })
      : st === 'signing' ? '<button type="button" class="btn btn-primary is-busy" disabled><span class="spin"></span>Waiting for the wallet</button>'
      : st === 'sent' ? '<button type="button" class="btn btn-primary is-busy" disabled><span class="spin"></span>Waiting for the block</button>'
      : st === 'done' ? btn('Done', { primary: 1, act: 'flow-close' }) : '';
    const top = (st === 'failed' ? note('down', '<b>Not saved: ' + esc(err || 'the wallet rejected the request.') + '</b> Nothing changed.') : '') +
      (st === 'done' && f.sentText && hash ? note('up', f.sentText(hash)) + '<div style="height:12px"></div>' : '');
    sheet({ title: f.title, wide: 1, sticky: st === 'signing' || st === 'sent', cancel: st === 'signing' ? 'Cancel signing' : st === 'done' ? false : f.cancel || 'Back', body: top + f.body + steps, action });
  }

  async function pick(id: string) {
    if (CONFIG.mock) {
      st = 'signing'; render();
      setTimeout(() => { if (document.getElementById('sheet')) { hash = ('0x' + 'ab'.repeat(32)) as Hex; st = 'done'; render(); f.onDone?.(hash); } }, 1200);
      return;
    }
    wallet = wallets.find((w) => w.id === id) || null;
    if (!wallet) return;
    try {
      account = await connectOwner(wallet, f.owner);
      st = 'signing'; render();
      const built = await f.build();
      const list = Array.isArray(built) ? built : [built];
      for (let i = 0; i < list.length; i++) {
        const tx = list[i];
        if (i > 0) { st = 'signing'; render(); }
        hash = await sendOwnerTx(wallet, account, tx);
        st = 'sent'; render();
        if (f.record) api('/admin/v1/owner-tx', { body: { action: f.record.action, target: f.record.target, txHash: hash, from: account, note: tx.description.slice(0, 500) } }).catch(() => toast('The hash was sent but not written to the audit log. Copy it from the wallet.'));
        try { await waitReceipt(wallet, tx.chainId, hash); }
        catch (e) { err = (e as Error).message; st = 'failed'; render(); return; }
      }
      st = 'done'; render(); if (hash) f.onDone?.(hash);
    } catch (e) {
      if (e instanceof WalletError && e.code === 'WRONG_ACCOUNT') { wrong = 'The connected wallet is ' + (e.detail ? short(e.detail) : 'another account') + ', not the owner. Switch to the owner account in the wallet, then connect again.'; st = 'wrongwallet'; }
      else { err = e instanceof WalletError ? e.message : (e as { message?: string }).message || 'The request failed.'; st = 'failed'; }
      render();
    }
  }

  acts['flow-go'] = async (s) => {
    if (s === 'connect') {
      if (!CONFIG.mock) wallets = await discoverWallets();
      st = 'connect';
      // one wallet only: connect it straight away
      if (!CONFIG.mock && wallets.length === 1) { render(); void pick(wallets[0].id); return; }
      render();
    }
  };
  acts['flow-wallet'] = (id) => void pick(id || '');
  acts['flow-close'] = () => closeSheet();
  if (st === 'connect' && !CONFIG.mock) void discoverWallets().then((w) => { wallets = w; render(); }); else render();
  return { rerender: render, role: X.role };
}
