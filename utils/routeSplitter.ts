import { RoutePoint, calculateDistance, calculateTotalDistance } from './routeOptimizer';
import { createLogger } from './logger';

const log = createLogger('routeSplitter');

export interface Route {
  id: string;
  points: RoutePoint[];
  totalDistance: number;
  pointCount: number;
  exceedsLimits: boolean;
}

/**
 * Generates routes using a greedy nearest neighbor algorithm
 * Similar to QGIS script - finds closest unvisited point at each step
 * Respects distance and point limits
 * Post-processes single-point routes to merge them into the best matching existing route.
 */
export function generateRoutes(
  points: RoutePoint[],
  maxDistanceKm: number,
  maxPoints: number,
  startPointId?: string
): Route[] {
  if (points.length === 0) {
    return [];
  }

  // Determine start point (first point or specified)
  let startPoint = points[0];
  if (startPointId) {
    const found = points.find(p => p.id === startPointId);
    if (found) {
      startPoint = found;
    }
  }

  let routes: Route[] = [];
  const used = new Set<string>();
  let routeIndex = 0;

  while (true) {
    let currentStartPoint = startPoint;
    if (used.has(startPoint.id)) {
      const nextAvailable = points.find(p => !used.has(p.id));
      if (!nextAvailable) break; // No quedan más puntos por procesar
      currentStartPoint = nextAvailable;
    }

    const route: RoutePoint[] = [currentStartPoint];
    let totalDistance = 0;
    let currentPoint = currentStartPoint;
    used.add(currentStartPoint.id);

    const available = points.filter(p => !used.has(p.id));

    while (route.length < maxPoints && available.length > 0) {
      let bestCandidate: { point: RoutePoint; distance: number } | null = null;
      let minDistance = Infinity;

      for (const candidate of available) {
        if (used.has(candidate.id)) continue;

        const distToCurrent = calculateDistance(currentPoint, candidate) / 1000; // km
        const totalTemp = totalDistance + distToCurrent;

        if (totalTemp <= maxDistanceKm) {
          if (distToCurrent < minDistance) {
            minDistance = distToCurrent;
            bestCandidate = {
              point: candidate,
              distance: distToCurrent,
            };
          }
        }
      }

      if (!bestCandidate) {
        break;
      }

      route.push(bestCandidate.point);
      totalDistance += bestCandidate.distance;
      currentPoint = bestCandidate.point;
      used.add(bestCandidate.point.id);
    }

    if (route.length > 0) {
      routes.push(createRoute(route, routeIndex++, maxDistanceKm));
    }

    if (used.size === points.length) {
      break;
    }

    if (route.length === 0) {
      break;
    }
  }

 
  const validRoutes: Route[] = [];
  const singlePoints: RoutePoint[] = [];

  // Separamos las rutas normales de las que se quedaron con 1 solo punto
  for (const r of routes) {
    if (r.pointCount === 1) {
      singlePoints.push(r.points[0]);
    } else {
      validRoutes.push(r);
    }
  }

  // Intentamos reubicar cada punto huérfano en la ruta que menor impacto de distancia cause
  for (const orphanPoint of singlePoints) {
    let bestRouteIndex = -1;
    let minAdditionalDistance = Infinity;
    let insertAtEnd = true; // Flag para saber si se añade al principio o al final de la ruta candidata

    for (let i = 0; i < validRoutes.length; i++) {
      const candidateRoute = validRoutes[i];

      // Verificamos si la ruta ya llegó al límite estricto de puntos
      if (candidateRoute.pointCount >= maxPoints) continue;

      const firstPoint = candidateRoute.points[0];
      const lastPoint = candidateRoute.points[candidateRoute.points.length - 1];

      // Calculamos la distancia si lo ponemos al inicio o al final de esta ruta existente
      const distToFirst = calculateDistance(orphanPoint, firstPoint) / 1000;
      const distFromLast = calculateDistance(lastPoint, orphanPoint) / 1000;

      // Evaluamos agregarlo al final
      if (candidateRoute.totalDistance + distFromLast <= maxDistanceKm) {
        if (distFromLast < minAdditionalDistance) {
          minAdditionalDistance = distFromLast;
          bestRouteIndex = i;
          insertAtEnd = true;
        }
      }

      // Evaluamos agregarlo al principio
      if (candidateRoute.totalDistance + distToFirst <= maxDistanceKm) {
        if (distToFirst < minAdditionalDistance) {
          minAdditionalDistance = distToFirst;
          bestRouteIndex = i;
          insertAtEnd = false;
        }
      }
    }

    // Si encontramos una ruta ideal que acepte el punto sin romper límites
    if (bestRouteIndex !== -1) {
      const targetRoute = validRoutes[bestRouteIndex];
      if (insertAtEnd) {
        targetRoute.points.push(orphanPoint);
      } else {
        targetRoute.points.unshift(orphanPoint);
      }
      // Recalculamos las propiedades de la ruta modificada
      validRoutes[bestRouteIndex] = createRoute(targetRoute.points, bestRouteIndex, maxDistanceKm);
      log.debug(`Punto huérfano ${orphanPoint.id} integrado con éxito en ${targetRoute.id}`);
    } else {
      // Si de verdad no entra en ninguna por límite estricto de Km, no queda otra que dejarlo como ruta individual
      log.warn(`No se pudo optimizar el punto ${orphanPoint.id} en rutas existentes sin violar límites.`);
      validRoutes.push(createRoute([orphanPoint], validRoutes.length, maxDistanceKm));
    }
  }

  // Reasignamos IDs secuenciales finales corregidos (route-1, route-2...)
  validRoutes.forEach((route, i) => {
    route.id = `route-${i + 1}`;
  });

  routes = validRoutes;

  log.debug('Generated', routes.length, 'routes after orphan optimization');
  routes.forEach((r, i) => {
    log.debug(`Route ${i + 1}: ${r.pointCount} points, ${r.totalDistance.toFixed(2)} km`);
  });

  return routes;
}

