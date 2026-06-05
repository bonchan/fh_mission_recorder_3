import React, { useState } from 'react';
import { createLogger } from '@/utils/logger';
import { calculateDistance, RoutePoint } from '@/utils/routeOptimizer';
import { RouteSettings } from './ManagerRoute';

const log = createLogger('PointList');

interface PointListProps {
  points: RoutePoint[];
  selectedPointId: string | null;
  onPointSelected: (pointId: string | null) => void;
  onPointRemoved: (pointId: string) => void;
  onPointAdded: (point: RoutePoint) => void;
  settings: RouteSettings;
  debugMode?: boolean;
}

export function PointList({
  points,
  selectedPointId,
  onPointSelected,
  onPointRemoved,
  onPointAdded,
  settings,
  debugMode,
}: PointListProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPoint, setNewPoint] = useState({
    name: '',
    latitude: '',
    longitude: '',
    altitude: '',
  });

  const handleAddPoint = () => {
    const { name, latitude, longitude, altitude } = newPoint;

    if (!name || !latitude || !longitude) {
      alert('Please fill in name, latitude, and longitude');
      return;
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const alt = altitude ? parseFloat(altitude) : undefined;

    if (isNaN(lat) || isNaN(lon)) {
      alert('Invalid coordinates');
      return;
    }

    const point: RoutePoint = {
      id: `manual_${Date.now()}`,
      name,
      latitude: lat,
      longitude: lon,
      altitude: alt,
    };

    onPointAdded(point);
    setNewPoint({ name: '', latitude: '', longitude: '', altitude: '' });
    setShowAddForm(false);
    log.info(`Added new point: ${name}`);
  };

  return (
    <div className="point-list-container">
      <div className="points-header">
        <h2>Route Points</h2>
        <button className="btn-add" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? '✕ Cancel' : '➕ Add Point'}
        </button>
      </div>

      {showAddForm && (
        <div className="add-point-form">
          <h3>Add New Point</h3>
          <input
            type="text"
            placeholder="Point name"
            value={newPoint.name}
            onChange={(e) => setNewPoint({ ...newPoint, name: e.target.value })}
          />
          <input
            type="number"
            placeholder="Latitude"
            step="0.000001"
            value={newPoint.latitude}
            onChange={(e) => setNewPoint({ ...newPoint, latitude: e.target.value })}
          />
          <input
            type="number"
            placeholder="Longitude"
            step="0.000001"
            value={newPoint.longitude}
            onChange={(e) => setNewPoint({ ...newPoint, longitude: e.target.value })}
          />
          <input
            type="number"
            placeholder="Altitude (optional)"
            value={newPoint.altitude}
            onChange={(e) => setNewPoint({ ...newPoint, altitude: e.target.value })}
          />
          <button className="btn-primary" onClick={handleAddPoint}>
            ✓ Add
          </button>
        </div>
      )}

      {points.length === 0 ? (
        <div className="empty-state">
          <p>No points in route yet.</p>
        </div>
      ) : (
        <div className="points-list">
          {points.map((point, index) => {
            const nextPoint = index < points.length - 1 ? points[index + 1] : null;
            const distanceToNext = nextPoint
              ? calculateDistance(point, nextPoint)
              : 0;

            return (
              <div
                key={point.id}
                className={`point-item ${selectedPointId === point.id ? 'selected' : ''}`}
                onClick={() => onPointSelected(point.id)}
              >
                <div className="point-number">{index + 1}</div>

                <div className="point-details">
                  <div className="point-name">{point.name}</div>
                  <div className="point-coords">
                    {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                  </div>
                  {point.altitude && (
                    <div className="point-altitude">Alt: {point.altitude.toFixed(2)}m</div>
                  )}
                </div>

                {nextPoint && (
                  <div className="point-distance">
                    <span className="distance-label">To next:</span>
                    <span className="distance-value">{(distanceToNext / 1000).toFixed(2)} km</span>
                  </div>
                )}

                <button
                  className="btn-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPointRemoved(point.id);
                  }}
                  title="Remove this point"
                >
                  🗑️
                </button>
              </div>
            );
          })}
        </div>
      )}

      {points.length > 0 && (
        <div className="points-summary">
          <div className="summary-stat">
            <span className="stat-label">Total Points:</span>
            <span className="stat-value">{points.length}</span>
          </div>
          <div className="summary-stat">
            <span className="stat-label">Total Distance:</span>
            <span className="stat-value">
              {points.length > 1
                ? (points.reduce((sum, p, i) => {
                    if (i < points.length - 1) {
                      return sum + calculateDistance(p, points[i + 1]);
                    }
                    return sum;
                  }, 0) / 1000).toFixed(2)
                : '0.00'}{' '}
              km
            </span>
          </div>
        </div>
      )}

      {debugMode && (
        <div className="debug-info">
          <p>Point IDs: {points.map(p => p.id).join(', ')}</p>
        </div>
      )}
    </div>
  );
}
