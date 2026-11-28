// Operator transaction sender (DEV-PLAN 6.1: the worker is the only holder of the operator key and of
// its nonce). One serialized queue: a transaction is simulated, signed, recorded, broadcast and
// waited for before the next one starts, so nonces never collide and a revert never burns a nonce.
//
// Every transaction gets one `worker_operator_txs` row (audit and crash recovery): the signed bytes
// are stored before broadcast, so after a restart `recover()` finds each unfinished row, checks its
// receipt and rebroadcasts it if the nonce is still open. A transaction without a receipt in time is
// rebroadcast, then replaced at the same nonce with a higher gas price (bounded by the cap).
//
// Kaia accepts legacy (type 0, EIP-155) transactions, as the swap keeper sends them, and type 2.
// Legacy is the default (`OPERATOR_TX_TYPE`).

import {
  BaseError,
  ContractFunctionRevertedError,
  encodeFunctionData,
  keccak256,
  type Abi,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
} from 'viem';
import type { PrivateKeyAccount } from 'viem/accounts';
import type { WDb } from './db.ts';
import type { Logger } from './log.ts';
import type { Address } from './chain.ts';

export interface SenderOptions {
  chainId: number;
  txType: 'legacy' | 'eip1559';
  maxGasPriceWei: bigint;
  gasMultiplierPct: number; // gas limit = estimate x pct / 100 + 10,000
  receiptTimeoutMs: number;
  receiptPollMs: number;
  rebroadcasts: number; // plain rebroadcasts before a gas price bump
  bumps: number; // gas price bumps (+20% each) before giving up
  minBalanceWei: bigint; // refuse to send below this balance
}

export const DEFAULT_SENDER_OPTIONS: Omit<SenderOptions, 'chainId'> = {
  txType: 'legacy',
  maxGasPriceWei: 50n * 10n ** 9n,
  gasMultiplierPct: 130,
  receiptTimeoutMs: 30_000,
  receiptPollMs: 1_000,
  rebroadcasts: 2,
  bumps: 3,
  minBalanceWei: 0n,
};

export interface SendRequest {
  job: string;
  to: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
  /** Hard cap on the gas limit (batches stay inside a block). */
  gasCap?: bigint;
}

export interface SendResult {
  id: number;
  hash: Hex;
  receipt: TransactionReceipt;
  gasUsed: bigint;
  feeWei: bigint;
}

/** The call would revert: nothing was signed and no nonce was used. `errorName` is the custom error. */
export class SimulationRevert extends Error {
  constructor(
    readonly errorName: string | null,
    message: string,
    readonly rowId: number,
  ) {
    super(message);
  }
}

/** A transaction was mined but reverted (rare: state changed between simulation and inclusion). */
export class MinedRevert extends Error {
  constructor(
    readonly hash: Hex,
    readonly rowId: number,
  ) {
    super(`transaction ${hash} reverted on chain`);
  }
}

/** Refused before sending (gas price above the cap, balance under the floor). Retry later. */
export class SendDeferred extends Error {}

