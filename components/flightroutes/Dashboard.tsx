import React, { useRef, useState } from 'react';
import { createLogger } from '@/utils/logger';
import Button from '@/components/ui/Button';

import MapDisplay from '@/components/flightroutes/MapDisplay';

import { useDatabase } from '@/hooks/useDatabase';
import { useMessage } from '@/hooks/useMessage';

import { FlightRouteData } from '@/utils/interfaces';
import { Waypoint } from '@/utils/interfaces';

import { toDockDroneList } from '@/utils/mapper';

import { getStatusColor } from '@/utils/utils';

import { CIRCLE_BUFFER } from '@/utils/constants';

import { useToast } from '@/providers/ToastProvider';


const log = createLogger('FlightRoutesDashboard');

interface DashboardProps {
  orgId: string;
  projectId: string;
}

export function Dashboard({ orgId, projectId }: DashboardProps) {
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

  const [isValidating, setIsValidating] = useState(false);

  const { showToast } = useToast()

  const { downloadFlightRoute } = useMessage(orgId, projectId)

  const [focusedAnnoId, setFocusedAnnoId] = useState<string>('');
  const listRef = useRef<Record<string, HTMLDivElement | null>>({});

  // Filter local DB data for the dashboard view
  const executionRoutes = projectRoutes.filter(r => r.isExecutionRoute);
  const compromisedAnnotations = projectAnnotations.filter(a => a.isCompromised);

  // Check if we need any action
  const hasPending = executionRoutes.some(r => r.syncStatus === 'PENDING');


  const devices = toDockDroneList(projectTopologies)

  useEffect(() => {
    if (!executionRoutesWithData) return;
    log.info('executionRoutesWithData', executionRoutesWithData)
  }, [executionRoutesWithData]);



  const handleValidation = async () => {
    if (executionRoutesWithData && executionRoutesWithData.length === 0) {
      showToast("", "No execution routes selected!", "warning");
      return;
    }
    if (!executionRoutesWithData) return
    setIsValidating(true);
    let successCount = 0;

    try {

      for (const route of executionRoutesWithData) {
        // 👇 Adjust parameters here if your hook expects (url, id) instead of just (id)
        log.info(`Downloading KMZ for:`, route);

        if (route.safetyStatus == 'AREA_WARNING' && route.kmzWithoutResUrl && !(route.originalWaypoints?.length > 0)) {

          const res = await downloadFlightRoute(route.kmzWithoutResUrl);
          const unzipped = res.unzipped

          log.info('unzipped', unzipped)

          const parsedWaypoints = kmzParser.extractWaypoints(unzipped.templateKml);

          const data: FlightRouteData = {
            routeId: route.id,
            rawTemplate: unzipped.templateKml,
            rawWaylines: unzipped.waylinesWpml,
            parsedWaypoints: parsedWaypoints
          };

          await processAndSaveRoute(route.id, data, route)



          successCount++;



        } else {
          log.warn(`Skipping ${route.name}`, route);
          // await db.flight_routes.update(route.id, { syncStatus: 'FAILED' });
          continue;
        }


        // break
      }
      showToast("", `Successfully downloaded ${successCount} KMZ files!`, "success")
    } catch (error) {
      log.error("Validation/Download failed:", error);
      showToast("Error", `There was an error downloading some files. Check the console.`, "error")

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
        ) : (
          <Button onClick={handleValidation}>Validate</Button>
        )}

        {(!executionRoutesWithData || executionRoutesWithData.length === 0) ? (
          <p style={{ fontSize: '12px', color: '#888' }}>Go to "Routes" tab to select execution paths.</p>
        ) : (
          executionRoutesWithData.map(r => {
            // 👇 Dynamically grab the color based on the new status!
            const statusColor = getStatusColor(r.safetyStatus);

            return (
              <div key={r.id} style={itemStyle(false, statusColor)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{r.name}</strong>
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