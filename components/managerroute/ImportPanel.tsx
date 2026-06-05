import React, { useState } from 'react';
import { createLogger } from '@/utils/logger';
import { parseKML } from '@/utils/kmlParser';
import { parseGeoJSON } from '@/utils/geojsonParser';
import { parseCSV } from '@/utils/csvParser';
import { optimizeRoute, RoutePoint } from '@/utils/routeOptimizer';
import { RouteSettings } from './ManagerRoute';
import { SavedRouteSet, PointGroup } from '@/utils/interfaces';
import { PolygonCoords, parseKMLPolygon, parseGeoJSONPolygon, isPointInPolygon } from '@/utils/polygonFilter';

const log = createLogger('ImportPanel');

const GROUP_COLORS = [
  '#4285F4', '#EA4335', '#FBBC04', '#34A853',
  '#FF6D00', '#7B1FA2', '#00897B', '#F06292',
];

interface ImportPanelProps {
  points: RoutePoint[];
  groups: PointGroup[];
  onPointsChanged: (points: RoutePoint[], groups?: PointGroup[]) => void;
  onGroupsChanged: (groups: PointGroup[]) => void;
  onGoToRoutes: () => void;
  onGoToMap: () => void;
  settings: RouteSettings;
  savedSets: SavedRouteSet[];
  onLoadSession: (set: SavedRouteSet) => void;
  onDeleteSession: (id: string) => void;
  polygon: PolygonCoords | null;
  onPolygonChanged: (polygon: PolygonCoords | null) => void;
  onFilterByPolygon: () => void;
  excludedCount: number;
  onRestoreExcluded: () => void;
  debugMode?: boolean;
}

