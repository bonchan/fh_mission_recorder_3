import React, { RefObject, useState } from 'react';
import Button from '@/components/ui/Button';
import { RoutesMap } from '@/components/flightplanning/RoutesMap';
import { FlightArea, HomePoint, MapView, PlanningAnnotation, AppSettings } from '@/utils/interfaces';
import {
  GeneratedRoute,
  autoClusterRoutes,
  breakStopInRoute,
  buildStops,
  clusterStopsInRoute,
  countMembers,
  estimateFlightMinutes,
  extractClusters,
  generateRoutes,
  isCentroidExcluded,
  isCluster,
  isRouteOverBudget,
  parseCentroidPrefixes,
} from '@/utils/routeOptimizer';

interface OptimizationTabProps {
  selectedAnnotations: PlanningAnnotation[];
  homePoint: HomePoint | null;
  isActive: boolean;
  routes: GeneratedRoute[];
  onRoutesChange: (routes: GeneratedRoute[]) => void;
  viewRef: RefObject<MapView | null>;
  settings: AppSettings;
  flightAreas: FlightArea[];
}

export function OptimizationTab({ selectedAnnotations, homePoint, isActive, routes, onRoutesChange, viewRef, settings, flightAreas }: OptimizationTabProps) {

  const [expandedRouteIds, setExpandedRouteIds] = useState<Set<string>>(new Set());
  const [expandedStopIds, setExpandedStopIds] = useState<Set<string>>(new Set());
  const [selectedStopIds, setSelectedStopIds] = useState<Set<string>>(new Set());

  const canGenerate = homePoint !== null && selectedAnnotations.length > 0;

  const config = {
    maxPoints: settings.maxPoints,
    maxDistanceMeters: settings.maxDistanceKm * 1000
  }

  const centroidExcludedPrefixes = parseCentroidPrefixes(settings.centroidExcludedPrefixes);

  const handleGenerate = () => {
    if (!homePoint) return;
    // Clusters live on the routes, so read them back before rebuilding to carry
    // them through a regenerate
    const stops = buildStops(selectedAnnotations, extractClusters(routes), centroidExcludedPrefixes);
    onRoutesChange(generateRoutes(stops, homePoint, config));
    setExpandedRouteIds(new Set());
    setSelectedStopIds(new Set());
  };

  const handleAutoCluster = () => {
    if (!homePoint) return;
    onRoutesChange(autoClusterRoutes(routes, settings.clusterRadiusMeters, homePoint, centroidExcludedPrefixes));
    setSelectedStopIds(new Set());
  };

  const handleCluster = (routeId: string, stopIds: string[]) => {
    if (!homePoint) return;
    onRoutesChange(clusterStopsInRoute(routes, routeId, stopIds, homePoint, centroidExcludedPrefixes));
    setSelectedStopIds(new Set());
  };

  const handleBreak = (routeId: string, stopId: string) => {
    if (!homePoint) return;
    onRoutesChange(breakStopInRoute(routes, routeId, stopId, homePoint));

    // Cluster ids are derived from their members, so re-clustering the same
    // points revives this id — drop it now or the new stop inherits this one's
    // checked/expanded state
    const forget = (prev: Set<string>) => {
      if (!prev.has(stopId)) return prev;
      const next = new Set(prev);
      next.delete(stopId);
      return next;
    };
    setExpandedStopIds(forget);
    setSelectedStopIds(forget);
  };

  const toggleRoute = (routeId: string) => {
    setExpandedRouteIds(prev => {
      const next = new Set(prev);
      if (next.has(routeId)) next.delete(routeId);
      else next.add(routeId);
      return next;
    });
  };

  const toggleStopExpanded = (stopId: string) => {
    setExpandedStopIds(prev => {
      const next = new Set(prev);
      if (next.has(stopId)) next.delete(stopId);
      else next.add(stopId);
      return next;
    });
  };

  const toggleStopSelected = (stopId: string) => {
    setSelectedStopIds(prev => {
      const next = new Set(prev);
      if (next.has(stopId)) next.delete(stopId);
      else next.add(stopId);
      return next;
    });
  };

  return (
    <div className="planning-split">
      <div className="planning-panel">
        <div className="optimization-controls">
          <h3 style={{ margin: '0 0 12px' }}>Flight Optimization</h3>
          

          <div className="config-summary">
            <div><span>Max points</span><span>{config.maxPoints}</span></div>
            <div><span>Max distance</span><span>{(config.maxDistanceMeters / 1000).toFixed(1)} km</span></div>
            <div><span>Cluster radius</span><span>{settings.clusterRadiusMeters} m</span></div>
          </div>

          <Button
            variant="primary"
            onClick={handleGenerate}
            disabled={!canGenerate}
            requireConfirm={routes.length > 0}
            confirmText="Discard manual edits?"
            confirmVariant="warning"
          >
            Generate routes
          </Button>

          <Button
            variant="outline"
            onClick={handleAutoCluster}
            disabled={!homePoint || routes.length === 0}
          >
            Auto-cluster within {settings.clusterRadiusMeters} m
          </Button>

          <p className="optimization-hint">
            {!homePoint
              ? 'Set the start/end point on the Annotations map first.'
              : selectedAnnotations.length === 0
                ? 'No annotations selected — enable folders or adjust the polygon filter.'
                : `${selectedAnnotations.length} annotation${selectedAnnotations.length === 1 ? '' : 's'} from the Annotations tab.`}
          </p>
        </div>

        <div className="route-list">
          {routes.map(route => {
            const isExpanded = expandedRouteIds.has(route.id);
            const selectedInRoute = route.points
              .filter(stop => selectedStopIds.has(stop.id))
              .map(stop => stop.id);

            return (
              <div key={route.id} className="route-item">
                <button className="route-header" onClick={() => toggleRoute(route.id)}>
                  <span className="route-swatch" style={{ background: route.color }} />
                  <span className="route-name">{route.name}</span>
                  <span className="route-meta">
                    {route.points.length} pts · {(route.totalDistanceMeters / 1000).toFixed(2)} km
                    · ~{Math.round(estimateFlightMinutes(route.totalDistanceMeters, countMembers(route.points)))} min
                    {isRouteOverBudget(route, config) && ' ⚠'}
                    {route.blockedStopIds && route.blockedStopIds.length > 0 && (
                      <span title="Sits inside a no-fly zone — no path can reach it"> ⛔</span>
                    )}
                  </span>
                  <span className="route-chevron">{isExpanded ? '▾' : '▸'}</span>
                </button>

                {isExpanded && (
                  <>
                    {selectedInRoute.length >= 2 && (
                      <button
                        className="cluster-action"
                        onClick={() => handleCluster(route.id, selectedInRoute)}
                      >
                        Cluster {selectedInRoute.length} selected into one stop
                      </button>
                    )}

                    <ol className="route-points editable">
                      {route.points.map((stop, index) => {
                        const clustered = isCluster(stop);
                        const membersShown = expandedStopIds.has(stop.id);

                        return (
                          <li key={stop.id} className="stop-row">
                            <span className="stop-line">
                              <input
                                type="checkbox"
                                checked={selectedStopIds.has(stop.id)}
                                onChange={() => toggleStopSelected(stop.id)}
                              />
                              <span className="point-index" style={{ color: route.color }}>{index + 1}</span>
                              <span className="point-name">
                                {route.blockedStopIds?.includes(stop.id) && (
                                  <span title="Inside a no-fly zone — unreachable">⛔ </span>
                                )}
                                {clustered ? `⬡ ${stop.name}` : stop.name}
                              </span>

                              {clustered && (
                                <span className="point-controls">
                                  <button
                                    className="icon-button"
                                    title="Show members"
                                    onClick={() => toggleStopExpanded(stop.id)}
                                  >
                                    {membersShown ? '▾' : '▸'}
                                  </button>
                                  <button
                                    className="icon-button"
                                    title="Break this cluster apart"
                                    onClick={() => handleBreak(route.id, stop.id)}
                                  >
                                    ✕
                                  </button>
                                </span>
                              )}
                            </span>

                            {clustered && membersShown && (
                              <ul className="cluster-members">
                                {stop.members.map(member => {
                                  const excluded = isCentroidExcluded(member, centroidExcludedPrefixes);
                                  return (
                                    <li
                                      key={member.id}
                                      className={excluded ? 'centroid-excluded' : undefined}
                                      title={excluded ? 'Flown, but left out of the centroid' : undefined}
                                    >
                                      {member.name}{excluded && ' (off-centroid)'}
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="planning-map">
        <RoutesMap routes={routes} homePoint={homePoint} isActive={isActive} viewRef={viewRef} flightAreas={flightAreas} />
      </div>
    </div>
  );
}
