import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Compass } from './Compass';

interface MapProps {
  initialCenter?: [number, number];
  initialZoom?: number;
}

export function Map({ 
  initialCenter = [0, 0], 
  initialZoom = 16 
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const isMiddleClicking = useRef(false);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const m = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'google-satellite': {
            type: 'raster',
            tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
            tileSize: 256,
            attribution: '&copy; Google',
            maxzoom: 20
          }
        },
        layers: [{
          id: 'google-satellite',
          type: 'raster',
          source: 'google-satellite'
        }]
      },
      center: initialCenter,
      zoom: initialZoom,
      minZoom: 16,
      maxZoom: 20,
      pitch: 0,
      bearing: 0,
    });

    map.current = m;

    m.on('load', () => {
      const canvas = m.getCanvas();
      m.on('rotate', () => setRotation(m.getBearing()));

      // Orbit Logic
      canvas.addEventListener('mousedown', (e) => {
        if (e.button === 1) {
          isMiddleClicking.current = true;
          canvas.style.cursor = 'crosshair';
          e.preventDefault();
        }
      });

      m.on('mousemove', (e) => {
        if (!isMiddleClicking.current) return;
        m.easeTo({
          bearing: m.getBearing() + e.originalEvent.movementX * 0.4,
          pitch: Math.min(Math.max(m.getPitch() - e.originalEvent.movementY * 0.4, 0), 85),
          duration: 0
        });
      });

      const handleGlobalMouseUp = (e: MouseEvent) => {
        if (e.button === 1) {
          isMiddleClicking.current = false;
          canvas.style.cursor = '';
        }
      };

      window.addEventListener('mouseup', handleGlobalMouseUp);
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    });

    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  const handleCompassClick = () => {
    map.current?.easeTo({ bearing: 0, pitch: 0, duration: 1000 });
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
      <Compass rotation={rotation} onClick={handleCompassClick} />
    </div>
  );
}