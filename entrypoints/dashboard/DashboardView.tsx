import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export function DashboardView() {
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
            // This prevents the black screen: it tells the map to 
            // keep showing the level 20 tiles even if you zoom to 22
            maxzoom: 20 
          }
        },
        layers: [{
          id: 'google-satellite',
          type: 'raster',
          source: 'google-satellite'
        }]
      },
      center: [-68.637840983, -38.348942412],
      // --- ZOOM CONSTRAINTS ---
      zoom: 16,
      minZoom: 16, // Roughly 1000m-1500m up (prevents going too far away)
      maxZoom: 20, // Prevents the black screen/disappearing tiles
      pitch: 10,
      bearing: 0,
    });

    map.current = m;

    m.on('load', () => {
      const canvas = m.getCanvas();

      // Update compass UI
      m.on('rotate', () => setRotation(m.getBearing()));

      // Middle Click Logic
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

      window.addEventListener('mouseup', (e) => {
        if (e.button === 1) {
          isMiddleClicking.current = false;
          canvas.style.cursor = '';
        }
      });

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
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#000', position: 'relative', overflow: 'hidden' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {/* COMPASS */}
      <div
        onClick={handleCompassClick}
        style={{
          position: 'absolute', top: 20, right: 20, zIndex: 10,
          width: '60px', height: '60px', borderRadius: '50%',
          backgroundColor: 'rgba(20, 20, 20, 0.85)', border: '2px solid #333',
          cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center',
          color: '#888', fontSize: '11px', fontWeight: 'bold', userSelect: 'none',
          boxShadow: '0 4px 15px rgba(0,0,0,0.6)',
          transform: `rotate(${-rotation}deg)`, 
        }}
      >
        <span style={{ position: 'absolute', top: 4, color: '#ff4444' }}>N</span>
        <span style={{ position: 'absolute', bottom: 4 }}>S</span>
        <span style={{ position: 'absolute', right: 6 }}>E</span>
        <span style={{ position: 'absolute', left: 6 }}>W</span>
        <div style={{ width: '8px', height: '8px', backgroundColor: '#555', borderRadius: '50%' }} />
      </div>

      
    </div>
  );
}