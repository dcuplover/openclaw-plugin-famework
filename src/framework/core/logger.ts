import type { FrameworkLogger } from "./types";

function write(level: string, message: string, meta?: Record<string, unknown>): void {
  if (meta && Object.keys(meta).length > 0) {
    console.log(`[${level}] ${message}`, meta);
    return;
  }
  console.log(`[${level}] ${message}`);
}

export function createConsoleLogger(prefix = "framework"): FrameworkLogger {
  return {
    info(message, meta) {
      write(`INFO:${prefix}`, message, meta);
    },
    warn(message, meta) {
      write(`WARN:${prefix}`, message, meta);
    },
    error(message, meta) {
      write(`ERROR:${prefix}`, message, meta);
    },
    debug(message, meta) {
      write(`DEBUG:${prefix}`, message, meta);
    },
  };
}
