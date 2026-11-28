// Minimal structured logger for the worker: one JSON line per event on stdout (Render collects it).
export type Level = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface Logger {
  debug(msg: string, data?: Record<string, unknown>): void;
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

function safe(data: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(data, (_k, v) => (typeof v === 'bigint' ? v.toString() : v instanceof Error ? v.message : v)));
}

export function createLogger(level: string = 'info', bindings: Record<string, unknown> = {}, write: (line: string) => void = (l) => process.stdout.write(l + '\n')): Logger {
  const min = ORDER[(level as Level) in ORDER ? (level as Level) : 'info'];
  const log = (lv: Level) => (msg: string, data: Record<string, unknown> = {}) => {
    if (ORDER[lv] < min) return;
    write(JSON.stringify({ t: new Date().toISOString(), level: lv, msg, ...bindings, ...safe(data) }));
  };
  return {
    debug: log('debug'),
    info: log('info'),
    warn: log('warn'),
    error: log('error'),
    child: (b) => createLogger(level, { ...bindings, ...b }, write),
  };
}

/** A logger that keeps lines in memory (tests). */
export function memoryLogger(): Logger & { lines: Record<string, unknown>[] } {
  const lines: Record<string, unknown>[] = [];
  const l = createLogger('debug', {}, (s) => lines.push(JSON.parse(s)));
  return Object.assign(l, { lines });
}

export const silentLogger: Logger = createLogger('error', {}, () => {});
