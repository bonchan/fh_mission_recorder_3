import React, { RefObject } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as turf from '@turf/turf';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip } from 'react-leaflet';
import { HomePoint, MapView } from '@/utils/interfaces';
import { GeneratedRoute } from '@/utils/routeOptimizer';
import { getDirectionArrowIcon, getRoutePointIcon, homeIcon } from '@/utils/mapIcons';
import { MapViewSync } from '@/components/flightplanning/MapViewSync';

interface RoutesMapProps {
  routes: GeneratedRoute[];
  homePoint: HomePoint | null;
  isActive: boolean;
  viewRef: RefObject<MapView | null>;
  // When set, everything else on the map fades back so the route being
  // hand-edited stays readable
  emphasisRouteId?: string | null;
}

const legsFor = (route: GeneratedRoute, home: HomePoint): L.LatLngTuple[] => [
  [home.latitude, home.longitude],
  ...route.points.map(p => [p.latitude, p.longitude] as L.LatLngTuple),
  [home.latitude, home.longitude],
];

export function RoutesMap({ routes, homePoint, isActive, viewRef, emphasisRouteId = null }: RoutesMapProps) {
  const defaultCenter: L.LatLngTuple = homePoint
    ? [homePoint.latitude, homePoint.longitude]
    : [0, 0];

  const opacityFor = (routeId: string) =>
    !emphasisRouteId || emphasisRouteId === routeId ? 1 : 0.25;

  return (
    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, overflow: 'hidden' }}>
      <MapContainer center={defaultCenter} zoom={11} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />

        <MapViewSync isActive={isActive} viewRef={viewRef} />

        {homePoint && routes.map(route => (
          <Polyline
            key={route.id}
            positions={legsFor(route, homePoint)}
            pathOptions={{ color: route.color, weight: 3, opacity: 0.9 * opacityFor(route.id) }}
          >
            <Tooltip sticky>{route.name}</Tooltip>
          </Polyline>
        ))}

        {homePoint && routes.flatMap(route => {
          const legs = legsFor(route, homePoint);

          return legs.slice(0, -1).map((from, index) => {
            const to = legs[index + 1];
            const midpoint = turf.midpoint([from[1], from[0]], [to[1], to[0]]);
            const bearing = turf.bearing([from[1], from[0]], [to[1], to[0]]);
            const [lon, lat] = midpoint.geometry.coordinates;

            return (
              <Marker
                key={`${route.id}-arrow-${index}`}
                position={[lat, lon]}
                icon={getDirectionArrowIcon(bearing, route.color)}
                interactive={false}
                opacity={opacityFor(route.id)}
              />
            );
          });
        })}

        {routes.flatMap(route =>
          route.points.map((stop, index) => (
            <Marker
              key={`${route.id}-${stop.id}`}
              position={[stop.latitude, stop.longitude]}
              icon={getRoutePointIcon(index + 1, route.color, stop.members.length)}
              opacity={opacityFor(route.id)}
            >
              <Tooltip>
                {`${route.name} · ${index + 1}. ${stop.name}`}
                {stop.members.length > 1 && `: ${stop.members.map(m => m.name).join(', ')}`}
              </Tooltip>
            </Marker>
          ))
        )}

        {homePoint && (
          <Marker position={[homePoint.latitude, homePoint.longitude]} icon={homeIcon}>
            <Tooltip>Start / end point</Tooltip>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
