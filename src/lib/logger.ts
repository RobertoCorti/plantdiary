type LogLevel = "info" | "warn" | "error";
type LogTag = "push" | "auth" | "weather" | "ai" | "events" | "nav" | "app" | "learning";

function emit(level: LogLevel, tag: LogTag, message: string, data?: unknown) {
  const ts = new Date().toISOString().slice(11, 23);
  const prefix = `[${ts}] [${tag}]`;
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (data !== undefined) {
    fn(`${prefix} ${message}`, data);
  } else {
    fn(`${prefix} ${message}`);
  }
}

export const log = {
  info: (tag: LogTag, message: string, data?: unknown) => emit("info", tag, message, data),
  warn: (tag: LogTag, message: string, data?: unknown) => emit("warn", tag, message, data),
  error: (tag: LogTag, message: string, data?: unknown) => emit("error", tag, message, data),
};
