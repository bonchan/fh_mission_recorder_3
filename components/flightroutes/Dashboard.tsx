import MapDisplay from '@/components/flightroutes/MapDisplay';
import Button from '@/components/ui/Button';
import { MultiSelectFilter } from '@/components/ui/MultiSelectFilter';
import { useDatabase } from '@/hooks/useDatabase';
import { useMissionActions } from '@/hooks/useMissionActions';
import { useSync } from '@/hooks/useSync';
import { useToast } from '@/providers/ToastProvider';
import { FlightRouteData, RouteSafetyStatus } from '@/utils/interfaces';
import { createLogger } from '@/utils/logger';
import { toDockDroneList } from '@/utils/mapper';
import { STATUS_OPTIONS } from '@/utils/options';
import { getStatusColor } from '@/utils/utils';
import { DjiParser, type DjiKmzData } from 'dji-kmz-parser';
import React, { useRef, useState } from 'react';


const log = createLogger('FlightRoutesDashboard');


interface DashboardProps {
  orgId: string;
  projectId: string;
  sourceTabId: number;
  debugMode: boolean;
}

export function Dashboard({ orgId, projectId, sourceTabId, debugMode }: DashboardProps) {
  // 1. Reactive Data from IndexedDB
  const {
    settings,
    projectRoutes,
    projectTopologies,
    projectAnnotations,
    executionRoutesWithData,

    processAndSaveRoute,
    touchRouteValidation,
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
      showToast("", "No execution routes selected!", { type: "warning" });
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
          await touchRouteValidation(route.id);
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

      showToast("", `Successfully downloaded ${successCount} KMZ files!`, { type: "success" });
    } catch (error) {
      log.error("Validation/Download failed:", error);
      showToast("Error", `There was an error downloading some files. Check the console.`, { type: "error" });
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', fontFamily: 'sans-serif' }}>
      {/* Column 1: Execution Routes */}
      <div style={columnStyle}>
        {/* We use executionRoutesWithData.length if available, fallback to the basic list */}
        <h4 style={{ marginTop: 0 }}>{`✈️ Execution Routes (${displayRoutes.length} of ${executionRoutesWithData?.length || executionRoutes.length})`}</h4>

        {hasPending ? (
          <div style={{ marginBottom: '15px', padding: '10px', background: '#fff3cd', borderRadius: '4px', border: '1px solid #ffeeba' }}>
            <p style={{ fontSize: '12px', margin: '0 0 10px 0', color: 'black' }}>Some routes require processing to calculate spatial data.</p>
          </div>
        ) : (<>
          <Button onClick={handleValidation}>Validate</Button>
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
            const statusColor = getStatusColor(r.safetyStatus);
            return (
              <div key={r.id} style={itemStyle(false, statusColor)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{r.name}</strong>
                  {r.safetyStatus == 'PATH_COMPROMISED' &&
                    <Button
                      onClick={() => { handleExport(r as FlightRoute) }}
                      disabled={isUploading}
                      style={{ maxWidth: '50px', padding: '4px 4px' }}
                    >
                      export
                    </Button>

                  }
                  <span
                    title={r.safetyStatus || r.syncStatus}
                    style={{
                      fontSize: '10px',
                      fontWeight: 'bold',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: statusColor + '95', // Adds a 20% opacity background
                      color: statusColor
                    }}>
                    {/* {r.safetyStatus || r.syncStatus} */}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                      <path fill-rule="evenodd" clip-rule="evenodd" d="M5.233 4.345a1.66 1.66 0 0 1 1.664 1.657c0 .367-.12.706-.323.98l.017.001-.845 1.433.032-.018.273-.147c.048-.025.097-.05.147-.074l.316-.146.345-.146c.12-.048.245-.097.375-.145l.406-.146.438-.146.23-.073.487-.147.79-.222.282-.075.587-.15.623-.152.658-.153.695-.155 1.31-.28.331 1.448-1.006.213-.783.173-.737.172-.69.168-.646.167-.6.164-.555.162c-.089.026-.176.053-.26.08l-.49.158a20.04 20.04 0 0 0-.229.078l-.424.154-.196.076-.361.15c-.502.221-.842.423-1.031.594l-.098.09-.009.003.004.012c.01.02.033.044.069.07l.063.04.13.067.173.075.103.04.237.086.436.142.343.102.814.223.72.182.815.192 1.506.337 1.205.279.801.198.488.128.452.126.417.125.195.062.367.125.335.125c.16.063.308.127.445.192l.26.131.003.001-.454-.77.02.001a1.644 1.644 0 0 1-.325-.982 1.66 1.66 0 0 1 1.664-1.657 1.66 1.66 0 0 1 1.664 1.657c0 .368-.12.707-.324.982l.018-.001-1.132 1.922c.06.158.098.326.117.508l.011.119.003.074v.084l-.003.074c-.046.598-.455 1.206-1.34 1.853l-.266.186-.292.188c-.051.032-.103.064-.157.095l-.333.192-.36.195-.192.098-.404.198c-.07.034-.14.067-.213.1l-.448.204-.479.206-.51.21-.54.213-.572.217-.605.22-.97.338-.69.231-1.098.354-1.178.364-1.26.375-1.002.29-.252-.806-1.31-2.225.018.001a1.644 1.644 0 0 1-.324-.982 1.66 1.66 0 0 1 1.664-1.657 1.66 1.66 0 0 1 1.664 1.657c0 .368-.12.707-.324.982h.018l-.819 1.387.232-.067.814-.241 1.156-.354 1.08-.343.677-.224.644-.218.904-.32.563-.206.783-.3.483-.194.452-.188.42-.184.575-.264.345-.17.316-.163.287-.158.258-.152.23-.146a5.97 5.97 0 0 0 .104-.07l.188-.137.16-.13c.294-.256.424-.473.405-.649-.027-.247-.472-.532-1.326-.847l-.363-.128-.407-.13-.45-.134-.494-.136a35.232 35.232 0 0 0-.263-.07l-.559-.14-.6-.143-1.452-.324-1.646-.374-.558-.138-.512-.135a22.139 22.139 0 0 1-.239-.066l-.445-.134c-1.622-.512-2.297-1.043-2.325-1.941-.014-.424.16-.817.565-1.194l-1.15-1.951h.018a1.644 1.644 0 0 1-.323-.981 1.66 1.66 0 0 1 1.664-1.657zm-.75 12.36a.774.774 0 0 0-.776.772c0 .427.348.773.776.773a.774.774 0 0 0 .776-.773.774.774 0 0 0-.776-.772zm12.76-6.077a.774.774 0 0 0-.777.772c0 .427.348.772.776.772a.774.774 0 0 0 .776-.772.774.774 0 0 0-.776-.772zm-4.44-8.42 8.447 1.35c.08.012.121.11.09.18l-.028.037-6.448 5.62c-.077.066-.19.013-.218-.086l-.007-.053.087-3.695-.002-.015-.006-.013-2.032-3.089c-.062-.094-.018-.214.07-.235l.047-.001zm7.037 2.158L15.364 5.65a.042.042 0 0 0-.027.023l-.004.02-.12 2.528c-.001.033.025.058.05.057l.026-.01 4.594-3.811c.038-.034.004-.104-.043-.09zM5.233 5.23a.774.774 0 0 0-.776.772c0 .427.348.772.776.772a.774.774 0 0 0 .776-.772.774.774 0 0 0-.776-.772z" />
                    </svg>
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Column 2: Compromised Annotations */}
      <div style={columnStyle}>
        <h4 style={{ marginTop: 0 }}>⚠️ Compromised ({compromisedAnnotations.length}) | ⭕ Circle Buffer {settings.circleBuffer}m</h4>
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

          liveData={isRunning}
          toggleLiveData={() => { setIsRunning(!isRunning) }}

          settings={{ circleBuffer: settings.circleBuffer }}
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