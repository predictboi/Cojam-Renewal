// Keeps the last console warnings and errors (and uncaught errors) so a tester on a phone, with no
// console, can see them on screen and send them in the report. Privy logs the real cause of a failed
// wallet request with console.error and then throws a generic "Disconnected" error.

export interface LogLine {
  at: string;
  level: 'error' | 'warn';
  text: string;
}

const lines: LogLine[] = [];
const listeners = new Set<() => void>();
const MAX = 60;

function fmt(a: unknown): string {
  if (a instanceof Error) return `${a.name}: ${a.message}${(a as { code?: unknown }).code !== undefined ? ` (code ${(a as { code?: unknown }).code})` : ''}`;
  if (typeof a === 'string') return a;
  try {
    return JSON.stringify(a, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
  } catch {
    return String(a);
  }
}

function push(level: LogLine['level'], args: unknown[]) {
  const text = args.map(fmt).join(' ').slice(0, 1200);
  // Never keep anything that looks like a 32 byte private key.
  const safe = text.replace(/0x[0-9a-fA-F]{64}(?![0-9a-fA-F])/g, (m) => m.slice(0, 10) + '…');
  lines.push({ at: new Date().toISOString(), level, text: safe });
  if (lines.length > MAX) lines.shift();
  listeners.forEach((l) => l());
}

export function installConsoleCapture() {
  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  console.error = (...a: unknown[]) => {
    push('error', a);
    origError(...a);
  };
  console.warn = (...a: unknown[]) => {
    push('warn', a);
    origWarn(...a);
  };
  window.addEventListener('error', (e) => push('error', [`Uncaught: ${e.message}`]));
  window.addEventListener('unhandledrejection', (e) => push('error', ['Unhandled rejection:', e.reason]));
}

export function getLines(): LogLine[] {
  return lines.slice();
}
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
