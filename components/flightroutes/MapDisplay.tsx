import React, { useEffect, useRef, useState } from 'react';
import { createLogger } from '@/utils/logger';

import { Marker, MapContainer, TileLayer, Circle, Tooltip, Polyline, useMap, useMapEvents, LayersControl, LayerGroup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import { Dock, FlightRoute } from '@/utils/interfaces';
import { getStatusColor } from '@/utils/utils'
import { dockFullIcon, dockEmptyIcon, getRotatedDroneIcon } from '@/utils/mapIcons'

const log = createLogger('MapDisplay');

// --- Types & Interfaces ---
export interface Waypoint {
  latitude: number;
  longitude: number;
}

export interface Annotation {
  id: string | number;
  latitude: number;
  longitude: number;
  name: string;
  compromised?: boolean;
  color?: string;
}

export interface ValidationResult {
  flight_route_id: string | number;
  compromised: boolean;
  safe_waypoints: Waypoint[];
}

export interface MapSettings {
  circleBuffer: number;
}

interface BoundsHandlerProps {
  annotations: Annotation[];
}

interface MapControllerProps {
  annotations: Annotation[];
  focusedAnnoId: string | number | null;
}

interface ViewportTrackerProps {
  setBounds: React.Dispatch<React.SetStateAction<L.LatLngBounds | null>>;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
}

interface MapDisplayProps {
  devices: Drone[];
  settings: MapSettings;
  routes: FlightRoute[];
  annotations: Annotation[];
  compromisedAnnotations: Annotation[];
  focusedAnnoId: string | number | null;
  setFocusedAnnoId: (id: string | number | null) => void;
}

// Logic for initial "Fit All" view
const BoundsHandler: React.FC<BoundsHandlerProps> = ({ annotations }) => {
  const map = useMap();
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Only run if we have data AND we haven't fitted the bounds yet
    if (annotations.length > 0 && !hasInitialized.current) {
      const bounds = L.latLngBounds(annotations.map(a => [a.latitude, a.longitude]));
      map.fitBounds(bounds, { padding: [50, 50] });

      // Mark as done so it never runs again during this session
      hasInitialized.current = true;
    }
  }, [annotations, map]);

  return null;
};

// Logic for "Jump to Item" when clicked in sidebar
const MapController: React.FC<MapControllerProps> = ({ annotations, focusedAnnoId }) => {
  const map = useMap();
  useEffect(() => {
    if (focusedAnnoId) {
      const target = annotations.find(a => a.id === focusedAnnoId);
      if (target) {
        map.setView([target.latitude, target.longitude], map.getZoom(), { animate: true });
      }
    }
  }, [focusedAnnoId, map, annotations]);
  return null;
};

const ViewportTracker: React.FC<ViewportTrackerProps> = ({ setBounds, setZoom }) => {
  const map = useMapEvents({
    moveend: () => {
      setBounds(map.getBounds());
      setZoom(map.getZoom());
    },
    zoomend: () => { // 👈 Explicitly catch zoom events
      setBounds(map.getBounds());
      setZoom(map.getZoom());
    }
  });

  useEffect(() => {
    setBounds(map.getBounds());
    setZoom(map.getZoom());
  }, [map, setBounds, setZoom]);

  return null;
};

// --- Main Component ---

