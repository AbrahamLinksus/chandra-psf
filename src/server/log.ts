// No "server-only" import: scripts run under tsx and use the logger.

export type LogValue = string | number | boolean | null;
export type LogFields = Record<string, LogValue>;

/** Key fragments that mean personal data or a secret, matched case-insensitively against each field key. */
const FORBIDDEN_KEY =
  /name|phone|mobile|email|reg(no|istration)?|^ip|address|answer|comment|text|note|code|token|password|secret|cookie|hash/i;
const MAX_STRING_LENGTH = 64;
const RESERVED_KEYS = new Set(["at", "level", "event", "where", "errorClass"]);
const SAFE_IDENT = /^[A-Za-z][\w.:-]{0,63}$/;

export class LogFieldError extends Error {
  constructor(field: string, reason: string) {
    super(`log field "${field}" refused: ${reason}`);
    this.name = "LogFieldError";
  }
}

export interface Logger {
  event(name: string, fields?: LogFields): void;
  error(where: string, errorClass: string): void;
}

export type LogSink = (line: string) => void;

function checkIdent(label: string, value: string): void {
  if (!SAFE_IDENT.test(value)) throw new LogFieldError(label, "must be a short identifier");
}

function checkFields(fields: LogFields): void {
  for (const [key, value] of Object.entries(fields)) {
    if (RESERVED_KEYS.has(key)) throw new LogFieldError(key, "reserved key");
    if (FORBIDDEN_KEY.test(key)) throw new LogFieldError(key, "may hold personal data or a secret");
    if (typeof value === "string" && value.length > MAX_STRING_LENGTH) {
      throw new LogFieldError(key, `string longer than ${String(MAX_STRING_LENGTH)} characters`);
    }
  }
}

const stdoutSink: LogSink = (line) => {
  process.stdout.write(`${line}\n`);
};

/** JSON lines with ids, counts and error classes only (CONVENTIONS section 5). */
export function createLogger(
  sink: LogSink = stdoutSink,
  now: () => Date = () => new Date(),
): Logger {
  const emit = (record: Record<string, LogValue>): void => {
    sink(JSON.stringify({ at: now().toISOString(), ...record }));
  };
  return {
    event(name, fields = {}) {
      checkIdent("event", name);
      checkFields(fields);
      emit({ level: "info", event: name, ...fields });
    },
    error(where, errorClass) {
      checkIdent("where", where);
      checkIdent("errorClass", errorClass);
      emit({ level: "error", where, errorClass });
    },
  };
}

export const log: Logger = createLogger();
