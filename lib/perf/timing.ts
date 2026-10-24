/**
 * Times an async step and logs how long it took, when asked to.
 *
 * Off unless `PERF_LOG=1`, so it costs a string comparison in normal running.
 * It exists because "navigation feels slow" has several possible causes — the
 * session lookup, the space lookup, the page's own queries — and the answer is
 * different on the live site than anywhere else: production runs next to its
 * database, while a laptop talks to it across an ocean. Set it in Vercel, click
 * around, and read the function logs.
 *
 * Written to stdout directly rather than through `logger`, whose `info` level
 * is deliberately silent in production — the one place this is meant to speak.
 */
export async function timed<T>(label: string, step: () => Promise<T>): Promise<T> {
  if (process.env.PERF_LOG !== "1") {
    return step();
  }

  const start = performance.now();

  try {
    return await step();
  } finally {
    // eslint-disable-next-line no-console
    console.log(`[perf] ${label} ${Math.round(performance.now() - start)}ms`);
  }
}
