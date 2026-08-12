import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Narrows an untrusted `?redirect=` value down to a safe in-app path.
 *
 * Anything that could send the user to another origin — an absolute URL,
 * a protocol-relative `//evil.com`, or a backslash variant — is discarded
 * in favour of the fallback.
 *
 * @example
 * ```ts
 * safeRedirectPath("/expenses"); // "/expenses"
 * safeRedirectPath("//evil.com"); // "/"
 * ```
 */
export function safeRedirectPath(path: string | undefined | null, fallback = "/") {
  if (!path || !path.startsWith("/")) {
    return fallback;
  }

  if (path.startsWith("//") || path.startsWith("/\\")) {
    return fallback;
  }

  return path;
}
