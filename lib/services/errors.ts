/**
 * An error the user is allowed to see.
 *
 * Services throw this for rule violations — deleting a category that is still
 * in use, acting without permission — so callers can surface `message`
 * directly instead of leaking an unexpected exception.
 */
export class ServiceError extends Error {
  constructor(
    readonly code: ServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export type ServiceErrorCode =
  "CATEGORY_IN_USE" | "NOT_FOUND" | "FORBIDDEN" | "SPACE_NOT_FOUND" | "VALIDATION_FAILED";

/**
 * Narrows an unknown thrown value to a {@link ServiceError}.
 */
export function isServiceError(error: unknown): error is ServiceError {
  return error instanceof ServiceError;
}