function jsonArgs(args: readonly unknown[]): unknown {
  return JSON.parse(JSON.stringify(args, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
}

export function decodeRevert(e: unknown): { name: string | null; message: string } {
  if (e instanceof BaseError) {
    const rev = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    if (rev) return { name: rev.data?.errorName ?? rev.reason ?? null, message: rev.shortMessage };
    return { name: null, message: e.shortMessage };
  }
  return { name: null, message: (e as Error)?.message ?? String(e) };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class OperatorSender {
  private queue: Promise<unknown> = Promise.resolve();
  private nonce: number | null = null;
  readonly opts: SenderOptions;
  readonly address: Address;

  constructor(
    private client: PublicClient,
    private account: PrivateKeyAccount,
    private db: WDb,
    private log: Logger,
    opts: Partial<SenderOptions> & { chainId: number },
  ) {
    this.opts = { ...DEFAULT_SENDER_OPTIONS, ...opts };
    this.address = account.address.toLowerCase() as Address;
  }

  /** Runs `fn` after every earlier queued send has finished (success or failure). */
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Simulates, signs, sends and waits. Throws SimulationRevert, MinedRevert or SendDeferred. */
  send(req: SendRequest): Promise<SendResult> {
    return this.serial(() => this.sendNow(req));
  }

  /** Simulation only (no row, no nonce): the custom error name or null when the call would succeed. */
  async wouldRevert(req: Omit<SendRequest, 'job'>): Promise<string | null> {
    try {
      await this.client.simulateContract({ address: req.to, abi: req.abi, functionName: req.functionName, args: req.args, account: this.address } as never);
      return null;
    } catch (e) {
      return decodeRevert(e).name ?? 'revert';
    }
  }

  private async sendNow(req: SendRequest): Promise<SendResult> {
    const data = encodeFunctionData({ abi: req.abi, functionName: req.functionName, args: req.args } as never);
    const row = await this.db
      .insertInto('worker_operator_txs')
      .values({ job: req.job, target: req.to.toLowerCase(), method: req.functionName, args: JSON.stringify(jsonArgs(req.args)), calldata: data })
      .returning('id')
      .executeTakeFirstOrThrow();
    const id = row.id;
    const update = (set: Record<string, unknown>) =>
      this.db.updateTable('worker_operator_txs').set({ ...set, updated_at: new Date() }).where('id', '=', id).execute();

    // 1. Simulate from the operator: a revert costs nothing and is recorded with its custom error.
    let estimate: bigint;
    try {
      await this.client.simulateContract({ address: req.to, abi: req.abi, functionName: req.functionName, args: req.args, account: this.address } as never);
      estimate = await this.client.estimateGas({ account: this.address, to: req.to, data });
    } catch (e) {
      const { name, message } = decodeRevert(e);
      await update({ status: 'sim_reverted', error: message.slice(0, 500), error_name: name });
      throw new SimulationRevert(name, `${req.functionName} would revert: ${name ?? message}`, id);
    }

    // 2. Gas and balance.
    const gasPrice = await this.client.getGasPrice();
    if (gasPrice > this.opts.maxGasPriceWei) {
      await update({ status: 'failed', error: `gas price ${gasPrice} above cap ${this.opts.maxGasPriceWei}` });
      throw new SendDeferred(`network gas price ${gasPrice} above the cap`);
    }
    let gas = (estimate * BigInt(this.opts.gasMultiplierPct)) / 100n + 10_000n;
    if (req.gasCap && gas > req.gasCap) gas = req.gasCap;
    if (this.opts.minBalanceWei > 0n) {
      const bal = await this.client.getBalance({ address: this.address });
      if (bal < this.opts.minBalanceWei) {
        await update({ status: 'failed', error: `operator balance ${bal} below floor` });
        throw new SendDeferred('operator balance below the floor');
      }
    }

    // 3. Nonce (local, resynced from the chain when unknown or refused).
    if (this.nonce === null) this.nonce = await this.client.getTransactionCount({ address: this.address, blockTag: 'pending' });
    const nonce = this.nonce;

    let price = gasPrice;
    const replaced: string[] = [];
    for (let bump = 0; bump <= this.opts.bumps; bump++) {
      const raw = await this.sign({ to: req.to, data, nonce, gas, price });
      const hash = keccak256(raw);
      await update({
        status: 'signed',
        nonce,
        tx_type: this.opts.txType,
        gas_limit: gas.toString(),
        gas_price: price.toString(),
        tx_hash: hash,
        raw_tx: raw,
        replaced_hashes: JSON.stringify(replaced),
      });
      for (let attempt = 0; attempt <= this.opts.rebroadcasts; attempt++) {
        try {
          await this.client.sendRawTransaction({ serializedTransaction: raw });
        } catch (e) {
          const msg = ((e as Error).message ?? '').toLowerCase();
          if (msg.includes('nonce too low') || msg.includes('nonce is too low')) {
            // Someone (an earlier run) used this nonce: check whether it was ours, else resync.
            const prior = await this.findReceipt([hash, ...replaced]);
            if (prior) return this.finish(id, prior, update);
            this.nonce = null;
            await update({ status: 'failed', error: 'nonce too low, resynced' });
            throw new SendDeferred('nonce too low; nonce resynced, retry');
          }
          if (!(msg.includes('already known') || msg.includes('known transaction'))) {
            this.log.warn('sender: broadcast failed', { id, error: (e as Error).message.slice(0, 200) });
          }
        }
        if (attempt === 0) await update({ status: 'sent' });
        const rc = await this.waitReceipt([hash, ...replaced]);
        if (rc) {
          this.nonce = nonce + 1;
          return this.finish(id, rc, update);
        }
        this.log.warn('sender: no receipt yet, rebroadcasting', { id, hash, attempt });
      }
      replaced.push(hash);
      price = (price * 120n) / 100n;
      if (price > this.opts.maxGasPriceWei) break;
      this.log.warn('sender: replacing with a higher gas price', { id, nonce, price: price.toString() });
    }
    // Still nothing: leave the row 'sent' for recover(); the nonce is unknown now.
    this.nonce = null;
    await update({ error: 'no receipt after rebroadcasts and bumps', replaced_hashes: JSON.stringify(replaced) });
    throw new SendDeferred(`no receipt for operator tx ${id}`);
  }

  private async sign(t: { to: Address; data: Hex; nonce: number; gas: bigint; price: bigint }): Promise<Hex> {
    if (this.opts.txType === 'eip1559') {
      return this.account.signTransaction({
        type: 'eip1559',
        chainId: this.opts.chainId,
        nonce: t.nonce,
        gas: t.gas,
        maxFeePerGas: t.price,
        maxPriorityFeePerGas: t.price,
        to: t.to,
        data: t.data,
        value: 0n,
      });
    }
    return this.account.signTransaction({ type: 'legacy', chainId: this.opts.chainId, nonce: t.nonce, gas: t.gas, gasPrice: t.price, to: t.to, data: t.data, value: 0n });
  }

  private async findReceipt(hashes: string[]): Promise<TransactionReceipt | null> {
    for (const h of hashes) {
      try {
        const rc = await this.client.getTransactionReceipt({ hash: h as Hex });
        if (rc) return rc;
      } catch {
        /* not found */
      }
    }
    return null;
  }

  private async waitReceipt(hashes: string[]): Promise<TransactionReceipt | null> {
    const end = Date.now() + this.opts.receiptTimeoutMs;
    while (Date.now() < end) {
      const rc = await this.findReceipt(hashes);
      if (rc) return rc;
      await sleep(this.opts.receiptPollMs);
    }
    return null;
  }

  private async finish(id: number, rc: TransactionReceipt, update: (s: Record<string, unknown>) => Promise<unknown>): Promise<SendResult> {
    const fee = rc.gasUsed * (rc.effectiveGasPrice ?? 0n);
    const ok = rc.status === 'success';
    await update({ status: ok ? 'mined' : 'reverted', tx_hash: rc.transactionHash, gas_used: rc.gasUsed.toString(), fee_wei: fee.toString(), block: Number(rc.blockNumber), raw_tx: null });
    if (!ok) throw new MinedRevert(rc.transactionHash, id);
    return { id, hash: rc.transactionHash, receipt: rc, gasUsed: rc.gasUsed, feeWei: fee };
  }

  /**
   * After a restart: settle every row left 'signed' or 'sent'. A receipt marks it mined or reverted;
   * a nonce the chain already passed marks it dropped; otherwise the stored bytes are rebroadcast.
   */
  recover(): Promise<{ mined: number; dropped: number; rebroadcast: number }> {
    return this.serial(async () => {
      const rows = await this.db.selectFrom('worker_operator_txs').selectAll().where('status', 'in', ['signed', 'sent']).orderBy('id').execute();
      const out = { mined: 0, dropped: 0, rebroadcast: 0 };
      if (rows.length === 0) return out;
      const latest = await this.client.getTransactionCount({ address: this.address, blockTag: 'latest' });
      for (const r of rows) {
        const hashes = [r.tx_hash, ...((r.replaced_hashes as string[]) ?? [])].filter(Boolean) as string[];
        const rc = await this.findReceipt(hashes);
        const update = (set: Record<string, unknown>) => this.db.updateTable('worker_operator_txs').set({ ...set, updated_at: new Date() }).where('id', '=', r.id).execute();
        if (rc) {
          await this.finish(r.id, rc, update).catch(() => undefined);
          out.mined++;
        } else if (r.nonce !== null && r.nonce < latest) {
          await update({ status: 'dropped', error: 'nonce used by another transaction', raw_tx: null });
          out.dropped++;
        } else if (r.raw_tx) {
          try {
            await this.client.sendRawTransaction({ serializedTransaction: r.raw_tx as Hex });
          } catch (e) {
            this.log.warn('sender: rebroadcast on recover failed', { id: r.id, error: (e as Error).message.slice(0, 200) });
          }
          out.rebroadcast++;
        }
      }
      this.nonce = null;
      return out;
    });
  }
}