export function ImportPanel({
  points, groups, onPointsChanged, onGroupsChanged,
  onGoToRoutes, onGoToMap, settings, savedSets, onLoadSession, onDeleteSession,
  polygon, onPolygonChanged, onFilterByPolygon, excludedCount, onRestoreExcluded, debugMode,
}: ImportPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [lastAdded, setLastAdded] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polygonName, setPolygonName] = useState<string | null>(null);
  const [polygonError, setPolygonError] = useState<string | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
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

      const groupId = crypto.randomUUID();
      const groupName = file.name.replace(/\.[^.]+$/, '');
      const nextBatchId = groups.length > 0 ? Math.max(...groups.map(g => g.batchId)) + 1 : 1;

      const newGroup: PointGroup = { id: groupId, name: groupName, batchId: nextBatchId };
      const newGroups = [...groups, newGroup];

      const newPoints = parsed.map(p => ({
        ...p,
        id: crypto.randomUUID(),
        groupId,
        groupName,
      }));

      onPointsChanged([...points, ...newPoints], newGroups);
      setLastAdded(parsed.length);
      log.info(`Added ${parsed.length} points from ${file.name} as group "${groupName}" (batch ${nextBatchId})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al leer el archivo');
      log.error('Import error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePolygonFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    setPolygonError(null);

    try {
      const fileName = file.name.toLowerCase();
      let coords: PolygonCoords | null = null;

      if (fileName.endsWith('.kml') || fileName.endsWith('.kmz')) {
        coords = await parseKMLPolygon(file);
      } else if (fileName.endsWith('.geojson') || fileName.endsWith('.json')) {
        coords = await parseGeoJSONPolygon(file);
      } else {
        throw new Error('Formato no soportado. Usá KML o GeoJSON.');
      }

      if (!coords || coords.length < 3) {
        throw new Error('No se encontró un polígono válido en el archivo.');
      }

      onPolygonChanged(coords);
      setPolygonName(file.name.replace(/\.[^.]+$/, ''));
      log.info(`Polygon loaded: ${coords.length} vertices from ${file.name}`);
    } catch (err) {
      setPolygonError(err instanceof Error ? err.message : 'Error al leer el polígono');
      log.error('Polygon import error:', err);
    }
  };

  const handleRemoveGroup = (groupId: string) => {
    const newPoints = points.filter(p => p.groupId !== groupId);
    const newGroups = groups.filter(g => g.id !== groupId);
    onPointsChanged(newPoints, newGroups);
  };

  const handleBatchChange = (groupId: string, batchId: number) => {
    onGroupsChanged(groups.map(g => g.id === groupId ? { ...g, batchId } : g));
  };

  const handleOptimizeAndGo = () => {
    if (points.length === 0) return;
    const optimized = optimizeRoute(points);
    onPointsChanged(optimized.points);
    onGoToRoutes();
  };

  const handleClear = () => {
    if (points.length > 0 && window.confirm(`¿Eliminar los ${points.length} puntos cargados?`)) {
      onPointsChanged([], []);
      setLastAdded(null);
    }
  };

  const pointsInsidePolygon = polygon
    ? points.filter(p => isPointInPolygon(p.latitude, p.longitude, polygon)).length
    : 0;

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const maxBatch = groups.length > 0 ? Math.max(...groups.map(g => g.batchId)) : 1;

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
                  <div style={{ fontWeight: 'bold', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{set.name}</div>
                  <div style={{ fontSize: '11px', color: '#888' }}>
                    {set.points.length} puntos · {formatDate(set.createdDate)}
                    {set.routePrefix && ` · prefijo: ${set.routePrefix}`}
                  </div>
                </div>
                <button className="btn-primary" onClick={() => onLoadSession(set)} style={{ fontSize: '12px', padding: '4px 10px', whiteSpace: 'nowrap' }}>Cargar</button>
                <button className="btn-tertiary" onClick={() => { if (window.confirm(`Eliminar "${set.name}"?`)) onDeleteSession(set.id); }} style={{ fontSize: '12px', padding: '4px 8px', color: '#ef4444' }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── File import ── */}
      <div className="import-section">
        <h2>Importar puntos</h2>

        <div className="upload-box">
          <input type="file" accept=".kml,.geojson,.json,.csv" onChange={handleFileUpload} disabled={isLoading} id="file-input" />
          <label htmlFor="file-input" className="upload-label">
            {isLoading ? 'Leyendo archivo...' : 'Elegir archivo KML / GeoJSON / CSV'}
          </label>
        </div>

        {error && <div className="error-message">{error}</div>}
        {lastAdded !== null && (
          <div style={{ fontSize: '12px', color: '#34d399', marginTop: '6px' }}>+{lastAdded} puntos agregados</div>
        )}

        {/* ── Groups / batch management ── */}
        {groups.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <strong style={{ fontSize: '14px' }}>{points.length} puntos · {groups.length} archivo{groups.length > 1 ? 's' : ''}</strong>
              <button className="btn-tertiary" onClick={handleClear} style={{ fontSize: '12px', color: '#ef4444' }}>Limpiar todo</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {groups.map((group, gIdx) => {
                const color = GROUP_COLORS[gIdx % GROUP_COLORS.length];
                const count = points.filter(p => p.groupId === group.id).length;
                return (
                  <div key={group.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: '#1a1a1a', borderRadius: '6px', border: `1px solid ${color}44` }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#eee', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name}</div>
                      <div style={{ fontSize: '11px', color: '#888' }}>{count} puntos</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      <span style={{ fontSize: '11px', color: '#888' }}>Lote</span>
                      <select
                        value={group.batchId}
                        onChange={e => handleBatchChange(group.id, Number(e.target.value))}
                        style={{ background: '#111', color: '#fff', border: '1px solid #333', borderRadius: '4px', padding: '2px 6px', fontSize: '12px', width: '52px' }}
                      >
                        {Array.from({ length: maxBatch + 1 }, (_, i) => i + 1).map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => handleRemoveGroup(group.id)}
                      style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', fontSize: '14px', padding: '0 2px', flexShrink: 0 }}
                      title="Eliminar este archivo"
                    >✕</button>
                  </div>
                );
              })}
            </div>

            {/* Batch summary */}
            {maxBatch > 1 && (
              <div style={{ marginTop: '10px', padding: '8px 10px', background: '#111', borderRadius: '6px', border: '1px solid #222' }}>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Agrupación de lotes:</div>
                {Array.from({ length: maxBatch }, (_, i) => i + 1).map(bId => {
                  const bGroups = groups.filter(g => g.batchId === bId);
                  if (bGroups.length === 0) return null;
                  const bPoints = points.filter(p => bGroups.some(g => g.id === p.groupId));
                  return (
                    <div key={bId} style={{ fontSize: '11px', color: '#ccc', display: 'flex', gap: '6px', marginTop: '3px' }}>
                      <span style={{ color: '#aaa', minWidth: '42px' }}>Lote {bId}:</span>
                      <span>{bGroups.map(g => g.name).join(' + ')} <span style={{ color: '#666' }}>({bPoints.length} pts)</span></span>
                    </div>
                  );
                })}
              </div>
            )}

            <button className="btn-primary" onClick={handleOptimizeAndGo} style={{ width: '100%', marginTop: '12px' }}>
              Optimizar y ver rutas →
            </button>
          </div>
        )}

        {debugMode && <div className="debug-info"><p>Total points: {points.length} · Groups: {groups.length}</p></div>}
      </div>

      {/* ── Banner puntos excluidos ── */}
      {excludedCount > 0 && (
        <div style={{
          marginTop: '16px',
          padding: '10px 14px',
          background: '#1a1a2a',
          border: '1px solid #6366f144',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
        }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#a5b4fc' }}>
              {excludedCount} punto{excludedCount !== 1 ? 's' : ''} excluido{excludedCount !== 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
              Fueron filtrados por el polígono
            </div>
          </div>
          <button
            className="btn-primary"
            onClick={onRestoreExcluded}
            style={{ fontSize: '12px', padding: '5px 12px', background: '#4f46e5', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            ↩ Restaurar
          </button>
        </div>
      )}

      {/* ── Filtro por polígono ── */}
      <div className="import-section" style={{ marginTop: '16px' }}>
        <h2>Filtrar por polígono</h2>
        <p style={{ fontSize: '12px', color: '#888', marginTop: '4px', marginBottom: '12px' }}>
          Cargá un KML/GeoJSON con un polígono o dibujalo en el mapa. Los puntos fuera del polígono serán eliminados.
        </p>

        {/* Upload polygon file */}
        <div className="upload-box">
          <input
            type="file"
            accept=".kml,.kmz,.geojson,.json"
            onChange={handlePolygonFileUpload}
            id="polygon-file-input"
          />
          <label htmlFor="polygon-file-input" className="upload-label">
            Cargar polígono (KML / GeoJSON)
          </label>
        </div>

        {polygonError && <div className="error-message">{polygonError}</div>}

        {/* Draw on map button */}
        <button
          className="btn-tertiary"
          onClick={onGoToMap}
          style={{ width: '100%', marginTop: '8px', fontSize: '12px', padding: '8px' }}
        >
          ✏️ Dibujar polígono en el mapa
        </button>

        {/* Polygon status */}
        {polygon && polygon.length >= 3 && (
          <div style={{ marginTop: '12px', padding: '10px', background: '#1a2a1a', border: '1px solid #16a34a44', borderRadius: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#4ade80' }}>
                  ✅ Polígono activo {polygonName ? `— ${polygonName}` : '(dibujado)'}
                </div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                  {polygon.length} vértices
                  {points.length > 0 && ` · ${pointsInsidePolygon} de ${points.length} puntos dentro`}
                </div>
              </div>
              <button
                className="btn-tertiary"
                onClick={() => { onPolygonChanged(null); setPolygonName(null); }}
                style={{ fontSize: '12px', padding: '4px 8px', color: '#ef4444', flexShrink: 0 }}
              >
                ✕ Quitar
              </button>
            </div>

            {points.length > 0 && (
              <button
                className="btn-primary"
                onClick={onFilterByPolygon}
                style={{ width: '100%', marginTop: '10px', background: '#16a34a' }}
              >
                Filtrar: conservar {pointsInsidePolygon} punto{pointsInsidePolygon !== 1 ? 's' : ''} dentro
              </button>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
