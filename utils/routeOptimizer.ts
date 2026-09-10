import { get3DDistanceInMeters } from '@/utils/geo';
import { HomePoint, PlanningAnnotation, RouteStop } from '@/utils/interfaces';

export interface RouteConfig {
  maxPoints: number;
  maxDistanceMeters: number;
}

export interface GeneratedRoute {
  id: string;
  name: string;
  color: string;
  points: RouteStop[];
  totalDistanceMeters: number;
  // True when the point alone already exceeds maxDistanceMeters — kept as its
  // own route rather than dropped, so nothing silently disappears.
  exceedsMaxDistance: boolean;
}

// Matches the wayline speed written into the WPML (globalTransitionalSpeed /
// autoFlightSpeed), so the estimate lines up with how the mission actually flies
export const CRUISE_SPEED_MS = 10;

// Covers decelerating into a point, taking the picture and accelerating out
export const POINT_OVERHEAD_SECONDS = 5;

// Rough: distance at cruise speed, plus a flat cost per point
export function estimateFlightMinutes(distanceMeters: number, pointCount: number): number {
  const seconds = distanceMeters / CRUISE_SPEED_MS + pointCount * POINT_OVERHEAD_SECONDS;
  return seconds / 60;
}

// Golden-angle hue rotation keeps neighbouring route colors far apart
export function getRouteColor(index: number): string {
  const hue = Math.round((index * 137.508) % 360);
  return `hsl(${hue}, 85%, 55%)`;
}

type Coords = { latitude: number; longitude: number };

const distanceMeters = (a: Coords, b: Coords): number =>
  get3DDistanceInMeters(a.latitude, a.longitude, 0, b.latitude, b.longitude, 0);

// Full round trip: home -> every point in order -> home
export function calculateRouteDistance(points: RouteStop[], home: HomePoint): number {
  if (points.length === 0) return 0;

  let total = 0;
  let prev: Coords = home;
  for (const point of points) {
    total += distanceMeters(prev, point);
    prev = point;
  }
  return total + distanceMeters(prev, home);
}

// Nearest-neighbour builds outward from home, so a route naturally ends on its
// farthest point. Flip it when the last point is farther out than the first, so
// the low-battery end of the flight is the leg closest to home. Free to do —
// a round trip costs the same in either direction.
export function orientForReturn(points: RouteStop[], home: HomePoint): RouteStop[] {
  if (points.length < 2) return points;

  const toFirst = distanceMeters(home, points[0]);
  const toLast = distanceMeters(home, points[points.length - 1]);

  return toLast > toFirst ? [...points].reverse() : points;
}

// Greedy nearest-neighbour: each route leaves home, keeps grabbing the closest
// unassigned point that still fits both budgets, then closes back to home.
export function generateRoutes(
  stops: RouteStop[],
  home: HomePoint,
  config: RouteConfig
): GeneratedRoute[] {
  const unassigned = [...stops];
  const routes: GeneratedRoute[] = [];
  const routeLength = (ordered: RouteStop[]) => calculateRouteDistance(ordered, home);

  while (unassigned.length > 0) {
    const current: RouteStop[] = [];
    let cursor: Coords = home;
    let exceedsMaxDistance = false;

    while (unassigned.length > 0 && current.length < config.maxPoints) {
      let nearestIndex = 0;
      let shortestDistance = Infinity;

      for (let i = 0; i < unassigned.length; i++) {
        const distance = distanceMeters(cursor, unassigned[i]);
        if (distance < shortestDistance) {
          shortestDistance = distance;
          nearestIndex = i;
        }
      }

      const candidate = unassigned[nearestIndex];

      if (routeLength([...current, candidate]) > config.maxDistanceMeters) {
        if (current.length === 0) {
          // Unreachable within budget even on its own — isolate it so the loop
          // still makes progress instead of spinning forever
          current.push(candidate);
          unassigned.splice(nearestIndex, 1);
          exceedsMaxDistance = true;
        }
        break;
      }

      current.push(candidate);
      unassigned.splice(nearestIndex, 1);
      cursor = candidate;
    }

    const index = routes.length + 1;
    const oriented = orientForReturn(current, home);
    routes.push({
      id: `route-${index}`,
      name: `Route ${String(index).padStart(3, '0')}`,
      color: getRouteColor(index - 1),
      points: oriented,
      totalDistanceMeters: routeLength(oriented),
      exceedsMaxDistance,
    });
  }

  return routes;
}

// ==========================================
// CLUSTERING
// A cluster is just a stop with several members, flown as one waypoint at their
// centroid. The routes themselves hold the clusters, so there is no parallel
// cluster state to keep in sync — and Generate can read them back off the
// current routes to survive a regenerate.
// ==========================================

