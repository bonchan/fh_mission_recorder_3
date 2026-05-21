import MapDisplay from '@/components/flightroutes/MapDisplay';
import Button from '@/components/ui/Button';
import { FilterOption, MultiSelectFilter } from '@/components/ui/MultiSelectFilter';
import { useDatabase } from '@/hooks/useDatabase';
import { useMissionActions } from '@/hooks/useMissionActions';
import { useSync } from '@/hooks/useSync';
import { useToast } from '@/providers/ToastProvider';
import { CIRCLE_BUFFER } from '@/utils/constants';
import { FlightRouteData, ROUTE_SAFETY_STATUSES, RouteSafetyStatus } from '@/utils/interfaces';
import { createLogger } from '@/utils/logger';
import { toDockDroneList } from '@/utils/mapper';
import { getStatusColor } from '@/utils/utils';
import { DjiParser, type DjiKmzData } from 'dji-kmz-parser';
import React, { useRef, useState } from 'react';


const log = createLogger('FlightRoutesDashboard');

const STATUS_OPTIONS: FilterOption<RouteSafetyStatus>[] = ROUTE_SAFETY_STATUSES.map(status => ({
  value: status,
  // Helper to make them pretty: "PATH_COMPROMISED" -> "COMPROMISED" or "PATH COMPROMISED"
  label: status === 'PATH_COMPROMISED' ? 'COMPROMISED' : status.replace('_', ' ')
}));

interface DashboardProps {
  orgId: string;
  projectId: string;
  sourceTabId: number;
  debugMode: boolean;
}