/**
 * Splits a route into multiple sub-routes based on distance and point limits
 * Uses a simple greedy algorithm to group consecutive points
 */
export function splitRouteByLimits(
  points: RoutePoint[],
  maxDistanceKm: number,
  maxPoints: number
): Route[] {
  if (points.length === 0) {
    return [];
  }

  const routes: Route[] = [];
  let currentRoute: RoutePoint[] = [];
  let currentDistance = 0;
  let routeIndex = 0;

  for (let i = 0; i < points.length; i++) {
    const point = points[i];

    const nextDistance =
      currentRoute.length > 0
        ? currentDistance +
          calculateDistance(currentRoute[currentRoute.length - 1], point)
        : 0;

    const wouldExceedDistance = nextDistance > maxDistanceKm * 1000; 
    const wouldExceedPoints = currentRoute.length >= maxPoints;

    if ((wouldExceedDistance || wouldExceedPoints) && currentRoute.length > 0) {
      routes.push(createRoute(currentRoute, routeIndex++, maxDistanceKm));
      currentRoute = [point];
      currentDistance = 0;
    } else {
      if (currentRoute.length > 0) {
        currentDistance = nextDistance;
      }
      currentRoute.push(point);
    }
  }

  if (currentRoute.length > 0) {
    routes.push(createRoute(currentRoute, routeIndex++, maxDistanceKm));
  }

  log.debug('Split route into', routes.length, 'sub-routes');
  routes.forEach((r, i) => {
    log.debug(`Route ${i + 1}: ${r.pointCount} points, ${r.totalDistance.toFixed(2)} km`);
  });

  return routes;
}

/**
 * Inserts ducto points into existing photo routes.
 * Each ducto point is inserted into the route whose segment it falls nearest to,
 * at the position that minimises added distance (best-fit edge insertion).
 */
/**
 * Creates a route object from points
 */
function createRoute(
  points: RoutePoint[],
  index: number,
  maxDistanceKm: number
): Route {
  const totalDistanceM = calculateTotalDistance(points);
  const totalDistanceKm = totalDistanceM / 1000;

  return {
    id: `route-${index + 1}`,
    points,
    totalDistance: totalDistanceKm,
    pointCount: points.length,
    exceedsLimits: totalDistanceKm > maxDistanceKm,
  };
}

/**
 * Merges nearby routes to optimize when they're close to limit
 * Useful for battery optimization - fewer route switches
 */
export function mergeNearbyRoutes(
  routes: Route[],
  maxDistanceKm: number
): Route[] {
  if (routes.length <= 1) {
    return routes;
  }

  const merged: Route[] = [];
  let current = { ...routes[0] };

  for (let i = 1; i < routes.length; i++) {
    const next = routes[i];
    const mergedDistance = current.totalDistance + next.totalDistance;

    if (
      mergedDistance <= maxDistanceKm * 1.2 &&
      current.pointCount + next.pointCount <= 20
    ) {
      current = {
        id: current.id,
        points: [...current.points, ...next.points],
        totalDistance: mergedDistance,
        pointCount: current.pointCount + next.pointCount,
        exceedsLimits: mergedDistance > maxDistanceKm,
      };
      log.debug(`Merged routes for optimization`);
    } else {
      merged.push(current);
      current = { ...next };
    }
  }

  if (current.points.length > 0) {
    merged.push(current);
  }

  merged.forEach((route, i) => {
    route.id = `route-${i + 1}`;
  });

  log.debug('After optimization merge:', merged.length, 'routes');
  return merged;
}

/**
 * Validates a single route against limits
 */
export function validateRoute(
  route: Route,
  maxDistanceKm: number,
  maxPoints: number
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  if (route.totalDistance > maxDistanceKm) {
    violations.push(
      `Distance ${route.totalDistance.toFixed(2)}km exceeds limit ${maxDistanceKm}km`
    );
  }

  if (route.pointCount > maxPoints) {
    violations.push(`${route.pointCount} points exceed limit ${maxPoints}`);
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Validates all routes
 */
export function validateRoutes(
  routes: Route[],
  maxDistanceKm: number,
  maxPoints: number
): { allValid: boolean; routeValidations: Array<{ id: string; violations: string[] }> } {
  const routeValidations = routes.map((route) => ({
    id: route.id,
    violations: validateRoute(route, maxDistanceKm, maxPoints).violations,
  }));

  const allValid = routeValidations.every((rv) => rv.violations.length === 0);

  return { allValid, routeValidations };
}