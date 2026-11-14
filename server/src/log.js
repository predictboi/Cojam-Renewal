'use strict';

// One JSON object per line on stdout (Render collects stdout). Never pass secrets in:
// as a second guard, any field whose name looks like a key or a raw transaction is masked.

const MASK = /(private|secret|key|password|token|raw)/i;

function clean(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) {
    if (MASK.test(k)) {
      out[k] = '[redacted]';
    } else if (typeof v === 'bigint') {
      out[k] = v.toString();
    } else if (v instanceof Error) {
      out[k] = v.message;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function createLogger({ sink = (line) => process.stdout.write(`${line}\n`), base = {} } = {}) {
  const write = (level, msg, fields) => {
    sink(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...base, ...clean(fields) }));
  };
  return {
    info: (msg, fields) => write('info', msg, fields),
    warn: (msg, fields) => write('warn', msg, fields),
    error: (msg, fields) => write('error', msg, fields),
    child: (more) => createLogger({ sink, base: { ...base, ...more } }),
  };
}

const silentLogger = { info() {}, warn() {}, error() {}, child() { return silentLogger; } };

module.exports = { createLogger, silentLogger };
