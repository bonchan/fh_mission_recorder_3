interface CachedItem<T> {
  data: T;
  timestamp: number;
}

export async function getCachedOrFetch<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const storage = await browser.storage.local.get(key);
  
  // 2. Safely cast the retrieved object
  const cached = storage[key] as CachedItem<T> | undefined;

  const now = Date.now();

  // 3. TypeScript now perfectly understands .timestamp and .data!
  if (cached && cached.timestamp + ttlMs > now) {
    return cached.data; // No longer needs "as T" here
  }

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