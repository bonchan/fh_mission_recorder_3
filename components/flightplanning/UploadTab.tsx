import React, { useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import { useMissionActions } from '@/hooks/useMissionActions';
import { Drone, HomePoint, ImageFormat, Mission, MissionType, RouteStop, Waypoint } from '@/utils/interfaces';
import { DOCK_TEMPLATES, DockTemplate } from '@/utils/constants';
import { GeneratedRoute, countMembers, estimateFlightMinutes } from '@/utils/routeOptimizer';

// Matches the zenithal waypoint the dashboard builds when you click an annotation
const ZENITHAL_ELEVATION = 70;
const ZENITHAL_PITCH = -90;

const DEFAULT_PREFIX = 'route';

type UploadState = 'idle' | 'uploading' | 'done' | 'failed';

interface LogEntry {
  at: number;
  message: string;
  failed: boolean;
}

interface UploadTabProps {
  orgId: string;
  projectId: string;
  routes: GeneratedRoute[];
  // Set when a real dock is picked on the Annotations tab — it carries the
  // takeoff reference, drone and payload the mission file needs
  device: Drone | null;
  usingFutureDock: boolean;
  homePoint: HomePoint | null;
}

// Stands in for a dock that doesn't exist yet: model and payload come from the
// chosen template, the takeoff reference from the hand-placed home point.
function toFutureDockDevice(template: DockTemplate, home: HomePoint, projectId: string): Drone {
  const label = `${template.label} (planned)`;

  return {
    deviceSn: `future-${template.id}`,
    projectId,
    deviceModelName: template.label,
    deviceModelKey: template.deviceModelKey,
    deviceProjectCallsign: label,
    deviceOrganizationCallsign: label,
    payloadIndex: template.payloadIndex,
    latitude: home.latitude,
    longitude: home.longitude,
    yaw: 0,
    parent: {
      index: 0,
      deviceSn: `future-${template.id}-dock`,
      deviceModelName: template.label,
      deviceProjectCallsign: label,
      deviceOrganizationCallsign: label,
      latitude: home.latitude,
      longitude: home.longitude,
      // No dock exists to measure, so the takeoff reference sits at ground level
      height: 0,
      droneInDock: true,
    },
  };
}

const toZenithalWaypoint = (latitude: number, longitude: number, isStop: boolean): Waypoint => ({
  id: crypto.randomUUID(),
  latitude,
  longitude,
  elevation: ZENITHAL_ELEVATION,
  height: ZENITHAL_ELEVATION,
  heading: 0,
  yaw: 0,
  pitch: ZENITHAL_PITCH,
  zoom: 1,
  hoverTime: 0,
  turn: 'CW',
  // Detour vertices are there to steer around a no-fly zone, not to shoot
  type: isStop ? 'picture' : 'default',
  actionGroup: null,
});

// Uses the avoidance path when one has been computed, so detours survive the
// upload; otherwise it's just the stops.
function toWaypoints(route: GeneratedRoute): Waypoint[] {
  const isStop = (lon: number, lat: number) =>
    route.points.some(stop => stop.longitude === lon && stop.latitude === lat);

  if (route.path && route.path.length > 2) {
    // path runs home -> ... -> home, and the drone takes off from its dock
    return route.path
      .slice(1, -1)
      .map(([lon, lat]) => toZenithalWaypoint(lat, lon, isStop(lon, lat)));
  }

  return route.points.map((stop: RouteStop) => toZenithalWaypoint(stop.latitude, stop.longitude, true));
}

export function UploadTab({ orgId, projectId, routes, device, usingFutureDock, homePoint }: UploadTabProps) {
  const { uploadMission, isUploading } = useMissionActions(orgId, projectId);

  const [dockTemplateId, setDockTemplateId] = useState(DOCK_TEMPLATES[0].id);
  const [prefix, setPrefix] = useState('');
  const [customNames, setCustomNames] = useState<Record<string, string>>({});
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [uploadStates, setUploadStates] = useState<Record<string, UploadState>>({});
  const [log, setLog] = useState<LogEntry[]>([]);

  const template = DOCK_TEMPLATES.find(candidate => candidate.id === dockTemplateId) || DOCK_TEMPLATES[0];

  // A real dock brings its own everything; a future one is assembled from the
  // chosen model plus the hand-placed home point
  const uploadDevice: Drone | null = usingFutureDock
    ? (homePoint ? toFutureDockDevice(template, homePoint, projectId) : null)
    : device;

  // A hand-typed name wins; everything else follows the prefix
  const nameFor = (route: GeneratedRoute, index: number) =>
    customNames[route.id] ?? `${prefix.trim() || DEFAULT_PREFIX}${String(index + 1).padStart(2, '0')}`;

  const addLog = (message: string, failed = false) =>
    setLog(prev => [{ at: Date.now(), message, failed }, ...prev].slice(0, 100));

  const uploadRoute = async (route: GeneratedRoute, index: number) => {
    if (!uploadDevice) return;

    const name = nameFor(route, index);
    setUploadStates(prev => ({ ...prev, [route.id]: 'uploading' }));
    addLog(`Uploading ${name}…`);

    const mission: Mission = {
      id: crypto.randomUUID(),
      name,
      orgId,
      projectId,
      device: uploadDevice,
      createdDate: Date.now(),
      updatedDate: Date.now(),
      fhUploadDate: Date.now(),
      imageFormat: [ImageFormat.VISIBLE],
      missionType: MissionType.ZENITHAL,
      waypoints: toWaypoints(route),
    };

    const ok = await uploadMission(mission);
    setUploadStates(prev => ({ ...prev, [route.id]: ok ? 'done' : 'failed' }));
    addLog(ok ? `${name} uploaded` : `${name} failed to upload`, !ok);
    return ok;
  };

  const uploadAll = async () => {
    for (let index = 0; index < routes.length; index++) {
      await uploadRoute(routes[index], index);
    }
  };

  const totals = useMemo(() => ({
    stops: routes.reduce((sum, route) => sum + route.points.length, 0),
    members: routes.reduce((sum, route) => sum + countMembers(route.points), 0),
    km: routes.reduce((sum, route) => sum + route.totalDistanceMeters, 0) / 1000,
    minutes: routes.reduce(
      (sum, route) => sum + estimateFlightMinutes(route.totalDistanceMeters, countMembers(route.points)),
      0
    ),
  }), [routes]);

  const stateLabel: Record<UploadState, string> = {
    idle: '—', uploading: '…', done: '✓', failed: '✕',
  };

  if (routes.length === 0) {
    return (
      <div className="planning-split">
        <div className="planning-panel">
          <div className="optimization-controls">
            <h3 style={{ margin: '0 0 12px' }}>Upload</h3>
            <p className="optimization-hint">
              No routes yet — generate them on the Flight Optimization tab first.
            </p>
          </div>
        </div>
        <div className="planning-report" />
      </div>
    );
  }

  return (
    <div className="planning-split">
      <div className="planning-panel">
        <div className="optimization-controls">
          <h3 style={{ margin: '0 0 12px' }}>Upload</h3>

          {usingFutureDock && (
            <div className="upload-field">
              <label>Dock</label>
              <select value={dockTemplateId} onChange={e => setDockTemplateId(e.target.value)}>
                {DOCK_TEMPLATES.map(option => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="upload-field">
            <label>Prefix</label>
            <input
              type="text"
              value={prefix}
              placeholder={DEFAULT_PREFIX}
              onChange={e => setPrefix(e.target.value)}
            />
          </div>

          <Button
            variant="primary"
            onClick={uploadAll}
            disabled={!uploadDevice || isUploading}
            isLoading={isUploading}
            requireConfirm
            confirmText={`Upload all ${routes.length} to FlightHub?`}
            confirmVariant="warning"
          >
            Upload all
          </Button>

          <p className="optimization-hint">
            {uploadDevice
              ? 'Double-click a name to rename it. Routes can only be uploaded here, not edited.'
              : usingFutureDock
                ? 'Set the start/end point on the Annotations map — a future dock takes off from it.'
                : 'Pick a dock on the Annotations tab — the mission file is built from it.'}
          </p>
        </div>

        <div className="route-list">
          {routes.map((route, index) => {
            const name = nameFor(route, index);
            const state = uploadStates[route.id] || 'idle';

            return (
              <div key={route.id} className="route-item">
                <div className="route-header-row">
                  <span className="route-header upload-row">
                    <span className="route-swatch" style={{ background: route.color }} />

                    {editingRouteId === route.id ? (
                      <input
                        className="route-name-input"
                        autoFocus
                        defaultValue={name}
                        onBlur={e => {
                          const next = e.target.value.trim();
                          setCustomNames(prev => ({ ...prev, [route.id]: next || name }));
                          setEditingRouteId(null);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                          if (e.key === 'Escape') setEditingRouteId(null);
                        }}
                      />
                    ) : (
                      <span
                        className="route-name"
                        title="Double-click to rename"
                        onDoubleClick={() => setEditingRouteId(route.id)}
                      >
                        {name}
                      </span>
                    )}

                    <span className="route-meta">
                      {route.points.length} pts · {(route.totalDistanceMeters / 1000).toFixed(2)} km
                      {` ${stateLabel[state]}`}
                    </span>
                  </span>

                  <button
                    className="icon-button"
                    title="Upload this route to FlightHub"
                    disabled={!uploadDevice || isUploading}
                    onClick={() => uploadRoute(route, index)}
                  >
                    ↥
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="planning-report">
        <h4>Summary</h4>
        <div className="config-summary">
          <div><span>Routes</span><span>{routes.length}</span></div>
          <div><span>Stops</span><span>{totals.stops}</span></div>
          <div><span>Annotations</span><span>{totals.members}</span></div>
          <div><span>Total distance</span><span>{totals.km.toFixed(2)} km</span></div>
          <div><span>Estimated flight</span><span>~{Math.round(totals.minutes)} min</span></div>
        </div>

        <table className="report-table">
          <thead>
            <tr><th>Route</th><th>Stops</th><th>km</th><th>min</th><th>Upload</th></tr>
          </thead>
          <tbody>
            {routes.map((route, index) => (
              <tr key={route.id}>
                <td>{nameFor(route, index)}</td>
                <td>{route.points.length}</td>
                <td>{(route.totalDistanceMeters / 1000).toFixed(2)}</td>
                <td>{Math.round(estimateFlightMinutes(route.totalDistanceMeters, countMembers(route.points)))}</td>
                <td>{stateLabel[uploadStates[route.id] || 'idle']}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h4>Upload log</h4>
        {log.length === 0 && <p className="optimization-hint">Nothing uploaded yet.</p>}
        <ul className="upload-log">
          {log.map(entry => (
            <li key={entry.at} className={entry.failed ? 'failed' : undefined}>
              <span className="log-time">{new Date(entry.at).toLocaleTimeString()}</span>
              {entry.message}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
