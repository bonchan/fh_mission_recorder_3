import React, { RefObject, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import '@geoman-io/leaflet-geoman-free';
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import * as turf from '@turf/turf';
import { HomePoint, MapView, PlanningAnnotation, PolygonGeometry } from '@/utils/interfaces';
import { homeIcon } from '@/utils/mapIcons';
import { parseKmlPolygon } from '@/utils/kml';
import { createLogger } from '@/utils/logger';
import { MapViewSync } from '@/components/flightplanning/MapViewSync';

const log = createLogger('AnnotationsMap');

interface AnnotationsMapProps {
  annotations: PlanningAnnotation[];
  allAnnotations: PlanningAnnotation[];
  polygon: PolygonGeometry | null;
  onPolygonChange: (polygon: PolygonGeometry | null) => void;
  homePoint: HomePoint | null;
  onHomePointChange: (home: HomePoint | null) => void;
  isActive: boolean;
  viewRef: RefObject<MapView | null>;
}

// Frames the whole annotation field the first time it loads, then never moves
// the map again — from there the viewport is the user's to control.
function InitialFocus({ annotations, isActive }: { annotations: PlanningAnnotation[]; isActive: boolean }) {
  const map = useMap();
  const hasFocused = useRef(false);

  useEffect(() => {
    if (hasFocused.current || !isActive || annotations.length === 0) return;
    hasFocused.current = true;

    map.fitBounds(
      L.latLngBounds(annotations.map(a => [a.latitude, a.longitude] as L.LatLngTuple)),
      { padding: [50, 50] }
    );
  }, [annotations, isActive, map]);

  return null;
}

// One-shot map click capture used while placing the home point
function HomePointPlacer({ armed, onPlace }: { armed: boolean; onPlace: (home: HomePoint) => void }) {
  const map = useMap();

  useMapEvents({
    click: (e) => {
      if (!armed) return;
      onPlace({ latitude: e.latlng.lat, longitude: e.latlng.lng });
    },
  });

  useEffect(() => {
    const container = map.getContainer();
    container.style.cursor = armed ? 'crosshair' : '';
    return () => { container.style.cursor = ''; };
  }, [armed, map]);

  return null;
}

// Owns the single filter-polygon layer on the map: wires up leaflet-geoman's
// draw/edit/remove toolbar, and keeps that same layer in sync when the polygon
// instead comes from outside (KML upload, "Clear polygon") so both paths share
// one editable/removable shape instead of two disconnected representations.
function PolygonController({ polygon, onPolygonChange }: { polygon: PolygonGeometry | null; onPolygonChange: (p: PolygonGeometry | null) => void }) {
  const map = useMap();
  const layerRef = useRef<L.Polygon | null>(null);
  const selfUpdateRef = useRef(false);

  useEffect(() => {
    const pm = (map as any).pm;
    pm.addControls({
      position: 'topleft',
      drawMarker: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawRectangle: false,
      drawCircle: false,
      drawText: false,
      editMode: true,
      dragMode: false,
      cutPolygon: false,
      removalMode: true,
    });

    const emit = (layer: L.Polygon) => {
      selfUpdateRef.current = true;
      onPolygonChange((layer.toGeoJSON() as any).geometry);
    };

    const handleCreate = (e: any) => {
      if (layerRef.current) map.removeLayer(layerRef.current);
      layerRef.current = e.layer;
      emit(e.layer);
      e.layer.on('pm:edit', () => emit(e.layer));
    };

    const handleRemove = (e: any) => {
      if (e.layer === layerRef.current) {
        layerRef.current = null;
        selfUpdateRef.current = true;
        onPolygonChange(null);
      }
    };

    map.on('pm:create', handleCreate);
    map.on('pm:remove', handleRemove);

    return () => {
      map.off('pm:create', handleCreate);
      map.off('pm:remove', handleRemove);
      pm.removeControls();
      if (layerRef.current) map.removeLayer(layerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Sync the editable layer when the polygon changed from outside this control
  useEffect(() => {
    if (selfUpdateRef.current) {
      selfUpdateRef.current = false;
      return;
    }

    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    if (polygon) {
      const latlngs = polygon.coordinates[0].map(([lon, lat]) => [lat, lon] as L.LatLngTuple);
      const layer = L.polygon(latlngs, { color: '#ffcc00' }).addTo(map);
      (layer as any).pm.enable();
      layer.on('pm:edit', () => {
        selfUpdateRef.current = true;
        onPolygonChange((layer.toGeoJSON() as any).geometry);
      });
      layerRef.current = layer;
      map.fitBounds(layer.getBounds(), { padding: [40, 40] });
    }
  }, [polygon, map]);

  return null;
}

export function AnnotationsMap({ annotations, allAnnotations, polygon, onPolygonChange, homePoint, onHomePointChange, isActive, viewRef }: AnnotationsMapProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const defaultCenter: L.LatLngTuple = [0, 0];
  const [placingHome, setPlacingHome] = useState(false);

  const handleKmlUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const geometry = parseKmlPolygon(text);
      if (!geometry) throw new Error('No polygon found in that KML file.');
      onPolygonChange(geometry);
    } catch (err: any) {
      log.error('Failed to parse uploaded KML', err);
      alert(err?.message || 'Could not read that KML file.');
    }
  };

  const insidePolygon = (anno: PlanningAnnotation): boolean => {
    if (!polygon) return true;
    return turf.booleanPointInPolygon(
      turf.point([anno.longitude, anno.latitude]),
      turf.polygon(polygon.coordinates)
    );
  };

  return (
    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 1000, display: 'flex', gap: '8px' }}>
        <input ref={fileInputRef} type="file" accept=".kml" onChange={handleKmlUpload} style={{ display: 'none' }} />
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{ background: '#1a1a1a', color: '#fff', border: '1px solid #444', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer' }}
        >
          Upload KML
        </button>
        {polygon && (
          <button
            onClick={() => onPolygonChange(null)}
            style={{ background: '#333', color: '#fff', border: '1px solid #444', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer' }}
          >
            Clear polygon
          </button>
        )}
        <button
          onClick={() => setPlacingHome(prev => !prev)}
          style={{
            background: placingHome ? '#0066ff' : '#1a1a1a',
            color: '#fff',
            border: '1px solid #444',
            borderRadius: '4px',
            padding: '6px 12px',
            cursor: 'pointer',
          }}
        >
          {placingHome ? 'Click map to place H' : homePoint ? 'Move start/end' : 'Set start/end'}
        </button>
        {homePoint && (
          <button
            onClick={() => onHomePointChange(null)}
            style={{ background: '#333', color: '#fff', border: '1px solid #444', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer' }}
          >
            Clear H
          </button>
        )}
      </div>

      <MapContainer center={defaultCenter} zoom={9} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />

        <MapViewSync isActive={isActive} viewRef={viewRef} />
        <InitialFocus annotations={allAnnotations} isActive={isActive} />
        <PolygonController polygon={polygon} onPolygonChange={onPolygonChange} />
        <HomePointPlacer
          armed={placingHome}
          onPlace={(home) => {
            onHomePointChange(home);
            setPlacingHome(false);
          }}
        />

        {homePoint && (
          <Marker
            position={[homePoint.latitude, homePoint.longitude]}
            icon={homeIcon}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const { lat, lng } = e.target.getLatLng();
                onHomePointChange({ latitude: lat, longitude: lng });
              },
            }}
          >
            <Tooltip>Start / end point</Tooltip>
          </Marker>
        )}

        {annotations.map(anno => (
          <CircleMarker
            key={anno.id}
            center={[anno.latitude, anno.longitude]}
            radius={5}
            pathOptions={{
              color: anno.color,
              fillColor: anno.color,
              fillOpacity: insidePolygon(anno) ? 0.9 : 0.15,
              opacity: insidePolygon(anno) ? 1 : 0.3,
            }}
          >
            <Tooltip>{anno.name}</Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