export const isCluster = (stop: RouteStop): boolean => stop.members.length > 1;

export function toStop(annotation: PlanningAnnotation): RouteStop {
  return {
    id: annotation.id,
    latitude: annotation.latitude,
    longitude: annotation.longitude,
    name: annotation.name,
    members: [annotation],
  };
}

export function parseCentroidPrefixes(value: string): string[] {
  return value
    .split(',')
    .map(prefix => prefix.trim())
    .filter(prefix => prefix.length > 0);
}

// Matching points are still flown and still counted — they just don't drag the
// cluster's centroid towards themselves
export function isCentroidExcluded(annotation: PlanningAnnotation, prefixes: string[]): boolean {
  const name = annotation.name.toLowerCase();
  return prefixes.some(prefix => name.startsWith(prefix.toLowerCase()));
}

export function makeCluster(members: PlanningAnnotation[], centroidExcludedPrefixes: string[] = []): RouteStop {
  if (members.length === 1) return toStop(members[0]);

  const eligible = members.filter(member => !isCentroidExcluded(member, centroidExcludedPrefixes));
  // With every member excluded there's nothing left to anchor to, so fall back
  // to the whole group rather than producing no position at all
  const basis = eligible.length > 0 ? eligible : members;

  const latitude = basis.reduce((sum, m) => sum + m.latitude, 0) / basis.length;
  const longitude = basis.reduce((sum, m) => sum + m.longitude, 0) / basis.length;

  // An annotation belongs to at most one cluster, so its lowest member id is a
  // stable unique key across regenerates
  const memberIds = members.map(m => m.id).sort();

  return {
    id: `cluster-${memberIds[0]}`,
    latitude,
    longitude,
    name: `${members.length} points`,
    members,
  };
}

export function countMembers(stops: RouteStop[]): number {
  return stops.reduce((total, stop) => total + stop.members.length, 0);
}

export function extractClusters(routes: GeneratedRoute[]): RouteStop[] {
  return routes.flatMap(route => route.points.filter(isCluster));
}

// Flat stop list for generation: known clusters are kept (dropping any member no
// longer selected), everything else becomes a stop of its own.
export function buildStops(
  annotations: PlanningAnnotation[],
  clusters: RouteStop[],
  centroidExcludedPrefixes: string[] = []
): RouteStop[] {
  const byId = new Map(annotations.map(a => [a.id, a]));
  const claimed = new Set<string>();
  const stops: RouteStop[] = [];

  for (const cluster of clusters) {
    const members = cluster.members
      .map(member => byId.get(member.id))
      .filter((member): member is PlanningAnnotation => member !== undefined);

    if (members.length === 0) continue;

    members.forEach(member => claimed.add(member.id));
    stops.push(makeCluster(members, centroidExcludedPrefixes));
  }

  for (const annotation of annotations) {
    if (!claimed.has(annotation.id)) stops.push(toStop(annotation));
  }

  return stops;
}

// Merges the chosen stops into one, at the position of the earliest of them
export function clusterStopsInRoute(
  routes: GeneratedRoute[],
  routeId: string,
  stopIds: string[],
  home: HomePoint,
  centroidExcludedPrefixes: string[] = []
): GeneratedRoute[] {
  const ids = new Set(stopIds);

  return routes.map(route => {
    if (route.id !== routeId) return route;

    const selected = route.points.filter(stop => ids.has(stop.id));
    if (selected.length < 2) return route;

    // Every selected stop sits at or after this index, so removing them doesn't
    // shift anything before it
    const insertAt = route.points.findIndex(stop => ids.has(stop.id));
    const merged = makeCluster(selected.flatMap(stop => stop.members), centroidExcludedPrefixes);

    const points = route.points.filter(stop => !ids.has(stop.id));
    points.splice(insertAt, 0, merged);

    return withRecalculatedDistance({ ...route, points }, home);
  });
}

export function breakStopInRoute(
  routes: GeneratedRoute[],
  routeId: string,
  stopId: string,
  home: HomePoint
): GeneratedRoute[] {
  return routes.map(route => {
    if (route.id !== routeId) return route;

    const index = route.points.findIndex(stop => stop.id === stopId);
    if (index === -1 || !isCluster(route.points[index])) return route;

    const points = [...route.points];
    points.splice(index, 1, ...route.points[index].members.map(toStop));

    return withRecalculatedDistance({ ...route, points }, home);
  });
}

