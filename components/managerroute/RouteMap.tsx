import React, { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
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
          icon={L.icon({
            iconUrl: `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 40"><circle cx="16" cy="12" r="10" fill="%234285F4"/><path d="M16 22 L9 35 Q16 40 16 40 Q16 40 23 35 Z" fill="%234285F4"/><text x="16" y="16" font-size="14" font-weight="bold" text-anchor="middle" fill="white">${index + 1}</text></svg>`,
            iconSize: [32, 40],
            iconAnchor: [16, 40],
            popupAnchor: [0, -40],
          })}
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

      {points.length > 1 && (
        <Polyline
          positions={points.map(p => [p.latitude, p.longitude])}
          color="#FF6B6B"
          weight={3}
          opacity={0.7}
          dashArray="5, 5"
        />
      )}
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
  const exceedsDistance = totalDistance / 1000 > settings.maxDistanceKm;
  const exceedsPoints = points.length > settings.maxPoints;

  return (
    <div className="route-map-container">
      <div className="map-header">
        <div>
          <h2>Route Map</h2>
          {(exceedsDistance || exceedsPoints) && (
            <div className="map-warnings">
              {exceedsDistance && (
                <div className="warning-badge">
                  ⚠️ Distance exceeds {settings.maxDistanceKm} km limit
                </div>
              )}
              {exceedsPoints && (
                <div className="warning-badge">
                  ⚠️ Route has {points.length} points (max: {settings.maxPoints})
                </div>
              )}
            </div>
          )}
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
