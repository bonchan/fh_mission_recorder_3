import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/utils/db';
import { SavedRouteSet } from '@/utils/interfaces';

export function useSavedRouteSets(projectId: string) {
  const result = useLiveQuery(
    async () => {
      const sets = await db.saved_route_sets
        .where('projectId')
        .equals(projectId)
        .toArray();
      return sets.sort((a, b) => b.createdDate - a.createdDate);
    },
    [projectId]
  );

  // undefined = query still running; array = resolved
  const isLoading = result === undefined;
  const savedSets: SavedRouteSet[] = result ?? [];

  const saveSet = async (set: SavedRouteSet) => {
    await db.saved_route_sets.put(set);
  };

  const deleteSet = async (id: string) => {
    await db.saved_route_sets.delete(id);
  };

  return { savedSets, isLoading, saveSet, deleteSet };
}
