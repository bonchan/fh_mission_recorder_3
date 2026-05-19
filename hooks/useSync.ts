import { useCallback, useState } from 'react';
import { useDatabase } from '@/hooks/useDatabase';
import { useMessage } from '@/hooks/useMessage';
import { createLogger } from '@/utils/logger';
import { FIVE_MIN_MS, TWELVE_HOURS_MS } from '@/utils/constants';

const log = createLogger('useSync');

export function useSync(orgId: string, projectId: string, sourceTabId: number) {
  // Grab the Network and the Hard Drive
  const { checkIsCacheFresh, saveAnnotationsCache, saveTopologiesCache } = useDatabase(orgId, projectId);
  const { getAnnotations, getTopologies } = useMessage(orgId, projectId);

  // Keep track of loading states for multiple resources
  const [syncStates, setSyncStates] = useState<Record<string, boolean>>({});

  // ==========================================
  // 🔒 PRIVATE ENGINE: The Generic Sync Logic
  // ==========================================
  const performSync = useCallback(async <T,>(
    resourceName: string,
    cacheKey: string,
    maxAgeMs: number,
    fetchData: () => Promise<T>,
    saveData: (data: T) => Promise<void>,
    forceSync = false
  ) => {
    setSyncStates(prev => ({ ...prev, [resourceName]: true }));

    try {
      if (!forceSync) {
        const isFresh = await checkIsCacheFresh(cacheKey, maxAgeMs);
        if (isFresh) {
          log.info(`[${resourceName}] Cache is fresh. Skipping API call.`);
          return null;
        }
      }

      log.info(`[${resourceName}] Fetching fresh data...`);
      const data = await fetchData();

      log.info(`[${resourceName}] Saving to database...`);
      await saveData(data);

      return data;
    } catch (error) {
      log.error(`[${resourceName}] Sync failed:`, error);
      throw error;
    } finally {
      setSyncStates(prev => ({ ...prev, [resourceName]: false }));
    }
  }, [checkIsCacheFresh]);


  // ==========================================
  // 🌍 PUBLIC API: Exposed Specific Syncers
  // ==========================================

  const syncAnnotations = useCallback(async (forceSync = false) => {
    return await performSync(
      'Annotations',
      `annotations_${projectId}`,
      FIVE_MIN_MS,
      () => getAnnotations(sourceTabId),
      saveAnnotationsCache,
      forceSync
    );
  }, [projectId, sourceTabId, performSync, getAnnotations, saveAnnotationsCache]);

  const syncTopologies = useCallback(async (forceSync = false) => {
    return await performSync(
      'Topologies',
      `topologies_${projectId}`,
      TWELVE_HOURS_MS,
      () => getTopologies(sourceTabId),
      saveTopologiesCache,
      forceSync
    );
  }, [projectId, sourceTabId, performSync, getTopologies, saveTopologiesCache]);


  return {
    isSyncingAnnotations: syncStates['Annotations'] || false,
    syncAnnotations,

    isSyncingTopologies: syncStates['Topologies'] || false,
    syncTopologies,
  };
}