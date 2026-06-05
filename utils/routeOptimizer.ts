import * as turf from '@turf/turf';
import { createLogger } from './logger';

const log = createLogger('routeOptimizer');

export interface RoutePoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  description?: string;
  groupId?: string;
  groupName?: string;
}

export interface OptimizationResult {
  points: RoutePoint[];
  totalDistance: number;
  totalDistanceKm: number;
}

/**
 * Optimize route using greedy nearest neighbor algorithm
 * Minimizes total distance traveled (good for battery efficiency)
 * Returns optimized order of points
 */
export function optimizeRoute(points: RoutePoint[], startPointId?: string): OptimizationResult {
  if (points.length === 0) {
    return { points: [], totalDistance: 0, totalDistanceKm: 0 };
  }

  if (points.length === 1) {
    return {
      points,
      totalDistance: 0,
      totalDistanceKm: 0,
    };
  }

  const visited = new Set<string>();
  const optimizedRoute: RoutePoint[] = [];

  // Start from specified point or first point
  let currentPoint = startPointId
    ? points.find(p => p.id === startPointId) || points[0]
    : points[0];

  optimizedRoute.push(currentPoint);
  visited.add(currentPoint.id);

  // Greedy nearest neighbor: always go to closest unvisited point
  while (visited.size < points.length) {
    let nearestPoint: RoutePoint | null = null;
    let minDistance = Infinity;

    for (const point of points) {
      if (visited.has(point.id)) continue;

      const from = turf.point([currentPoint.longitude, currentPoint.latitude]);
      const to = turf.point([point.longitude, point.latitude]);
      const distance = turf.distance(from, to, { units: 'kilometers' });

      if (distance < minDistance) {
        minDistance = distance;
        nearestPoint = point;
      }
    }

    if (!nearestPoint) break;

    optimizedRoute.push(nearestPoint);
    visited.add(nearestPoint.id);
    currentPoint = nearestPoint;
  }

  const totalDistance = calculateTotalDistance(optimizedRoute);

  log.info(`Optimized route: ${optimizedRoute.length} points, ${totalDistance}m total distance`);

  return {
    points: optimizedRoute,
    totalDistance: totalDistance,
    totalDistanceKm: totalDistance / 1000,
  };
}

/**
 * Calculate total distance of a route in meters
 */
export function calculateTotalDistance(points: RoutePoint[]): number {
  let totalDistance = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const from = turf.point([points[i].longitude, points[i].latitude]);
    const to = turf.point([points[i + 1].longitude, points[i + 1].latitude]);
    const distance = turf.distance(from, to, { units: 'kilometers' });
    totalDistance += distance * 1000; // Convert to meters
  }

  return totalDistance;
}

/**
 * Calculate distance between two points in meters
 */
export function calculateDistance(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): number {
  const fromTurf = turf.point([from.longitude, from.latitude]);
  const toTurf = turf.point([to.longitude, to.latitude]);
  const distance = turf.distance(fromTurf, toTurf, { units: 'kilometers' });
  return distance * 1000; // Return in meters
}

/**
 * Get route statistics
 */
export function getRouteStats(points: RoutePoint[]) {
  if (points.length === 0) {
    return { pointCount: 0, totalDistance: 0, totalDistanceKm: 0, avgSegmentLength: 0 };
  }

  const totalDistance = calculateTotalDistance(points);
  const avgSegmentLength = points.length > 1 ? totalDistance / (points.length - 1) : 0;

  return {
    pointCount: points.length,
    totalDistance,
    totalDistanceKm: totalDistance / 1000,
    avgSegmentLength,
  };
}
