import React, { useState } from 'react';
import { createLogger } from '@/utils/logger';

import { useMessage } from '@/hooks/useMessage';
import { useDatabase } from '@/hooks/useDatabase';

import { useToast } from '@/providers/ToastProvider';

const log = createLogger('FlightRoutes');

interface FlightRoutesProps {
  orgId: string;
  projectId: string;
  sourceTabId: number;
  debugMode: boolean;
}

export function FlightRoutes({ orgId, projectId, sourceTabId, debugMode }: FlightRoutesProps) {
  const {
    projectRoutes,
    toggleExecutionRoute,
    syncPastedExecutionRoutes,
    syncRouteDetails,
    markRouteFailed,
    markRouteStale,
  } = useDatabase(orgId, projectId);

  const { getFlightRoutes, getFlightRouteDetails } = useMessage(orgId, projectId);

  const { showToast } = useToast()

  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const perPage = 200;
  const rejectedPrefixes = ['C-', 'Falla', 'P'];

  const fetchLatestHeadersByPrefix = async (prefixes: string[]) => {
    let allFetchedApiRoutes: any[] = [];
    const failedPrefixes: string[] = [];

    for (const prefix of prefixes) {
      let currentPage = 1;
      let totalPages = 1;

      try {
        while (currentPage <= totalPages) {
          log.info(`Fetching prefix [${prefix}] - Page ${currentPage}`);
          const res = await getFlightRoutes(prefix, currentPage, perPage, sourceTabId);
          const data = res?.flightRoutes?.data;

          if (data?.list) {
            allFetchedApiRoutes.push(...data.list);
          }

          const totalItems = data?.pagination?.total || 0;
          totalPages = Math.ceil(totalItems / perPage);
          currentPage++;
        }
      } catch (error) {
        log.error(`Failed fetching for prefix: ${prefix}`, error);
        failedPrefixes.push(prefix);
      }
    }

    return { allFetchedApiRoutes, failedPrefixes };
  };

  // 1. --- THE BATCH PASTE & UPSERT HANDLER ---
  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');

    if (pastedText.includes('\t')) {
      showToast('Error', 'Please paste a single column of Flight Route names.', { type: "error" })
      return;
    }

    setIsLoading(true);

    const rawNames = pastedText.split('\n').map(n => n.trim()).filter(n => n !== '');
    const uniqueSortedNames = Array.from(new Set(rawNames))
      .sort()
      .filter(name => !rejectedPrefixes.some(prefix => name.toLowerCase().startsWith(prefix.toLowerCase())));

    if (uniqueSortedNames.length === 0) {
      setIsLoading(false);
      return;
    }

    const buckets: Record<string, string[]> = {};
    uniqueSortedNames.forEach(name => {
      const prefix = name.substring(0, 3).toUpperCase();
      if (!buckets[prefix]) buckets[prefix] = [];
      buckets[prefix].push(name);
    });

    const prefixes = Object.keys(buckets);
    log.info(`Processing ${uniqueSortedNames.length} routes grouped into ${prefixes.length} API prefixes.`);

    const { allFetchedApiRoutes, failedPrefixes } = await fetchLatestHeadersByPrefix(prefixes);
    await syncPastedExecutionRoutes(allFetchedApiRoutes, uniqueSortedNames);

    setIsLoading(false);

    // Filter to find items we pasted that were NOT returned by the API
    const completelyMissing = uniqueSortedNames.filter(
      pastedName => !allFetchedApiRoutes.some(apiRoute => apiRoute.name === pastedName)
    );

    const totalMissing = [...failedPrefixes, ...completelyMissing];

    if (totalMissing.length > 0) {
      showToast(
        'Sync Complete!',
        `Missing ${totalMissing.length} pasted routes in DJI:\n\n${totalMissing.slice(0, 10).join('\n')}${totalMissing.length > 10 ? '\n...' : ''}`,
        { type: "success" }
      )
    }
  };

  // --- THE SYNC ALL DETAILS HANDLER ---
  const handleSyncAll = async () => {
    setIsSyncing(true);


    // 1. Group existing DB routes to find their prefixes
    const prefixesToVerify = Array.from(new Set(
      projectRoutes.filter(r => r.isExecutionRoute).map(r => r.name.substring(0, 3).toUpperCase())
    ));

    const { allFetchedApiRoutes } = await fetchLatestHeadersByPrefix(prefixesToVerify);

    for (const apiRoute of allFetchedApiRoutes) {
      const dbRoute = projectRoutes.find(r => r.name === apiRoute.name);
      const apiUpdateTime = apiRoute.update_time || apiRoute.updateTime;

      if (dbRoute && apiUpdateTime > dbRoute.updateTime) {
        log.warn(`${dbRoute.name} is stale! Reverting to PENDING.`);
        await markRouteStale(dbRoute.id, apiUpdateTime);
      }
    }


    const routesToSync = projectRoutes.filter(
      r => r.isExecutionRoute && r.syncStatus === 'PENDING'
    );

    if (routesToSync.length === 0) {
      showToast(
        'Sync Complete!',
        'All execution routes are already up to date!',
        { type: "success" }
      )
      setIsSyncing(false);
      return;
    }


    for (const route of routesToSync) {
      try {
        log.info(`Fetching details for route: ${route.name}`);
        const res = await getFlightRouteDetails(route.id, sourceTabId);
        const data = res?.flightRoutes?.data || res;
        await syncRouteDetails(route.id, data);
      } catch (error) {
        log.error(`Network error fetching details for ${route.name}`, error);
        await markRouteFailed(route.id);
      }
    }

    setIsSyncing(false);
  };

  return (
    <div className="flight-routes-manager" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>

      <h2>Flight Routes ({projectRoutes.length})</h2>

      {/* ACTION ROW: PASTE TRAP & SYNC BUTTON */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>

        <input
          type="text"
          placeholder={isLoading ? "Processing API sync..." : "Click and paste (Ctrl+V) execution routes here..."}
          onPaste={handlePaste}
          value=""
          onChange={() => { }}
          disabled={isLoading || isSyncing}
          style={{
            flex: 1, // 👈 Takes up remaining space
            padding: '15px',
            border: '2px dashed #007bff',
            borderRadius: '4px',
            textAlign: 'center',
            outline: 'none',
            background: isLoading || isSyncing ? '#f0f0f0' : 'transparent',
            cursor: isLoading || isSyncing ? 'wait' : 'text'
          }}
        />

        <button
          onClick={handleSyncAll}
          disabled={isSyncing || isLoading}
          style={{
            padding: '0 20px',
            backgroundColor: isSyncing ? '#6c757d' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isSyncing || isLoading ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            whiteSpace: 'nowrap' // 👈 Prevents the button text from wrapping
          }}
        >
          {isSyncing ? 'Syncing Details...' : 'Sync All Execution'}
        </button>

      </div>

      {/* THE ROUTE LIST */}
      <div className="list-container" style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'auto', maxHeight: '500px' }}>
        {projectRoutes.length === 0 && !isLoading && <p style={{ color: '#888' }}>No routes in the database. Paste a list to start.</p>}

        {projectRoutes.map(route => (
          <div key={route.id} className="route-item card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid #ddd', borderRadius: '6px' }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* THE TOGGLE CHECKBOX */}
              <input
                type="checkbox"
                id={`exec-${route.id}`}
                checked={route.isExecutionRoute}
                onChange={() => toggleExecutionRoute(route.id, !route.isExecutionRoute)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label htmlFor={`exec-${route.id}`} style={{ fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' }}>
                  {route.name}
                </label>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  Status: <span style={{ fontWeight: 'bold', color: route.syncStatus === 'PENDING' ? '#f0ad4e' : '#5cb85c' }}>{route.syncStatus}</span>
                  {route.distance !== null && ` | Distance: ${route.distance}m`}
                </div>
              </div>
            </div>

            {/* DELETE BUTTON */}
            {/* <button
              onClick={() => deleteFlightRoute(route.id)}
              style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
            >
              Delete
            </button> */}

          </div>
        ))}
      </div>

    </div>
  );
}