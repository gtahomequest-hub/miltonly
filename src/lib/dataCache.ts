// src/lib/dataCache.ts
// unstable_cache with one difference: outside a Next server it runs the function instead of
// throwing "Invariant: incrementalCache missing". The local runners (scripts/create-street-pages-
// local.ts and the like) import the same street modules the pages do, and a set that is cached
// for the deployment on Vercel is simply fetched when a script asks (MC-018).
//
// Same signature as unstable_cache, so a reader sees the key, the revalidate and the tags where
// they would expect them.

import { unstable_cache } from "next/cache";

export function dataCached<T>(
  fn: () => Promise<T>,
  keyParts: string[],
  options: { revalidate: number; tags: string[] },
): () => Promise<T> {
  const cachedFn = unstable_cache(fn, keyParts, options);
  return async () => {
    try {
      return await cachedFn();
    } catch (e) {
      if (/incrementalCache missing/.test(String((e as Error).message))) return fn();
      throw e;
    }
  };
}
