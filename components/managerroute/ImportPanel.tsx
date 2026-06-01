import React, { useState } from 'react';
import { createLogger } from '@/utils/logger';
import { parseKML } from '@/utils/kmlParser';
import { parseGeoJSON } from '@/utils/geojsonParser';
import { parseCSV } from '@/utils/csvParser';
import { optimizeRoute, RoutePoint } from '@/utils/routeOptimizer';
import { RouteSettings } from './ManagerRoute';
import { SavedRouteSet } from '@/utils/interfaces';

const log = createLogger('ImportPanel');

interface ImportPanelProps {
  points: RoutePoint[];
  onPointsChanged: (points: RoutePoint[]) => void;
  onGoToRoutes: () => void;
  settings: RouteSettings;
  savedSets: SavedRouteSet[];
  onLoadSession: (set: SavedRouteSet) => void;
  onDeleteSession: (id: string) => void;
  debugMode?: boolean;
}

export function ImportPanel({ points, onPointsChanged, onGoToRoutes, settings, savedSets, onLoadSession, onDeleteSession, debugMode }: ImportPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [lastAdded, setLastAdded] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be re-selected
    event.target.value = '';

    setIsLoading(true);
    setError(null);

    try {
      const fileName = file.name.toLowerCase();
      let parsed: RoutePoint[] = [];

      if (fileName.endsWith('.kml')) {
        parsed = (await parseKML(file)) as unknown as RoutePoint[];
      } else if (fileName.endsWith('.geojson') || fileName.endsWith('.json')) {
        parsed = (await parseGeoJSON(file)) as unknown as RoutePoint[];
      } else if (fileName.endsWith('.csv')) {
        parsed = (await parseCSV(file)) as unknown as RoutePoint[];
      } else {
        throw new Error('Formato no soportado. Usá KML, GeoJSON o CSV.');
      }

      if (parsed.length === 0) throw new Error('No se encontraron puntos en el archivo.');

      const dedupedParsed = parsed.map(p => ({ ...p, id: crypto.randomUUID() }));
      onPointsChanged([...points, ...dedupedParsed]);
      setLastAdded(parsed.length);
      log.info(`Added ${parsed.length} points from ${fileName}, total: ${points.length + parsed.length}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al leer el archivo');
      log.error('Import error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOptimizeAndGo = () => {
    if (points.length === 0) return;
    const optimized = optimizeRoute(points);
    onPointsChanged(optimized.points);
    onGoToRoutes();
  };

  const handleClear = () => {
    if (points.length > 0 && window.confirm(`¿Eliminar los ${points.length} puntos cargados?`)) {
      onPointsChanged([]);
      setLastAdded(null);
    }
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="import-panel">

      {/* ── Saved sessions ── */}
      {savedSets.length > 0 && (
        <div className="import-section" style={{ marginBottom: '16px' }}>
          <h3>Sesiones guardadas ({savedSets.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
            {savedSets.map(set => (
              <div key={set.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: '#1e1e1e', borderRadius: '6px', border: '1px solid #333' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {set.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#888' }}>
                    {set.points.length} puntos · {formatDate(set.createdDate)}
                    {set.routePrefix && ` · prefijo: ${set.routePrefix}`}
                  </div>
                </div>
                <button className="btn-primary" onClick={() => onLoadSession(set)} style={{ fontSize: '12px', padding: '4px 10px', whiteSpace: 'nowrap' }}>
                  Cargar
                </button>
                <button className="btn-tertiary" onClick={() => { if (window.confirm(`Eliminar "${set.name}"?`)) onDeleteSession(set.id); }} style={{ fontSize: '12px', padding: '4px 8px', color: '#ef4444' }}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── File import ── */}
      <div className="import-section">
        <h2>Importar puntos</h2>

        <div className="upload-box">
          <input
            type="file"
            accept=".kml,.geojson,.json,.csv"
            onChange={handleFileUpload}
            disabled={isLoading}
            id="file-input"
          />
          <label htmlFor="file-input" className="upload-label">
            {isLoading ? 'Leyendo archivo...' : 'Elegir archivo KML / GeoJSON / CSV'}
          </label>
        </div>

        {error && <div className="error-message">{error}</div>}

        {lastAdded !== null && (
          <div style={{ fontSize: '12px', color: '#34d399', marginTop: '6px' }}>
            +{lastAdded} puntos agregados
          </div>
        )}

        {/* ── Accumulated points ── */}
        {points.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <strong style={{ fontSize: '14px' }}>{points.length} puntos cargados</strong>
              <button className="btn-tertiary" onClick={handleClear} style={{ fontSize: '12px', color: '#ef4444' }}>
                Limpiar todo
              </button>
            </div>

            <div className="points-preview">
              {points.slice(0, 6).map((p) => (
                <div key={p.id} className="preview-item">
                  <div className="preview-name">{p.name}</div>
                  <div className="preview-coords">{p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}</div>
                </div>
              ))}
              {points.length > 6 && (
                <div className="preview-more">+{points.length - 6} más</div>
              )}
            </div>

            <button className="btn-primary" onClick={handleOptimizeAndGo} style={{ width: '100%', marginTop: '12px' }}>
              Optimizar y ver rutas →
            </button>
          </div>
        )}

        {debugMode && <div className="debug-info"><p>Total points: {points.length}</p></div>}
      </div>
    </div>
  );
}
