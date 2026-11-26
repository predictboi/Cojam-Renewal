// Alerts (DEV-PLAN 6.6). Jobs and monitors call `raise` with a stable key for a standing condition;
// while an alert with that key is open it is counted, not repeated, and `resolve` closes it when the
// condition clears. A delivery loop sends new alerts through an `AlertSink`. Telegram and email are
// behind that interface: `TelegramSink` is a thin sender (untested against the real Bot API), email
// is a stub that logs, and the default sink only logs.

import { sql } from 'kysely';
import type { AlertSeverity, WDb } from './db.ts';
import type { Logger } from './log.ts';

export interface AlertMessage {
  id: number;
  key: string;
  severity: AlertSeverity;
  title: string;
  body: string | null;
  count: number;
}

export interface AlertSink {
  readonly name: string;
  send(a: AlertMessage): Promise<void>;
}

export class LogSink implements AlertSink {
  readonly name = 'log';
  constructor(private log: Logger) {}
  async send(a: AlertMessage): Promise<void> {
    this.log[a.severity === 'critical' ? 'error' : a.severity === 'warn' ? 'warn' : 'info'](`alert: ${a.title}`, { key: a.key, body: a.body, count: a.count });
  }
}

export class TelegramSink implements AlertSink {
  readonly name = 'telegram';
  constructor(
    private botToken: string,
    private chatId: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}
  async send(a: AlertMessage): Promise<void> {
    const icon = a.severity === 'critical' ? '[CRITICAL]' : a.severity === 'warn' ? '[WARN]' : '[INFO]';
    const text = `${icon} ${a.title}${a.body ? `\n${a.body}` : ''}${a.count > 1 ? `\n(seen ${a.count} times)` : ''}`;
    const res = await this.fetchImpl(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: this.chatId, text: text.slice(0, 4000), disable_web_page_preview: true }),
    });
    if (!res.ok) throw new Error(`telegram ${res.status}`);
  }
}

/** Email delivery is not wired yet (no mail provider chosen): logs what it would send. */
export class EmailStubSink implements AlertSink {
  readonly name = 'email-stub';
  constructor(
    private to: string,
    private log: Logger,
  ) {}
  async send(a: AlertMessage): Promise<void> {
    this.log.info('alert email (stub, not sent)', { to: this.to, title: a.title, severity: a.severity });
  }
}

export class Alerts {
  constructor(
    private db: WDb,
    private log: Logger,
    private sinks: AlertSink[],
  ) {}

  /** Opens (or counts) the alert `key`. Returns the alert id. */
  async raise(key: string, severity: AlertSeverity, title: string, body?: string, details?: unknown): Promise<number> {
    const existing = await this.db
      .updateTable('worker_alerts')
      .set({ count: sql`count + 1`, last_seen_at: new Date(), ...(body ? { body } : {}) })
      .where('key', '=', key)
      .where('resolved_at', 'is', null)
      .returning('id')
      .executeTakeFirst();
    if (existing) return existing.id;
    const row = await this.db
      .insertInto('worker_alerts')
      .values({ key, severity, title, body: body ?? null, details: details === undefined ? null : JSON.stringify(details) })
      .onConflict((oc) => oc.column('key').where('resolved_at', 'is', null).doUpdateSet({ count: sql`worker_alerts.count + 1`, last_seen_at: new Date() }))
      .returning('id')
      .executeTakeFirstOrThrow();
    this.log.warn(`alert raised: ${title}`, { key, severity });
    return row.id;
  }

  /** Closes the open alert `key`, if any. */
  async resolve(key: string): Promise<void> {
    await this.db.updateTable('worker_alerts').set({ resolved_at: new Date() }).where('key', '=', key).where('resolved_at', 'is', null).execute();
  }

  /** Sends undelivered alerts through every sink. A sink failure leaves the alert for the next round. */
  async deliver(): Promise<number> {
    const rows = await this.db
      .selectFrom('worker_alerts')
      .select(['id', 'key', 'severity', 'title', 'body', 'count'])
      .where('delivered_at', 'is', null)
      .orderBy('id')
      .limit(50)
      .execute();
    let sent = 0;
    for (const r of rows) {
      try {
        for (const s of this.sinks) await s.send(r);
        await this.db.updateTable('worker_alerts').set({ delivered_at: new Date() }).where('id', '=', r.id).execute();
        sent++;
      } catch (e) {
        this.log.warn('alert delivery failed, will retry', { id: r.id, error: (e as Error).message });
        break;
      }
    }
    return sent;
  }
}
