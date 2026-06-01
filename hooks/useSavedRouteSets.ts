import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/utils/db';
import { SavedRouteSet } from '@/utils/interfaces';

export function useSavedRouteSets(projectId: string) {
  const savedSets = useLiveQuery(
    async () => {
      const sets = await db.saved_route_sets
        .where('projectId')
        .equals(projectId)
        .toArray();
      return sets.sort((a, b) => b.createdDate - a.createdDate);
    },
    [projectId]
  ) ?? [];

  const saveSet = async (set: SavedRouteSet) => {
    await db.saved_route_sets.put(set);
  };

  const deleteSet = async (id: string) => {
    await db.saved_route_sets.delete(id);
  };

  return { savedSets, saveSet, deleteSet };
}