// Merges stops within `radiusMeters` of each other, route by route. Points that
// close together almost always land in the same route anyway.
export function autoClusterRoutes(
  routes: GeneratedRoute[],
  radiusMeters: number,
  home: HomePoint,
  centroidExcludedPrefixes: string[] = []
): GeneratedRoute[] {
  return routes.map(route => {
    const remaining = [...route.points];
    const points: RouteStop[] = [];

    while (remaining.length > 0) {
      const seed = remaining.shift()!;
      const group = [seed];

      for (let i = remaining.length - 1; i >= 0; i--) {
        if (distanceMeters(seed, remaining[i]) <= radiusMeters) {
          group.push(remaining[i]);
          remaining.splice(i, 1);
        }
      }

      points.push(
        group.length > 1
          ? makeCluster(group.flatMap(stop => stop.members), centroidExcludedPrefixes)
          : seed
      );
    }

    if (points.length === route.points.length) return route;
    return withRecalculatedDistance({ ...route, points }, home);
  });
}

// ==========================================
// MANUAL EDITS
// Hand edits are deliberately unconstrained — they ignore the config budgets,
// so the UI is responsible for flagging routes that end up over them.
// ==========================================

const withRecalculatedDistance = (route: GeneratedRoute, home: HomePoint): GeneratedRoute => ({
  ...route,
  totalDistanceMeters: calculateRouteDistance(route.points, home),
  exceedsMaxDistance: false,
});

export function movePointToRoute(
  routes: GeneratedRoute[],
  pointId: string,
  targetRouteId: string,
  home: HomePoint
): GeneratedRoute[] {
  const point = routes
    .flatMap(route => route.points)
    .find(candidate => candidate.id === pointId);

  if (!point) return routes;

  return routes.map(route => {
    if (route.id === targetRouteId) {
      if (route.points.some(p => p.id === pointId)) return route;
      return withRecalculatedDistance({ ...route, points: [...route.points, point] }, home);
    }

    if (route.points.some(p => p.id === pointId)) {
      return withRecalculatedDistance(
        { ...route, points: route.points.filter(p => p.id !== pointId) },
        home
      );
    }

    return route;
  });
}

export function movePointWithinRoute(
  routes: GeneratedRoute[],
  routeId: string,
  pointId: string,
  offset: number,
  home: HomePoint
): GeneratedRoute[] {
  return routes.map(route => {
    if (route.id !== routeId) return route;

    const index = route.points.findIndex(p => p.id === pointId);
    const target = index + offset;
    if (index === -1 || target < 0 || target >= route.points.length) return route;

    const points = [...route.points];
    [points[index], points[target]] = [points[target], points[index]];

    return withRecalculatedDistance({ ...route, points }, home);
  });
}

// Reorders one route's points for a shorter round trip, leaving its membership
// and every other route alone. Same nearest-neighbour heuristic as
// generateRoutes, minus the budget checks — and it keeps the existing order
// when the heuristic can't beat it, so "optimize" never makes a route longer.
export function optimizeRoute(
  routes: GeneratedRoute[],
  routeId: string,
  home: HomePoint
): GeneratedRoute[] {
  return routes.map(route => {
    if (route.id !== routeId || route.points.length < 3) return route;

    const remaining = [...route.points];
    const ordered: RouteStop[] = [];
    let cursor: Coords = home;

    while (remaining.length > 0) {
      let nearestIndex = 0;
      let shortestDistance = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const distance = distanceMeters(cursor, remaining[i]);
        if (distance < shortestDistance) {
          shortestDistance = distance;
          nearestIndex = i;
        }
      }

      cursor = remaining[nearestIndex];
      ordered.push(remaining[nearestIndex]);
      remaining.splice(nearestIndex, 1);
    }

    // Keep the hand-made order when the heuristic can't beat it, but orient
    // whichever order wins so the flight still ends near home
    const best = calculateRouteDistance(ordered, home) < route.totalDistanceMeters
      ? ordered
      : route.points;
    const oriented = orientForReturn(best, home);

    const unchanged = oriented.every((point, i) => point.id === route.points[i].id);
    if (unchanged) return route;

    return withRecalculatedDistance({ ...route, points: oriented }, home);
  });
}

export function reverseRoute(
  routes: GeneratedRoute[],
  routeId: string,
  home: HomePoint
): GeneratedRoute[] {
  return routes.map(route =>
    route.id === routeId
      ? withRecalculatedDistance({ ...route, points: [...route.points].reverse() }, home)
      : route
  );
}

export function isRouteOverBudget(route: GeneratedRoute, config: RouteConfig): boolean {
  return route.points.length > config.maxPoints || route.totalDistanceMeters > config.maxDistanceMeters;
}