export function Dashboard({ orgId, projectId, sourceTabId, debugMode }: DashboardProps) {
  // 1. Reactive Data from IndexedDB
  const {
    projectRoutes,
    projectTopologies,
    projectAnnotations,
    executionRoutesWithData,

    processAndSaveRoute,
    toggleExecutionRoute,
    deleteFlightRoute
  } = useDatabase(orgId, projectId);

  const { isSyncingTopologies, isSyncingAnnotations, syncTopologies, syncAnnotations } = useSync(orgId, projectId, sourceTabId)


  // TODO check this.. maybe it should go in a different place
  const [isRunning, setIsRunning] = useState(false);
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (isRunning) {
      intervalId = setInterval(() => {
        syncTopologies(true) 
      }, 1000);
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isRunning]);





  

  const [isValidating, setIsValidating] = useState(false);

  const [selectedStatuses, setSelectedStatuses] = useState<RouteSafetyStatus[]>([]);

  const { showToast } = useToast()

  const { isUploading, uploadFlightRoute } = useMissionActions(orgId, projectId)

  const [focusedAnnoId, setFocusedAnnoId] = useState<string>('');
  const listRef = useRef<Record<string, HTMLDivElement | null>>({});

  const executionRoutes = projectRoutes.filter(r => r.isExecutionRoute);
  const displayRoutes = (executionRoutesWithData || executionRoutes).filter(r => {
    // If no pills are selected, show all routes
    if (selectedStatuses.length === 0) return true;

    // Otherwise, only keep the route if its status is in the selected array
    return selectedStatuses.includes(r.safetyStatus || 'UNKNOWN');
  });
  const compromisedAnnotations = projectAnnotations.filter(a => a.isCompromised);

  // Check if we need any action
  const hasPending = executionRoutes.some(r => r.syncStatus === 'PENDING');


  const devices = toDockDroneList(projectTopologies)

  useEffect(() => {
    if (!executionRoutesWithData) return;
    log.info('executionRoutesWithData', executionRoutesWithData)
  }, [executionRoutesWithData]);

  const handleExport = async (route: FlightRoute) => {
    log.info('FlightRoute', route.data?.modifiedData);
    uploadFlightRoute(route)
  };

  const handleValidation = async () => {
    if (!executionRoutesWithData || executionRoutesWithData.length === 0) {
      showToast("", "No execution routes selected!", "warning");
      return;
    }

    setIsValidating(true);
    let successCount = 0;

    try {
      for (const route of executionRoutesWithData) {
        log.info(`Downloading KMZ for:`, route);

        // Only download if we're in AREA_WARNING and don't have data yet
        if (route.safetyStatus !== 'AREA_WARNING' || !route.kmzWithoutResUrl || route.data?.originalData) {
          log.warn(`Skipping ${route.name}`, route);
          continue;
        }

        const fileResponse = await fetch(route.kmzWithoutResUrl);
        if (!fileResponse.ok) {
          throw new Error(`Storage download failed with status: ${fileResponse.status}`);
        }

        const kmzBlob = await fileResponse.blob();
        const parser = new DjiParser();
        const originalData: DjiKmzData = await parser.parse(kmzBlob);

        const data: FlightRouteData = {
          routeId: route.id,
          originalData,
          modifiedData: null,
        };

        await processAndSaveRoute(route.id, data, route);
        successCount++;
      }

      showToast("", `Successfully downloaded ${successCount} KMZ files!`, "success");
    } catch (error) {
      log.error("Validation/Download failed:", error);
      showToast("Error", `There was an error downloading some files. Check the console.`, "error");
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', fontFamily: 'sans-serif' }}>
      {/* Column 1: Execution Routes */}
      <div style={columnStyle}>
        {/* We use executionRoutesWithData.length if available, fallback to the basic list */}
        <h4 style={{ marginTop: 0 }}>✈️ Execution Routes ({executionRoutesWithData?.length || executionRoutes.length})</h4>

        {hasPending ? (
          <div style={{ marginBottom: '15px', padding: '10px', background: '#fff3cd', borderRadius: '4px', border: '1px solid #ffeeba' }}>
            <p style={{ fontSize: '12px', margin: '0 0 10px 0', color: 'black' }}>Some routes require processing to calculate spatial data.</p>
          </div>
        ) : (<>
          <Button onClick={handleValidation}>Validate</Button>
          <Button onClick={() => { setIsRunning(!isRunning) }}>{isRunning ? 'Stop refresh' : 'Start refresh'}</Button>
          <MultiSelectFilter
            options={STATUS_OPTIONS}
            selectedValues={selectedStatuses}
            onChange={setSelectedStatuses}
          />
        </>
        )}

        {(!executionRoutesWithData || executionRoutesWithData.length === 0) ? (
          <p style={{ fontSize: '12px', color: '#888' }}>Go to "Routes" tab to select execution paths.</p>
        ) : (
          displayRoutes.map(r => {
            // 👇 Dynamically grab the color based on the new status!
            const statusColor = getStatusColor(r.safetyStatus);

            return (
              <div key={r.id} style={itemStyle(false, statusColor)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{r.name}</strong>
                  {r.safetyStatus == 'PATH_COMPROMISED' &&
                    <Button
                      onClick={() => { handleExport(r as FlightRoute) }}
                      disabled={isUploading}
                    >
                      export
                    </Button>

                  }
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 'bold',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: statusColor + '20', // Adds a 20% opacity background
                    color: statusColor
                  }}>
                    {r.safetyStatus || r.syncStatus}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Column 2: Compromised Annotations */}
      <div style={columnStyle}>
        <h4 style={{ marginTop: 0 }}>⚠️ Compromised ({compromisedAnnotations.length})</h4>
        {compromisedAnnotations.map(a => (
          <div
            key={a.id}
            ref={(el) => { listRef.current[a.id] = el; }}
            onClick={() => setFocusedAnnoId(a.id)}
            style={itemStyle(focusedAnnoId === a.id, a.color || '#dc3545')}
          >
            <strong>{a.name}</strong>
            {/* <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
              {a.type} | Lat: {a.latitude.toFixed(4)}
            </div> */}
          </div>
        ))}
        {compromisedAnnotations.length === 0 && (
          <p style={{ fontSize: '12px', color: '#888' }}>Go to "Annotations" tab to mark compromised points.</p>
        )}
      </div>

      {/* Column 3: The Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapDisplay
          devices={devices || []}
          routes={executionRoutesWithData || []}
          compromisedAnnotations={compromisedAnnotations}
          annotations={projectAnnotations}
          focusedAnnoId={focusedAnnoId}
          setFocusedAnnoId={() => { }}

          settings={{ circleBuffer: CIRCLE_BUFFER }}
        />
      </div>
    </div>
  );
}

// --- Styles ---

// --- Updated Styles ---

const columnStyle: React.CSSProperties = {
  width: '300px', // Slightly wider for better readability
  background: '#1d1e1f', // Slightly deeper grey
  padding: '20px',
  borderRight: '1px solid #dee2e6',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px'
};

const itemStyle = (isFocused: boolean, itemColor: string): React.CSSProperties => ({
  padding: '12px 15px',
  background: isFocused ? '#ffffff' : '#f8f9fa',
  marginBottom: '4px',
  borderRadius: '6px',
  borderLeft: `5px solid ${itemColor}`,
  // Stronger shadow and border if focused
  boxShadow: isFocused
    ? '0 4px 12px rgba(0,0,0,0.15)'
    : '0 1px 2px rgba(0,0,0,0.05)',
  border: isFocused ? '1px solid #adb5bd' : '1px solid transparent',
  fontSize: '13px',
  cursor: 'pointer',
  transition: 'all 0.2s ease-in-out',
  color: '#343a40'
});

const miniButtonStyle: React.CSSProperties = {
  fontSize: '11px',
  padding: '4px 8px',
  cursor: 'pointer',
  border: '1px solid #ced4da',
  borderRadius: '4px',
  background: '#fff',
  color: '#495057',
  fontWeight: 500,
};

const actionButtonStyle = (enabled: boolean, color: string) => ({
  width: '100%',
  padding: '10px',
  backgroundColor: enabled ? color : '#adb5bd',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  fontWeight: 'bold' as const,
  cursor: enabled ? 'pointer' : 'not-allowed',
  fontSize: '12px',
  boxShadow: enabled ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
});