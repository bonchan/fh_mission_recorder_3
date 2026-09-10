import React, { RefObject, useState } from 'react';
import { RoutesMap } from '@/components/flightplanning/RoutesMap';
import { HomePoint, MapView } from '@/utils/interfaces';
import {
  GeneratedRoute,
  breakStopInRoute,
  countMembers,
  estimateFlightMinutes,
  isCluster,
  isRouteOverBudget,
  movePointToRoute,
  movePointWithinRoute,
  optimizeRoute,
  reverseRoute,
} from '@/utils/routeOptimizer';

interface ManualTabProps {
  routes: GeneratedRoute[];
  onRoutesChange: (routes: GeneratedRoute[]) => void;
  homePoint: HomePoint | null;
  isActive: boolean;
  viewRef: RefObject<MapView | null>;
  settings: AppSettings;
}

export function ManualTab({ routes, onRoutesChange, homePoint, isActive, viewRef, settings }: ManualTabProps) {
  // Single-open accordion: opening a route closes the previous one, so the map
  // only ever emphasises one route at a time
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);
  const config = {
    maxPoints: settings.maxPoints,
    maxDistanceMeters: settings.maxDistanceKm * 1000
  }

  const toggleRoute = (routeId: string) => {
    setExpandedRouteId(prev => (prev === routeId ? null : routeId));
  };

  if (routes.length === 0) {
    return (
      <div className="planning-split">
        <div className="planning-panel">
          <div className="optimization-controls">
            <h3 style={{ margin: '0 0 12px' }}>Manual Tinkering</h3>
            <p className="optimization-hint">
              No routes yet — generate them on the Flight Optimization tab first.
            </p>
          </div>
        </div>
        <div className="planning-map">
          <RoutesMap routes={routes} homePoint={homePoint} isActive={isActive} viewRef={viewRef} />
        </div>
      </div>
    );
  }

  return (
    <div className="planning-split">
      <div className="planning-panel">
        <div className="optimization-controls">
          <h3 style={{ margin: '0 0 12px' }}>Manual Tinkering</h3>
          <p className="optimization-hint">
            {homePoint
              ? 'Reorder points, send them to another route, or flip a route’s direction. Budgets are not enforced here.'
              : 'Set the start/end point on the Annotations map to edit routes.'}
          </p>
        </div>

        <div className="route-list">
          {routes.map(route => {
            const isExpanded = expandedRouteId === route.id;
            const overBudget = isRouteOverBudget(route, config);

            return (
              <div key={route.id} className="route-item">
                <div className="route-header-row">
                  <button className="route-header" onClick={() => toggleRoute(route.id)}>
                    <span className="route-swatch" style={{ background: route.color }} />
                    <span className="route-name">{route.name}</span>
                    <span className="route-meta">
                      {route.points.length} pts · {(route.totalDistanceMeters / 1000).toFixed(2)} km
                      · ~{Math.round(estimateFlightMinutes(route.totalDistanceMeters, countMembers(route.points)))} min
                      {overBudget && ' ⚠'}
                    </span>

                    <span className="route-chevron">{isExpanded ? '▾' : '▸'}</span>
                  </button>
                  <button
                    className="icon-button"
                    title="Re-optimize this route only"
                    disabled={!homePoint || route.points.length < 3}
                    onClick={() => homePoint && onRoutesChange(optimizeRoute(routes, route.id, homePoint))}
                  >
                    ⟳
                  </button>
                  <button
                    className="icon-button"
                    title="Reverse direction"
                    disabled={!homePoint || route.points.length < 2}
                    onClick={() => homePoint && onRoutesChange(reverseRoute(routes, route.id, homePoint))}
                  >
                    ⇄
                  </button>
                </div>

                {isExpanded && (
                  <ol className="route-points editable">
                    {route.points.length === 0 && (
                      <li className="empty-route">Empty — move points here from another route.</li>
                    )}

                    {route.points.map((point, index) => (
                      <li key={point.id}>
                        <span className="point-index" style={{ color: route.color }}>{index + 1}</span>
                        <span className="point-name" title={isCluster(point) ? point.members.map(m => m.name).join(', ') : undefined}>
                          {isCluster(point) ? `⬡ ${point.name}` : point.name}
                        </span>

                        <span className="point-controls">
                          {isCluster(point) && (
                            <button
                              className="icon-button"
                              title="Break this cluster apart"
                              disabled={!homePoint}
                              onClick={() => homePoint && onRoutesChange(
                                breakStopInRoute(routes, route.id, point.id, homePoint)
                              )}
                            >
                              ✕
                            </button>
                          )}
                          <button
                            className="icon-button"
                            title="Move earlier"
                            disabled={!homePoint || index === 0}
                            onClick={() => homePoint && onRoutesChange(
                              movePointWithinRoute(routes, route.id, point.id, -1, homePoint)
                            )}
                          >
                            ↑
                          </button>
                          <button
                            className="icon-button"
                            title="Move later"
                            disabled={!homePoint || index === route.points.length - 1}
                            onClick={() => homePoint && onRoutesChange(
                              movePointWithinRoute(routes, route.id, point.id, 1, homePoint)
                            )}
                          >
                            ↓
                          </button>
                          <select
                            className="route-select"
                            value=""
                            disabled={!homePoint || routes.length < 2}
                            onChange={(e) => {
                              if (!homePoint || !e.target.value) return;
                              onRoutesChange(movePointToRoute(routes, point.id, e.target.value, homePoint));
                            }}
                          >
                            <option value="">Move to…</option>
                            {routes
                              .filter(target => target.id !== route.id)
                              .map(target => (
                                <option key={target.id} value={target.id}>{target.name}</option>
                              ))}
                          </select>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="planning-map">
        <RoutesMap
          routes={routes}
          homePoint={homePoint}
          isActive={isActive}
          viewRef={viewRef}
          emphasisRouteId={expandedRouteId}
        />
      </div>
    </div>
  );
}
