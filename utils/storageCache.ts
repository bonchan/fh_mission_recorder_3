interface CachedItem<T> {
  data: T;
  timestamp: number;
}

export async function getCachedOrFetch<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  forceFetch: boolean = false,
): Promise<T> {
  const storage = await browser.storage.local.get(key);
  
  // 1. Safely cast the retrieved object
  const cached = storage[key] as CachedItem<T> | undefined;

  const now = Date.now();

  // 2. Add !forceFetch here! 
  // If forceFetch is true, this evaluates to false and skips the cache entirely.
  if (!forceFetch && cached && cached.timestamp + ttlMs > now) {
    return cached.data;
  }

  // 3. Fetch fresh data
  const freshData = await fetcher();
  
  // 4. Enforce the shape when saving
  const newCacheEntry: CachedItem<T> = { 
    data: freshData, 
    timestamp: now 
  };
  
  await browser.storage.local.set({
    [key]: newCacheEntry 
  });

  return freshData;
}