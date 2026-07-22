/**
 * Supported logger severity levels.
 *
 * @example
 * ```ts
 * const level: LogLevel = "error";
 * ```
 */
export type LogLevel = "info" | "warn" | "error" | "debug";

/**
 * Additional metadata attached to a log entry.
 *
 * Context is useful for debugging and will allow
 * migration to external logging providers later.
 *
 * @example
 * ```ts
 * {
 *   userId: "user_123",
 *   expenseId: "expense_456",
 *   amount: 2500
 * }
 * ```
 */
export type LogContext = Record<string, unknown>;

/**
 * Logger contract.
 *
 * Implementations can write logs to different destinations:
 *
 * - Console (development)
 * - Sentry
 * - Datadog
 * - Axiom
 * - CloudWatch
 *
 * @example
 * ```ts
 * logger.error(
 *   "Failed to create expense",
 *   error,
 *   {
 *     userId: "user_123"
 *   }
 * );
 * ```
 */
export interface Logger {
  /**
   * Logs informational messages.
   *
   * @param message Human-readable log message
   * @param context Additional debugging information
   *
   * @example
   * ```ts
   * logger.info(
   *   "Expense created",
   *   {
   *     expenseId: "123"
   *   }
   * );
   * ```
   */
  info(message: string, context?: LogContext): void;

  /**
   * Logs warning messages.
   *
   * Useful for unexpected but recoverable situations.
   *
   * @example
   * ```ts
   * logger.warn(
   *   "Budget limit reached",
   *   {
   *     budgetId: "budget_123",
   *     percentage: 95
   *   }
   * );
   * ```
   */
  warn(message: string, context?: LogContext): void;

  /**
   * Logs errors with optional error details.
   *
   * @param message Error description
   * @param error Original error object
   * @param context Additional metadata
   *
   * @example
   * ```ts
   * try {
   *   await saveExpense();
   * } catch (error) {
   *   logger.error(
   *     "Failed to save expense",
   *     error,
   *     {
   *       userId
   *     }
   *   );
   * }
   * ```
   */
  error(message: string, error?: unknown, context?: LogContext): void;

  /**
   * Logs debugging information.
   *
   * Intended for verbose development-only diagnostics.
   *
   * @example
   * ```ts
   * logger.debug(
   *   "Expense calculation completed",
   *   {
   *     total: 5000
   *   }
   * );
   * ```
   */
  debug(message: string, context?: LogContext): void;
}
