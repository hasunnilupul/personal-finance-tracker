import type { Logger, LogContext, LogLevel } from "@/lib/logger/types";

const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Extracts the caller location from the stack trace.
 *
 * Used only during development to quickly identify
 * the source of a log message.
 *
 * @internal
 */
function getCallerInfo() {
  const stack = new Error().stack;

  const caller = stack?.split("\n")[3];

  const match = caller?.match(/\((.*):(\d+):(\d+)\)/);

  if (!match) {
    return {
      file: "unknown",
      line: "unknown",
      column: "unknown",
    };
  }

  const [, filepath, line, column] = match;

  return {
    file: filepath.split("/").pop() ?? "unknown",
    line,
    column,
  };
}

/**
 * Converts unknown errors into
 * serializable objects.
 *
 * @internal
 */
function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return error;
}

/**
 * Console logger implementation.
 *
 * Logs only during development.
 *
 * Production logging providers can replace this
 * implementation without changing application code.
 *
 * @example
 * ```ts
 * logger.info(
 *   "User signed in",
 *   {
 *     userId: "123"
 *   }
 * );
 * ```
 */
class ConsoleLogger implements Logger {
  private log(level: LogLevel, message: string, context?: LogContext) {
    if (!isDevelopment) {
      return;
    }

    const payload = {
      timestamp: new Date().toISOString(),

      level,

      message,

      caller: getCallerInfo(),

      ...(context && {
        context,
      }),
    };

    /* eslint-disable no-console */
    switch (level) {
      case "error":
        console.error(payload);
        break;

      case "warn":
        console.warn(payload);
        break;

      case "debug":
        console.debug(payload);
        break;

      default:
        console.info(payload);
    }
  }

  /**
   * Logs an informational message.
   */
  info(message: string, context?: LogContext) {
    this.log("info", message, context);
  }

  /**
   * Logs a warning message.
   */
  warn(message: string, context?: LogContext) {
    this.log("warn", message, context);
  }

  /**
   * Logs an error message.
   */
  error(message: string, error?: unknown, context?: LogContext) {
    this.log("error", message, {
      ...context,
      error: normalizeError(error),
    });
  }

  /**
   * Logs development debugging information.
   */
  debug(message: string, context?: LogContext) {
    this.log("debug", message, context);
  }
}

/**
 * Application-wide logger instance.
 *
 * Import this instance instead of using console methods directly.
 *
 * @example
 * ```ts
 * import { logger } from "@/lib/logger";
 *
 * logger.info(
 *   "Expense created",
 *   {
 *     expenseId: "expense_123"
 *   }
 * );
 * ```
 */
export const logger = new ConsoleLogger();
