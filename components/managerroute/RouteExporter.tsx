import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { createLogger } from '@/utils/logger';
import { RoutePoint, calculateDistance } from '@/utils/routeOptimizer'; // calculateDistance used in recalcRoute
import { RouteSettings } from './ManagerRoute';
import { generateRoutes, Route } from '@/utils/routeSplitter';
import { generateDJIMission } from '@/utils/wpml-generator';
import { Mission, MissionType, Waypoint, Drone, Dock } from '@/utils/interfaces';
import { useMissionActions } from '@/hooks/useMissionActions';
import { dockEmptyIcon } from '@/utils/mapIcons';

const log = createLogger('RouteExporter');

const CENITAL_TAG_ID = 'ccdefa98-fbd4-4db6-952d-6622f848f111';

const ROUTE_COLORS = [
  '#4285F4', '#EA4335', '#FBBC04', '#34A853',
  '#FF6D00', '#7B1FA2', '#00897B', '#F06292',
];

const DRONE_PRESETS = [
  { id: 'm3td', name: 'Matrice 3TD (Dock 2)', deviceModelKey: '0-91-1', payloadIndex: '81-0-0' },
  { id: 'm4td', name: 'Matrice 4TD (Dock 3)', deviceModelKey: '0-100-1', payloadIndex: '99-0-0' },
];

export interface RouteExporterProps {
  points: RoutePoint[];
  orgId: string;
  projectId: string;
  routePrefix: string;
  onRoutePrefixChange: (prefix: string) => void;
  onSaveSession: (name: string) => Promise<void>;
  settings: RouteSettings;
  devices: Drone[];
  debugMode?: boolean;
}

function buildZenithalMission(
  route: Route,
  missionName: string,
  orgId: string,
  projectId: string,
  deviceModelKey: string,
  payloadIndex: string,
  flightHeight: number,
  dock: Dock | null = null,
): Mission {
  const waypoints: Waypoint[] = route.points.map((pt) => ({
    id: crypto.randomUUID(),
    longitude: pt.longitude,
    latitude: pt.latitude,
    elevation: flightHeight,
    height: flightHeight,
    yaw: 0,
    pitch: -90,
    zoom: 1,
    hoverTime: 0,
    turn: 'CW' as const,
    actionGroup: null,
    type: 'picture' as const,
    tagIds: [CENITAL_TAG_ID],
  }));

  const now = Date.now();
  const device: Drone = {
    deviceSn: '',
    projectId,
    deviceModelName: DRONE_PRESETS.find(p => p.deviceModelKey === deviceModelKey)?.name ?? deviceModelKey,
    deviceModelKey,
    deviceProjectCallsign: '',
    deviceOrganizationCallsign: '',
    payloadIndex,
    longitude: 0,
    latitude: 0,
    yaw: 0,
    parent: dock,
  };

  return {
    id: crypto.randomUUID(),
    name: missionName,
    orgId,
    projectId,
    device,
    createdDate: now,
    updatedDate: now,
    missionType: MissionType.ZENITHAL,
    waypoints,
  };
}