const MapDisplay: React.FC<MapDisplayProps> = ({
  devices,
  settings,
  routes,
  annotations,
  compromisedAnnotations,
  focusedAnnoId,
  setFocusedAnnoId
}) => {
  const MAX_ANNOTATIONS = 500
  const START_ZOOM = 9
  const { circleBuffer } = settings;
  const defaultCenter: L.LatLngTuple = [0, 0];
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);
  const [currentZoom, setCurrentZoom] = useState(START_ZOOM);

  // const [layerVisibility, setLayerVisibility] = useState({
  //   estimatedAreas: true,
  //   originalRoutes: true,
  //   validatedPaths: true,
  // });

  const compromisedIds = new Set(compromisedAnnotations.map(a => a.id));

  const mapCompromisedAnnotations = compromisedAnnotations
    .filter(a => {
      if (!bounds) return false;
      return bounds.contains([a.latitude, a.longitude]);
    })
    .slice(0, MAX_ANNOTATIONS);

  const mapAnnotations = annotations
    .filter(a => {
      if (!bounds) return false;
      if (compromisedIds.has(a.id)) return false;
      return bounds.contains([a.latitude, a.longitude]);
    })
    .slice(0, MAX_ANNOTATIONS - mapCompromisedAnnotations.length);

  return (
    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, overflow: 'hidden' }}>
      <MapContainer
        center={defaultCenter}
        zoom={currentZoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false} // Cleaner look
      >
        {/* Invisible Utility Components stay outside the LayersControl */}
        <BoundsHandler annotations={compromisedAnnotations} />
        <MapController annotations={compromisedAnnotations} focusedAnnoId={focusedAnnoId} />
        <ViewportTracker setBounds={setBounds} setZoom={setCurrentZoom} />

        {/* --- THE LAYERS CONTROL --- */}
        <LayersControl position="topright">

          {/* 1. Standard OpenStreetMap */}
          <LayersControl.BaseLayer name="OpenStreetMap">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>

          {/* 2. Apple Maps Alternative: CartoDB Positron (Very clean, modern, light gray) */}
          <LayersControl.BaseLayer name="Clean Streets (CartoDB)">
            <TileLayer
              attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
          </LayersControl.BaseLayer>

          {/* 3. Google Earth Alternative: Esri World Imagery (High-res Satellite) */}
          <LayersControl.BaseLayer name="Satellite (Esri)" checked>
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>

          {/* TOGGLE 1: Flight Routes */}
          {/* 🟢 TOGGLE 1: Estimated Areas (Circles) */}
          <LayersControl.Overlay name="Estimated Areas (Circles)" checked> {/* = {layerVisibility.estimatedAreas}> */}
            <LayerGroup>
              {routes.map(route => {
                const hasWaypoints = route.originalWaypoints && route.originalWaypoints.length > 0;
                const hasCircleData = route.startLat != null && route.startLon != null && route.distance != null;

                // SKIP if it has waypoints, we only want the circles here!
                if (hasWaypoints || !hasCircleData) return null;

                const circleColor = getStatusColor(route.safetyStatus)

                return (
                  <Circle
                    key={`circle-${route.id}`}
                    center={[route.startLat!, route.startLon!]}
                    radius={route.distance!}
                    pathOptions={{ color: circleColor, weight: 2, fillColor: circleColor, fillOpacity: 0.15 }}
                  >
                    <Tooltip sticky className="custom-label">
                      ✈️ {route.name} (Estimated Area)
                    </Tooltip>
                  </Circle>
                );
              })}
            </LayerGroup>
          </LayersControl.Overlay>

          {/* 🟢 TOGGLE 2: Original Flight Routes (Solid Lines) */}
          <LayersControl.Overlay name="Original Flight Routes" checked>
            <LayerGroup>
              {routes.map(route => {
                const hasWaypoints = route.originalWaypoints && route.originalWaypoints.length > 0;
                if (!hasWaypoints) return null;

                // 👇 Look how much cleaner this is! No more searching validation arrays.
                const lineColor = getStatusColor(route.safetyStatus);

                return (
                  <Polyline
                    key={`line-${route.id}`}
                    positions={route.originalWaypoints.map(wp => [wp.latitude, wp.longitude])}
                    pathOptions={{ color: lineColor, weight: 4, opacity: 1 }}
                  >
                    <Tooltip sticky className="custom-label">
                      ✈️ {route.name}
                    </Tooltip>
                  </Polyline>
                );
              })}
            </LayerGroup>
          </LayersControl.Overlay>

          {/* 🟢 TOGGLE 3: Validated Safe Paths (Dashed Lines) */}
          <LayersControl.Overlay name="Validated Safe Paths" checked>
            <LayerGroup>
              {routes.map(route => {
                if (route.safetyStatus !== 'PATH_COMPROMISED') return null;

                if (route.safeWaypoints == undefined) return null

                if (!(route.safeWaypoints && route.safeWaypoints.length > 0)) return null;

                if (route.safeWaypoints.length === 0) return null;

                return (
                  <Polyline
                    key={`safe-${route.id}`}
                    positions={route.safeWaypoints.map(wp => [wp.latitude, wp.longitude])}
                    pathOptions={{
                      color: '#ffc107', // Warning yellow/orange for the bypass route
                      weight: 3,
                      dashArray: '10, 10',
                      opacity: 1
                    }}
                  />
                );
              })}
            </LayerGroup>
          </LayersControl.Overlay>

          {/* TOGGLE 2: Danger Zones (Annotations) */}
          <LayersControl.Overlay name="Danger Zones" checked>
            <LayerGroup>
              {mapCompromisedAnnotations.map(anno => (
                <Circle
                  key={anno.id}
                  center={[anno.latitude, anno.longitude]}
                  radius={circleBuffer}
                  pathOptions={{
                    color: anno.color || 'red',
                    fillColor: anno.color || 'red',
                    fillOpacity: 0.5,
                    weight: focusedAnnoId === anno.id ? 3 : 1
                  }}
                  eventHandlers={{
                    click: () => setFocusedAnnoId(anno.id),
                  }}
                >
                  {(currentZoom && currentZoom > START_ZOOM) && (
                    <Tooltip
                      permanent
                      direction="top"
                      offset={[0, -5]}
                      className="custom-label"
                    >
                      {anno.name}
                    </Tooltip>
                  )}
                </Circle>
              ))}
            </LayerGroup>
          </LayersControl.Overlay>

          {/* TOGGLE 3: Annotations */}
          <LayersControl.Overlay name="Annotations" checked>
            <LayerGroup>
              {mapAnnotations.map(anno => (
                <Circle
                  key={anno.id}
                  center={[anno.latitude, anno.longitude]}
                  radius={100}
                  pathOptions={{
                    color: anno.color || 'red',
                    fillColor: anno.color || 'red',
                    fillOpacity: 0.0,
                    weight: focusedAnnoId === anno.id ? 3 : 1
                  }}
                  eventHandlers={{
                    click: () => setFocusedAnnoId(anno.id),
                  }}
                >
                  {(currentZoom > 15) && (
                    <Tooltip
                      permanent
                      direction="top"
                      offset={[0, -5]}
                      className="custom-label"
                    >
                      {anno.name}
                    </Tooltip>
                  )}
                </Circle>
              ))}
            </LayerGroup>
          </LayersControl.Overlay>

          {/* TOGGLE 3: Docks */}
          <LayersControl.Overlay name="Docks" checked>
            <LayerGroup>
              {devices && devices.map(device => {
                const parent = device.parent
                if (parent == null) return null
                return (
                  <Marker
                    key={parent.deviceSn}
                    position={[parent.latitude, parent.longitude]}
                    icon={parent.droneInDock ? dockFullIcon : dockEmptyIcon}
                  // eventHandlers={{
                  //   click: () => setFocusedAnnoId(device.id),
                  // }}
                  >
                    {(currentZoom > 10) && (
                      <Tooltip
                        permanent
                        direction="top"
                        className="custom-label"
                      >
                        {parent.deviceOrganizationCallsign}
                      </Tooltip>
                    )}
                  </Marker>
                )
              })}
            </LayerGroup>
          </LayersControl.Overlay>

          {/* TOGGLE 3: Drones */}
          <LayersControl.Overlay name="Drones" checked>
            <LayerGroup>
              {devices && devices.map(device => {
                const parent = device.parent
                if (parent == null || parent.droneInDock) return null
                return (
                  <Marker
                    key={device.deviceSn}
                    position={[device.latitude, device.longitude]}
                    icon={getRotatedDroneIcon(device.yaw)}
                  // eventHandlers={{
                  //   click: () => setFocusedAnnoId(device.id),
                  // }}
                  >
                    {(currentZoom > 10) && (
                      <Tooltip
                        permanent
                        direction="top"
                        className="custom-label"
                      >
                        {device.deviceOrganizationCallsign}
                      </Tooltip>
                    )}
                  </Marker>
                )
              })}
            </LayerGroup>
          </LayersControl.Overlay>

        </LayersControl>
      </MapContainer>
    </div>
  );
};

export default MapDisplay;