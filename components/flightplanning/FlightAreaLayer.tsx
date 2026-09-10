import React from 'react';
import L from 'leaflet';
import { Circle, LayerGroup, Polygon, Tooltip } from 'react-leaflet';
import { FlightArea } from '@/utils/interfaces';
import { createLogger } from '@/utils/logger';

const log = createLogger('FlightAreaLayer');

// GeoJSON is [lon, lat]; Leaflet wants [lat, lon]
const toLatLng = ([lon, lat]: number[]): L.LatLngTuple => [lat, lon];

// A circle's centre arrives either as a bare [lon, lat] or wrapped in an array
const toCentre = (coordinates: any): L.LatLngTuple | null => {
  if (!Array.isArray(coordinates)) return null;

  const [first] = coordinates;
  if (typeof first === 'number') return toLatLng(coordinates);
  if (Array.isArray(first) && typeof first[0] === 'number') return toLatLng(first);

  return null;
};

// A polygon is an array of rings, but tolerate a single bare ring too
const toRings = (coordinates: any): L.LatLngTuple[][] | null => {
  if (!Array.isArray(coordinates)) return null;

  const [firstRing] = coordinates;
  if (!Array.isArray(firstRing)) return null;

  if (typeof firstRing[0] === 'number') return [coordinates.map(toLatLng)];
  if (Array.isArray(firstRing[0])) return coordinates.map((ring: number[][]) => ring.map(toLatLng));

  return null;
};

export function FlightAreaLayer({ areas }: { areas: FlightArea[] }) {
  return (
    <LayerGroup>
      {areas.map(area => {
        const { geometry } = area.content;
        const style = {
          color: area.color,
          fillColor: area.color,
          fillOpacity: 0.12,
          weight: 2,
        };
        const label = `${area.name} · ${area.type}${area.status === 'enable' ? '' : ` · ${area.status}`}`;

        if (geometry.radius != null) {
          const centre = toCentre(geometry.coordinates);
          if (!centre) {
            log.warn(`Flight area ${area.id} has a radius but an unreadable centre`, geometry.coordinates);
            return null;
          }

          return (
            <Circle key={area.id} center={centre} radius={geometry.radius} pathOptions={style}>
              <Tooltip sticky>{label}</Tooltip>
            </Circle>
          );
        }

        const rings = toRings(geometry.coordinates);
        if (!rings) {
          log.warn(`Flight area ${area.id} has unreadable coordinates`, geometry.coordinates);
          return null;
        }

        return (
          <Polygon key={area.id} positions={rings} pathOptions={style}>
            <Tooltip sticky>{label}</Tooltip>
          </Polygon>
        );
      })}
    </LayerGroup>
  );
}