function RoutesMapController({ routes, dock }: { routes: Route[], dock: Dock | null }) {
  const map = useMap();

  useEffect(() => {
    const allPoints = routes.flatMap(r => r.points);
    if (allPoints.length === 0) return;
    const coords: [number, number][] = allPoints.map(p => [p.latitude, p.longitude]);
    if (dock) coords.push([dock.latitude, dock.longitude]);
    const bounds = L.latLngBounds(coords);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [routes, dock, map]);

  return (
    <>
      {dock && (
        <Marker
          position={[dock.latitude, dock.longitude]}
          icon={dockEmptyIcon}
        >
          <Popup>
            <div>
              <strong>{dock.deviceOrganizationCallsign || dock.deviceProjectCallsign}</strong><br />
              {dock.deviceModelName}<br />
              {dock.latitude.toFixed(6)}, {dock.longitude.toFixed(6)}
            </div>
          </Popup>
        </Marker>
      )}
      {routes.map((route, routeIdx) => {
        const color = ROUTE_COLORS[routeIdx % ROUTE_COLORS.length];
        const positions = route.points.map(p => [p.latitude, p.longitude] as [number, number]);

        return (
          <React.Fragment key={route.id}>
            <Polyline positions={positions} color={color} weight={3} opacity={0.85} />
            {route.points.map((point, ptIdx) => (
              <Marker
                key={point.id}
                position={[point.latitude, point.longitude]}
                icon={L.divIcon({
                  className: '',
                  html: `<div style="background:${color};color:#fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;border:2px solid rgba(0,0,0,0.3)">${ptIdx + 1}</div>`,
                  iconSize: [22, 22],
                  iconAnchor: [11, 11],
                })}
              >
                <Popup>
                  <div>
                    <strong>{point.name}</strong><br />
                    Ruta {routeIdx + 1} · Punto {ptIdx + 1}<br />
                    {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                  </div>
                </Popup>
              </Marker>
            ))}
          </React.Fragment>
        );
      })}
    </>
  );
}

export function RouteExporter({
  points,
  orgId,
  projectId,
  settings,
  routePrefix,
  onRoutePrefixChange,
  onSaveSession,
  devices,
  debugMode,
}: RouteExporterProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedDeviceIdx, setSelectedDeviceIdx] = useState<number | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState(DRONE_PRESETS[0].id);
  const [flightHeight, setFlightHeight] = useState(70);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customDeviceModelKey, setCustomDeviceModelKey] = useState('');
  const [customPayloadIndex, setCustomPayloadIndex] = useState('');

  const [editableRoutes, setEditableRoutes] = useState<Route[] | null>(null);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<{ routeId: string; idx: number } | null>(null);
  const [showResumen, setShowResumen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { uploadMission, isUploading } = useMissionActions(orgId, projectId);

  const computedRoutes = useMemo(() => {
    if (points.length === 0) return [];
    return generateRoutes(points, settings.maxDistanceKm, settings.maxPoints);
  }, [points, settings.maxDistanceKm, settings.maxPoints]);

  // Clear manual edits when source points change
  useEffect(() => {
    setEditableRoutes(null);
    setEditingRouteId(null);
  }, [points]);

  const routes = editableRoutes ?? computedRoutes;

  const recalcRoute = useCallback((route: Route, newPoints: RoutePoint[]): Route => {
    let dist = 0;
    for (let i = 0; i < newPoints.length - 1; i++) {
      dist += calculateDistance(newPoints[i], newPoints[i + 1]) / 1000;
    }
    return {
      ...route,
      points: newPoints,
      pointCount: newPoints.length,
      totalDistance: dist,
      exceedsLimits: dist > settings.maxDistanceKm || newPoints.length > settings.maxPoints,
    };
  }, [settings.maxDistanceKm, settings.maxPoints]);

  const ensureEditable = useCallback((): Route[] => {
    if (editableRoutes) return editableRoutes;
    return computedRoutes.map(r => ({ ...r, points: [...r.points] }));
  }, [editableRoutes, computedRoutes]);

  const movePointInRoute = (routeId: string, fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const current = ensureEditable();
    const updated = current.map(r => {
      if (r.id !== routeId) return r;
      const pts = [...r.points];
      const [moved] = pts.splice(fromIdx, 1);
      pts.splice(toIdx, 0, moved);
      return recalcRoute(r, pts);
    });
    setEditableRoutes(updated);
  };

  const movePointToRoute = (fromRouteId: string, pointIdx: number, toRouteId: string) => {
    if (fromRouteId === toRouteId) return;
    const current = ensureEditable();
    let movedPoint: RoutePoint | null = null;
    const stage1 = current.map(r => {
      if (r.id !== fromRouteId) return r;
      const pts = [...r.points];
      [movedPoint] = pts.splice(pointIdx, 1);
      return recalcRoute(r, pts);
    });
    const updated = stage1
      .map(r => {
        if (r.id !== toRouteId || !movedPoint) return r;
        return recalcRoute(r, [...r.points, movedPoint]);
      })
      .filter(r => r.points.length > 0);
    // renumber IDs so they stay sequential
    updated.forEach((r, i) => { r.id = `route-${i + 1}`; });
    if (editingRouteId === fromRouteId && !updated.find(r => r.id === fromRouteId)) {
      setEditingRouteId(null);
    }
    setEditableRoutes(updated);
  };

  const selectedPreset = DRONE_PRESETS.find(p => p.id === selectedPresetId) ?? DRONE_PRESETS[0];
  const effectiveDeviceModelKey = showAdvanced ? customDeviceModelKey || selectedPreset.deviceModelKey : selectedPreset.deviceModelKey;
  const effectivePayloadIndex = showAdvanced ? customPayloadIndex || selectedPreset.payloadIndex : selectedPreset.payloadIndex;

  const getMissionName = (index: number) => `${routePrefix}${index + 1}`;

  const selectedDock = selectedDeviceIdx !== null ? (devices[selectedDeviceIdx]?.parent ?? null) : null;

  const buildMissions = () =>
    routes.map((route, i) =>
      buildZenithalMission(
        route, getMissionName(i), orgId, projectId,
        effectiveDeviceModelKey, effectivePayloadIndex, flightHeight,
        selectedDock,
      )
    );

  const handleDownloadKmz = async () => {
    if (!routePrefix.trim()) { setError('Ingresá un nombre/prefijo para las rutas'); return; }
    setIsDownloading(true);
    setError(null);
    try {
      const missions = buildMissions();
      for (let i = 0; i < missions.length; i++) {
        const blob = await generateDJIMission(missions[i]);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${getMissionName(i)}.kmz`;
        a.click();
        window.URL.revokeObjectURL(url);
        if (i < missions.length - 1) await new Promise(r => setTimeout(r, 300));
      }
      log.info(`Downloaded ${missions.length} KMZ files`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar KMZ');
      log.error('KMZ download error:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleUploadToFH = async () => {
    if (!routePrefix.trim()) { setError('Ingresá un nombre/prefijo para las rutas'); return; }
    setError(null);
    try {
      const missions = buildMissions();
      for (let i = 0; i < missions.length; i++) {
        setUploadProgress(`Subiendo ruta ${i + 1} de ${missions.length}...`);
        await uploadMission(missions[i]);
      }
      setUploadProgress(null);
      log.info(`Uploaded ${missions.length} missions to FlightHub`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir a FlightHub');
      setUploadProgress(null);
      log.error('FH upload error:', err);
    }
  };

  if (points.length === 0) {
    return (
      <div className="route-exporter-container">
        <div className="empty-state"><p>Importá puntos primero.</p></div>
      </div>
    );
  }

  const isBusy = isDownloading || isUploading;

  return (
    <div className="route-exporter-container">

      {/* ── 1. Routes summary ── */}
      <div className="routes-summary" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <h3 style={{ margin: 0 }}>Generated Routes ({routes.length})</h3>
          {editableRoutes && (
            <button
              className="btn-tertiary"
              onClick={() => { setEditableRoutes(null); setEditingRouteId(null); }}
              style={{ fontSize: '11px', padding: '4px 10px' }}
            >
              Restaurar auto
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {routes.map((route, idx) => {
            const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
            const isEditing = editingRouteId === route.id;
            return (
              <div key={route.id} style={{ borderRadius: '8px', border: `2px solid ${color}`, background: '#1e1e1e', overflow: 'hidden' }}>
                {/* Route header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '16px', color, minWidth: '20px' }}>{idx + 1}</span>
                  <span style={{ fontSize: '12px', color: '#ccc' }}>{route.pointCount} puntos</span>
                  <span style={{ fontSize: '11px', color: '#888' }}>{route.totalDistance.toFixed(2)} km</span>
                  {route.exceedsLimits && <span style={{ fontSize: '10px', color: '#f59e0b' }}>⚠ excede</span>}
                  <button
                    className="btn-secondary"
                    onClick={() => setEditingRouteId(isEditing ? null : route.id)}
                    style={{ marginLeft: 'auto', fontSize: '11px', padding: '3px 10px', whiteSpace: 'nowrap' }}
                  >
                    {isEditing ? 'Listo ✓' : '✏ Editar'}
                  </button>
                </div>

                {/* Expanded point editor */}
                {isEditing && (
                  <div style={{ borderTop: `1px solid ${color}33`, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {route.points.map((point, ptIdx) => (
                      <div
                        key={point.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', String(ptIdx))}
                        onDragOver={(e) => { e.preventDefault(); setDragOverIdx({ routeId: route.id, idx: ptIdx }); }}
                        onDragLeave={() => setDragOverIdx(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          const from = Number(e.dataTransfer.getData('text/plain'));
                          movePointInRoute(route.id, from, ptIdx);
                          setDragOverIdx(null);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          background: dragOverIdx?.routeId === route.id && dragOverIdx?.idx === ptIdx ? '#2a2a2a' : '#141414',
                          border: '1px solid #2a2a2a',
                          cursor: 'grab',
                        }}
                      >
                        <span style={{ color: '#555', fontSize: '13px', cursor: 'grab' }}>⠿</span>
                        <span style={{ fontSize: '12px', color: color, minWidth: '18px', fontWeight: 'bold' }}>{ptIdx + 1}</span>
                        <span style={{ flex: 1, fontSize: '12px', color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{point.name}</span>
                        <div style={{ display: 'flex', gap: '2px' }}>
                          <button
                            disabled={ptIdx === 0}
                            onClick={() => movePointInRoute(route.id, ptIdx, ptIdx - 1)}
                            style={{ background: 'transparent', border: '1px solid #333', color: ptIdx === 0 ? '#444' : '#aaa', borderRadius: '3px', padding: '2px 6px', cursor: ptIdx === 0 ? 'default' : 'pointer', fontSize: '11px' }}
                          >↑</button>
                          <button
                            disabled={ptIdx === route.points.length - 1}
                            onClick={() => movePointInRoute(route.id, ptIdx, ptIdx + 1)}
                            style={{ background: 'transparent', border: '1px solid #333', color: ptIdx === route.points.length - 1 ? '#444' : '#aaa', borderRadius: '3px', padding: '2px 6px', cursor: ptIdx === route.points.length - 1 ? 'default' : 'pointer', fontSize: '11px' }}
                          >↓</button>
                        </div>
                        {routes.length > 1 && (
                          <select
                            value=""
                            onChange={(e) => { if (e.target.value) movePointToRoute(route.id, ptIdx, e.target.value); }}
                            style={{ fontSize: '11px', background: '#222', color: '#aaa', border: '1px solid #333', borderRadius: '3px', padding: '2px 4px', cursor: 'pointer' }}
                            title="Mover a otra ruta"
                          >
                            <option value="">→ ruta</option>
                            {routes.filter(r => r.id !== route.id).map(r => (
                              <option key={r.id} value={r.id}>Ruta {routes.indexOf(r) + 1}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 2. Map ── */}
      {routes.length > 0 && (
        <div style={{ height: '360px', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px', border: '1px solid #333' }}>
          <MapContainer center={[0, 0]} zoom={2} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <RoutesMapController routes={routes} dock={selectedDock} />
          </MapContainer>
        </div>
      )}

      {/* ── 3. Export config ── */}
      <div className="export-form">
        <h3>Export KMZ Cenital</h3>

        {/* Route name prefix */}
        <div className="form-group">
          <label>Prefijo del nombre de ruta</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Ej: C-BM-CHU-"
              value={routePrefix}
              onChange={(e) => onRoutePrefixChange(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              className="btn-secondary"
              disabled={isBusy || isSaving || routes.length === 0}
              onClick={async () => {
                const name = routePrefix.trim() || `Sesión ${new Date().toLocaleString()}`;
                setIsSaving(true);
                try { await onSaveSession(name); } finally { setIsSaving(false); }
              }}
              style={{ whiteSpace: 'nowrap', fontSize: '12px' }}
              title="Guarda los puntos y configuración para recuperarlos después"
            >
              {isSaving ? 'Guardando...' : 'Guardar sesión'}
            </button>
          </div>
          {routePrefix && routes.length > 0 && (
            <small style={{ color: '#aaa' }}>
              Se generarán: {routes.map((_, i) => getMissionName(i)).join(', ')}
            </small>
          )}
        </div>

        {/* Drone selector */}
        <div className="form-group">
          <label>Drone</label>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {DRONE_PRESETS.map(preset => (
              <label key={preset.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="dronePreset"
                  value={preset.id}
                  checked={selectedPresetId === preset.id}
                  onChange={() => setSelectedPresetId(preset.id)}
                />
                <span style={{ fontSize: '13px' }}>{preset.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Dock selector */}
        <div className="form-group">
          <label>Dock de despegue</label>
          <select
            value={selectedDeviceIdx ?? ''}
            onChange={e => setSelectedDeviceIdx(e.target.value === '' ? null : Number(e.target.value))}
            style={{ background: '#111', color: '#fff', border: '1px solid #333', borderRadius: '4px', padding: '8px 10px', fontSize: '13px' }}
          >
            <option value="">Sin dock asignado</option>
            {devices.map((device, idx) => {
              const dockLabel = device.parent?.deviceOrganizationCallsign || device.parent?.deviceProjectCallsign || `Dock ${idx + 1}`;
              const droneLabel = device.deviceOrganizationCallsign || device.deviceProjectCallsign || device.deviceModelName;
              return (
                <option key={idx} value={idx}>
                  {dockLabel} · {droneLabel}
                </option>
              );
            })}
          </select>
          {selectedDeviceIdx !== null && devices[selectedDeviceIdx]?.parent && (
            <small style={{ color: '#888' }}>
              {devices[selectedDeviceIdx].parent!.deviceModelName} — {devices[selectedDeviceIdx].parent!.latitude.toFixed(5)}, {devices[selectedDeviceIdx].parent!.longitude.toFixed(5)}
            </small>
          )}
          {devices.length === 0 && (
            <small style={{ color: '#666' }}>No hay docks en caché — abrí FlightHub para sincronizar</small>
          )}
        </div>

        {/* Flight height */}
        <div className="form-group">
          <label>Altura de vuelo (m)</label>
          <input
            type="number"
            min={10}
            max={500}
            value={flightHeight}
            onChange={(e) => setFlightHeight(Number(e.target.value))}
            style={{ width: '100px' }}
          />
          <small>Relativa al punto de despegue</small>
        </div>

        {/* Advanced toggle */}
        <button
          className="btn-tertiary"
          onClick={() => {
            if (!showAdvanced) {
              setCustomDeviceModelKey(selectedPreset.deviceModelKey);
              setCustomPayloadIndex(selectedPreset.payloadIndex);
            }
            setShowAdvanced(v => !v);
          }}
          style={{ fontSize: '12px', marginBottom: '8px' }}
        >
          {showAdvanced ? 'Ocultar' : 'Mostrar'} opciones avanzadas
        </button>

        {showAdvanced && (
          <div style={{ background: '#1a1a1a', padding: '10px', borderRadius: '6px', marginBottom: '10px' }}>
            <div className="form-group">
              <label style={{ fontSize: '12px' }}>deviceModelKey</label>
              <input
                type="text"
                value={customDeviceModelKey}
                onChange={(e) => setCustomDeviceModelKey(e.target.value)}
                placeholder="domain-droneType-droneSubType"
                style={{ fontFamily: 'monospace', fontSize: '12px' }}
              />
            </div>
            <div className="form-group">
              <label style={{ fontSize: '12px' }}>payloadIndex</label>
              <input
                type="text"
                value={customPayloadIndex}
                onChange={(e) => setCustomPayloadIndex(e.target.value)}
                placeholder="payloadType-payloadSubtype-gimbalIndex"
                style={{ fontFamily: 'monospace', fontSize: '12px' }}
              />
            </div>
          </div>
        )}

        <div style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>
          {effectiveDeviceModelKey} · {effectivePayloadIndex} · {flightHeight}m
        </div>

        {error && <div className="error-message">{error}</div>}
        {uploadProgress && <div style={{ color: '#60a5fa', fontSize: '13px', marginBottom: '8px' }}>{uploadProgress}</div>}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn-primary"
            onClick={handleDownloadKmz}
            disabled={isBusy || routes.length === 0}
            style={{ flex: 1 }}
          >
            {isDownloading ? 'Generando...' : `Descargar KMZ (${routes.length})`}
          </button>
          <button
            className="btn-primary"
            onClick={handleUploadToFH}
            disabled={isBusy || routes.length === 0}
            style={{ flex: 1, background: '#059669' }}
          >
            {isUploading ? uploadProgress ?? 'Subiendo...' : `Subir a FlightHub (${routes.length})`}
          </button>
        </div>
      </div>

      {/* ── 4. Resumen para planilla ── */}
      {routes.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          <button
            className="btn-secondary"
            onClick={() => setShowResumen(v => !v)}
            style={{ width: '100%', fontSize: '12px', textAlign: 'left' }}
          >
            {showResumen ? '▲' : '▼'} Resumen para planilla
          </button>

          {showResumen && (() => {
            const header = 'Tipo de ruta\tRuta\tPozo\tActivos';
            const rows = routes.flatMap((route, idx) =>
              route.points.map(pt => `Cenital\t${getMissionName(idx)}\t${pt.name}\t`)
            );
            const tsv = [header, ...rows].join('\n');
            return (
              <div style={{ marginTop: '8px', background: '#111', borderRadius: '8px', border: '1px solid #222', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#888' }}>
                    {rows.length} filas · listo para pegar en Excel / Sheets
                  </span>
                  <button
                    className="btn-primary"
                    style={{ fontSize: '11px', padding: '4px 12px' }}
                    onClick={() => {
                      navigator.clipboard.writeText(tsv);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? '✓ Copiado' : 'Copiar'}
                  </button>
                </div>
                <textarea
                  readOnly
                  value={tsv}
                  onClick={e => (e.target as HTMLTextAreaElement).select()}
                  style={{
                    width: '100%',
                    height: `${Math.min(rows.length + 1, 12) * 22 + 8}px`,
                    background: '#0a0a0a',
                    color: '#ccc',
                    border: '1px solid #2a2a2a',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    padding: '8px',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            );
          })()}
        </div>
      )}

      {debugMode && (
        <div className="debug-info">
          <p>Routes: {routes.length} · Points: {points.length}</p>
          <p>Preset: {effectiveDeviceModelKey} / {effectivePayloadIndex}</p>
        </div>
      )}
    </div>
  );
}
