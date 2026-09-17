const MINIMUM_LOADING_MS = 1_000;

/** Reveal a page after both its request and the minimum terminal wait finish. */
export async function withMinimumLoading<T>(load: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  const startedAt = performance.now();
  try {
    return await load();
  } finally {
    const remaining = MINIMUM_LOADING_MS - (performance.now() - startedAt);
    if (remaining > 0 && !signal?.aborted) {
      await new Promise<void>(resolve => {
        const finish = () => {
          clearTimeout(timer);
          signal?.removeEventListener('abort', finish);
          resolve();
        };
        const timer = setTimeout(finish, remaining);
        signal?.addEventListener('abort', finish, { once: true });
      });
    }
  }
}
