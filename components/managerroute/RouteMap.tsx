import React, { useEffect, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polygon,
  Polyline,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L, { LatLng } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { createLogger } from '@/utils/logger';
import { calculateTotalDistance, RoutePoint } from '@/utils/routeOptimizer';
import { RouteSettings } from './ManagerRoute';
import { PolygonCoords } from '@/utils/polygonFilter';

const log = createLogger('RouteMap');

interface RouteMapProps {
  points: RoutePoint[];
  selectedPointId: string | null;
  onPointSelected: (pointId: string | null) => void;
  onPointsReordered: (points: RoutePoint[]) => void;
  polygon: PolygonCoords | null;
  onPolygonChanged: (polygon: PolygonCoords | null) => void;
  onFilterByPolygon: () => void;
  settings: RouteSettings;
  debugMode?: boolean;
}

function MapController({
  points,
  onPointsReordered,
  drawMode,
  onAddVertex,
}: {
  points: RoutePoint[];
  onPointsReordered: (points: RoutePoint[]) => void;
  drawMode: boolean;
  onAddVertex: (lat: number, lng: number) => void;
}) {
  const map = useMap();

  useMapEvents({
    click: (e) => {
      if (drawMode) {
        onAddVertex(e.latlng.lat, e.latlng.lng);
      }
    },
  });

  // Auto-fit bounds when points change
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(
      points.map(p => [p.latitude, p.longitude] as [number, number])
    );
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [points, map]);

  const handleMarkerDragEnd = (index: number, newLatLng: LatLng) => {
    const updatedPoints = [...points];
    updatedPoints[index] = {
      ...updatedPoints[index],
      latitude: newLatLng.lat,
      longitude: newLatLng.lng,
    };
    onPointsReordered(updatedPoints);
  };

  return (
    <>
      {points.map((point, index) => (
        <Marker
          key={point.id}
          position={[point.latitude, point.longitude]}
          draggable={!drawMode}
          eventHandlers={{
            dragend: (event) => {
              const marker = event.target;
              handleMarkerDragEnd(index, marker.getLatLng());
            },
          }}
          icon={(() => {
            const label = point.name;
            const charW = 7.5;
            const padX = 12;
            const w = Math.max(40, Math.ceil(label.length * charW + padX * 2));
            const h = 28;
            const tipH = 8;
            const total = h + tipH;
            const cx = w / 2;
            return L.icon({
              iconUrl: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${total}"><rect x="0" y="0" width="${w}" height="${h}" rx="5" fill="#4285F4"/><path d="M${cx} ${h} L${cx - 6} ${h} Q${cx} ${total} ${cx} ${total} Q${cx} ${total} ${cx + 6} ${h} Z" fill="#4285F4"/><text x="${cx}" y="${h * 0.68}" font-size="12" font-weight="600" font-family="system-ui,sans-serif" text-anchor="middle" fill="white">${label}</text></svg>`)}`,
              iconSize: [w, total],
              iconAnchor: [cx, total],
              popupAnchor: [0, -total],
            });
          })()}
        >
          <Popup>
            <div className="marker-popup">
              <div className="popup-title">{point.name}</div>
              <div className="popup-coords">
                {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
              </div>
              {point.altitude && (
                <div className="popup-altitude">Altitude: {point.altitude.toFixed(2)}m</div>
              )}
              {point.description && (
                <div className="popup-description">{point.description}</div>
              )}
              <div className="popup-order">Point #{index + 1}</div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

export function RouteMap({
  points,
  selectedPointId,
  onPointSelected,
  onPointsReordered,
  polygon,
  onPolygonChanged,
  onFilterByPolygon,
  settings,
  debugMode,
}: RouteMapProps) {
  const center: [number, number] = [0, 0];
  const totalDistance = calculateTotalDistance(points);
  const [drawMode, setDrawMode] = useState(false);
  const [draftVertices, setDraftVertices] = useState<PolygonCoords>([]);

  const handleAddVertex = (lat: number, lng: number) => {
    setDraftVertices(prev => [...prev, [lat, lng]]);
  };

  const handleFinishDraw = () => {
    if (draftVertices.length >= 3) {
      onPolygonChanged(draftVertices);
    }
    setDrawMode(false);
    setDraftVertices([]);
  };

  const handleCancelDraw = () => {
    setDrawMode(false);
    setDraftVertices([]);
  };

  const handleStartDraw = () => {
    setDraftVertices([]);
    onPolygonChanged(null);
    setDrawMode(true);
  };

  const handleUndoVertex = () => {
    setDraftVertices(prev => prev.slice(0, -1));
  };

  const handleClearPolygon = () => {
    onPolygonChanged(null);
    setDraftVertices([]);
  };

  const activePolygon = drawMode ? draftVertices : polygon;

  return (
    <div className="route-map-container">
      <div className="map-header">
        <div>
          <h2>Route Map</h2>
        </div>
        <div className="map-stats">
          <span>📍 Points: {points.length}</span>
          <span>📏 Distance: {(totalDistance / 1000).toFixed(2)} km</span>
        </div>
      </div>

      {points.length > 0 ? (
        <div className="map-wrapper">
          <MapContainer
            center={center}
            zoom={13}
            style={{ height: '100%', width: '100%', cursor: drawMode ? 'crosshair' : '' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapController
              points={points}
              onPointsReordered={onPointsReordered}
              drawMode={drawMode}
              onAddVertex={handleAddVertex}
            />

            {/* Polygon layer (from file or drawn) */}
            {activePolygon && activePolygon.length >= 3 && (
              <Polygon
                positions={activePolygon}
                pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.15, weight: 2 }}
              />
            )}

            {/* Draft polyline while drawing (shows open edge) */}
            {drawMode && draftVertices.length >= 2 && (
              <Polyline
                positions={draftVertices}
                pathOptions={{ color: '#f59e0b', weight: 2, dashArray: '6 4' }}
              />
            )}
          </MapContainer>

          {/* Polygon controls overlay */}
          <div style={{
            position: 'absolute',
            bottom: '60px',
            right: '10px',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}>
            {!drawMode && (
              <>
                <button
                  className="btn-primary"
                  onClick={handleStartDraw}
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                  title="Dibujá un polígono en el mapa para filtrar puntos"
                >
                  ✏️ Dibujar polígono
                </button>
                {polygon && polygon.length >= 3 && (
                  <>
                    <button
                      className="btn-primary"
                      onClick={onFilterByPolygon}
                      style={{ fontSize: '12px', padding: '6px 12px', background: '#16a34a' }}
                    >
                      ✅ Aplicar filtro ({polygon.length} vértices)
                    </button>
                    <button
                      className="btn-tertiary"
                      onClick={handleClearPolygon}
                      style={{ fontSize: '12px', padding: '6px 12px', color: '#ef4444' }}
                    >
                      🗑️ Borrar polígono
                    </button>
                  </>
                )}
              </>
            )}

            {drawMode && (
              <>
                <div style={{
                  background: '#1e1e1e',
                  border: '1px solid #f59e0b',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '11px',
                  color: '#f59e0b',
                  textAlign: 'center',
                }}>
                  Clic para agregar vértices<br />
                  <strong>{draftVertices.length}</strong> vértice{draftVertices.length !== 1 ? 's' : ''}
                </div>
                {draftVertices.length > 0 && (
                  <button
                    className="btn-tertiary"
                    onClick={handleUndoVertex}
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    ↩ Deshacer
                  </button>
                )}
                <button
                  className="btn-primary"
                  onClick={handleFinishDraw}
                  disabled={draftVertices.length < 3}
                  style={{ fontSize: '12px', padding: '6px 12px', background: draftVertices.length >= 3 ? '#16a34a' : undefined }}
                >
                  ✔ Terminar ({draftVertices.length >= 3 ? 'listo' : `necesitás ${3 - draftVertices.length} más`})
                </button>
                <button
                  className="btn-tertiary"
                  onClick={handleCancelDraw}
                  style={{ fontSize: '12px', padding: '6px 12px', color: '#ef4444' }}
                >
                  ✕ Cancelar
                </button>
              </>
            )}
          </div>

          <div className="map-info">
            <p>💡 Arrastrá los marcadores para moverlos · Dibujá un polígono para filtrar</p>
            <p>Total route distance: <strong>{(totalDistance / 1000).toFixed(2)} km</strong></p>
            {points.length > 1 && (
              <p>Avg. segment: <strong>{(totalDistance / (points.length - 1) / 1000).toFixed(2)} km</strong></p>
            )}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <p>No points imported yet. Go to Import tab to add points.</p>
        </div>
      )}
    </div>
  );
}
