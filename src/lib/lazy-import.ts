import { lazy, type ComponentType } from 'react';

const CHUNK_RELOAD_KEY = 'invoicemonk:chunk-reload-at';
const CHUNK_RELOAD_COOLDOWN_MS = 30_000;

export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  return /failed to fetch dynamically imported module|importing a module script failed|loading chunk|chunkloaderror/i.test(
    error.message,
  );
}

function hasRecentlyReloadedForChunk(): boolean {
  try {
    const lastReloadAt = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY));
    return Number.isFinite(lastReloadAt) && Date.now() - lastReloadAt < CHUNK_RELOAD_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function rememberChunkReload(): void {
  try {
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    // Storage can be unavailable in private browsing; the fallback error still renders.
  }
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

/**
 * Loads route chunks with one short retry, then refreshes once to pick up a
 * newer app shell after a deployment. The session marker prevents reload loops.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  importer: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      return await importer();
    } catch (firstError) {
      if (!isChunkLoadError(firstError)) throw firstError;

      await wait(250);

      try {
        return await importer();
      } catch (secondError) {
        if (!isChunkLoadError(secondError) || hasRecentlyReloadedForChunk()) {
          throw secondError;
        }

        rememberChunkReload();
        window.location.reload();
        throw secondError;
      }
    }
  });
}