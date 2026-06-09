import Button from '@/components/ui/Button';
import { useDatabase } from '@/hooks/useDatabase';
import { useMessage } from '@/hooks/useMessage';
import { useToast } from '@/providers/ToastProvider';
import { createLogger } from '@/utils/logger';
import React, { useState } from 'react';

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
    clearAllExecutionRoutes,
    syncPastedExecutionRoutes,
    syncRouteDetails,
    markRouteFailed,
    markRouteStale,
  } = useDatabase(orgId, projectId);

  const { getFlightRoutes, getAllRoutesForPrefix, getFlightRouteDetails, getBatchedRouteDetails } = useMessage(orgId, projectId);

  const { showToast } = useToast()

  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const acceptedPrefixes = ['D-', 'BP-', 'GR-'];
  const prefixLength = 4

  const fetchLatestHeadersByPrefix = async (prefixes: string[]) => {
    let allFetchedApiRoutes: any[] = [];
    const failedPrefixes: string[] = [];

    for (const prefix of prefixes) {
      log.info(`Fetching ALL routes for prefix [${prefix}]...`);

      try {
        const res = await getAllRoutesForPrefix(prefix, sourceTabId);

        if (!res.success) {
          throw new Error(res.error);
        }

        if (res.routes) {
          allFetchedApiRoutes.push(...res.routes);
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
      .filter(name =>
        acceptedPrefixes.some(prefix => name.toLowerCase().startsWith(prefix.toLowerCase()))
      );

    if (uniqueSortedNames.length === 0) {
      setIsLoading(false);
      return;
    }

    const buckets: Record<string, string[]> = {};
    uniqueSortedNames.forEach(name => {
      const prefix = name.substring(0, prefixLength).toUpperCase();
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

  const chunkArray = <T,>(array: T[], size: number): T[][] => {
    const result: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size));
    }
    return result;
  };

  // --- THE SYNC ALL DETAILS HANDLER ---
  const handleSyncAll = async () => {
    setIsSyncing(true);

    const prefixesToVerify = Array.from(new Set(
      projectRoutes.filter(r => r.isExecutionRoute).map(r => r.name.substring(0, prefixLength).toUpperCase())
    ));
    const { allFetchedApiRoutes } = await fetchLatestHeadersByPrefix(prefixesToVerify);

    for (const apiRoute of allFetchedApiRoutes) {
      const dbRoute = projectRoutes.find(r => r.name === apiRoute.name);
      const apiUpdateTime = apiRoute.update_time || apiRoute.updateTime;

      if (dbRoute) {
        await markRouteStale(dbRoute.id, apiUpdateTime);
      }
    }

    const routesToSync = projectRoutes.filter(r => r.isExecutionRoute);

    if (routesToSync.length === 0) {
      showToast(
        'Sync Complete!',
        'No execution routes found to sync.',
        { type: "success" }
      );
      setIsSyncing(false);
      return;
    }

    log.info(`Batch fetching details for ALL ${routesToSync.length} routes...`);

    const routeIdsToFetch = routesToSync.map(r => r.id);
    const chunks = chunkArray(routeIdsToFetch, 5);

    let processedCount = 0;

    for (const chunk of chunks) {
      log.info(`Syncing chunk... (${processedCount} / ${routeIdsToFetch.length})`);

      try {
        const res = await getBatchedRouteDetails(chunk, sourceTabId);

        if (res?.success && res.results) {
          for (const result of res.results) {
            if (result.success && result.data) {
              await syncRouteDetails(result.routeId, result.data);
            } else {
              log.error(`Content script failed to fetch details for ${result.routeId}`);
              await markRouteFailed(result.routeId);
            }
          }
        }
      } catch (error) {
        log.error("Fatal error processing chunk. Moving to next.", error);
      }

      processedCount += chunk.length;

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    showToast(
      'Force Sync Complete!',
      `Successfully updated ${routeIdsToFetch.length} routes.`,
      { type: "success" }
    );

    setIsSyncing(false);
  };

  return (
    <div className="flight-routes-manager" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>

      <h2>Flight Routes ({projectRoutes.length})</h2>

      {/* ACTION ROW: PASTE TRAP & SYNC BUTTON */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>

        <input
          id="flight-routes-input"
          type="text"
          placeholder={isLoading ? "Processing API sync..." : "Click and paste (Ctrl+V) execution routes here..."}
          onPaste={handlePaste}
          value=""
          onChange={() => { }}
          disabled={isLoading || isSyncing}
          style={{
            flex: 1,
            padding: '15px',
            border: '2px dashed #007bff',
            borderRadius: '4px',
            textAlign: 'center',
            outline: 'none',
            background: isLoading || isSyncing ? '#f0f0f0' : 'transparent',
            cursor: isLoading || isSyncing ? 'wait' : 'text'
          }}
        />

        <Button
          onClick={handleSyncAll}
          disabled={isSyncing || isLoading}
          style={{
            maxWidth: '150px',
            padding: '0 20px',
            marginBottom: '0px',
            backgroundColor: isSyncing ? '#6c757d' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isSyncing || isLoading ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            whiteSpace: 'nowrap'
          }}
        >
          {isSyncing ? 'Syncing Details...' : 'Sync All Execution'}
        </Button>

        <Button
          variant="sad"
          requireConfirm={true}
          confirmText="sure?"
          confirmVariant="danger"
          onClick={clearAllExecutionRoutes}
          disabled={isSyncing || isLoading}
          style={{
            maxWidth: '150px',
            padding: '0 20px',
            marginBottom: '0px',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap'
          }}
        >
          Remove All Execution
        </Button>

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