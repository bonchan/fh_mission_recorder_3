import React, { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L, { LatLng } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { createLogger } from '@/utils/logger';
import { calculateTotalDistance, RoutePoint } from '@/utils/routeOptimizer';
import { RouteSettings } from './ManagerRoute';

const log = createLogger('RouteMap');

interface RouteMapProps {
  points: RoutePoint[];
  selectedPointId: string | null;
  onPointSelected: (pointId: string | null) => void;
  onPointsReordered: (points: RoutePoint[]) => void;
  settings: RouteSettings;
  debugMode?: boolean;
}

function MapController({
  points,
  onPointsReordered,
}: {
  points: RoutePoint[];
  onPointsReordered: (points: RoutePoint[]) => void;
}) {
  const map = useMap();
  const [draggedMarker, setDraggedMarker] = useState<{
    index: number;
    originalLatLng: LatLng;
  } | null>(null);

  useMapEvents({
    click: () => {
      // Deselect on map click
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

  const handleMarkerDragStart = (index: number) => {
    const point = points[index];
    setDraggedMarker({
      index,
      originalLatLng: new LatLng(point.latitude, point.longitude),
    });
  };

  const handleMarkerDragEnd = (index: number, newLatLng: LatLng) => {
    const updatedPoints = [...points];
    updatedPoints[index] = {
      ...updatedPoints[index],
      latitude: newLatLng.lat,
      longitude: newLatLng.lng,
    };
    onPointsReordered(updatedPoints);
    setDraggedMarker(null);
  };

  return (
    <>
      {points.map((point, index) => (
        <Marker
          key={point.id}
          position={[point.latitude, point.longitude]}
          draggable={true}
          eventHandlers={{
            dragstart: () => handleMarkerDragStart(index),
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
  settings,
  debugMode,
}: RouteMapProps) {
  const center: [number, number] = [0, 0];
  const totalDistance = calculateTotalDistance(points);

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
          <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapController points={points} onPointsReordered={onPointsReordered} />
          </MapContainer>

          <div className="map-info">
            <p>💡 Drag markers to reorder points</p>
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
