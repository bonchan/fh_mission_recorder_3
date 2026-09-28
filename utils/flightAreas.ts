import * as turf from '@turf/turf';
import { get3DDistanceInMeters } from '@/utils/geo';
import { FlightArea, HomePoint, RouteStop } from '@/utils/interfaces';
import { createLogger } from '@/utils/logger';

const log = createLogger('flightAreas');

// No part of a flown path may come closer than this to a no-fly zone
export const NFZ_CLEARANCE_METERS = 11;

// Buffering produces a polygon, so the straight segments between its vertices
// cut slightly inside the true offset at convex corners. The extra metre keeps
// the flown path clear of the real 11 m limit despite that approximation.
const BUFFER_METERS = NFZ_CLEARANCE_METERS + 1;

// Crossings are tested against a slightly tighter polygon than the one detours
// ride around. Without the gap, a detour hugging the outer ring reads as a fresh
// crossing on the next pass and the sweep never settles.
const TEST_BUFFER_METERS = NFZ_CLEARANCE_METERS + 0.5;

// Rounded corners at 4 steps per quarter sag ~0.23 m inside the offset, which
// still leaves better than 11.7 m — and far fewer vertices to walk around
const BUFFER_STEPS = 4;

// A detour can push a leg into a zone it previously missed, so the sweep runs
// again until nothing crosses — capped, since pathological overlaps won't settle
const MAX_PASSES = 6;

// [longitude, latitude], GeoJSON order
export type Position = [number, number];

export interface Obstacle {
  id: string;
  name: string;
  // Ring the detour rides around, at BUFFER_METERS
  polygon: any;
  ring: Position[];
  // Slightly tighter, used only to decide whether a leg actually crosses
  testPolygon: any;
  bbox: number[];
}

// ==========================================
// SHAPE PARSING
// The API sends either a polygon ring set or a centre plus radius.
// ==========================================

export function flightAreaCentre(coordinates: any): Position | null {
  if (!Array.isArray(coordinates)) return null;

  const [first] = coordinates;
  if (typeof first === 'number') return [coordinates[0], coordinates[1]];
  if (Array.isArray(first) && typeof first[0] === 'number') return [first[0], first[1]];

  return null;
}

export function flightAreaRings(coordinates: any): Position[][] | null {
  if (!Array.isArray(coordinates)) return null;

  const [firstRing] = coordinates;
  if (!Array.isArray(firstRing)) return null;

  if (typeof firstRing[0] === 'number') return [coordinates as Position[]];
  if (Array.isArray(firstRing[0])) return coordinates as Position[][];

  return null;
}

export const isEnabledNfz = (area: FlightArea): boolean =>
  area.type === 'nfz' && area.status === 'enable';

function toTurfShape(area: FlightArea): any | null {
  const { geometry } = area.content;

  if (geometry.radius != null) {
    const centre = flightAreaCentre(geometry.coordinates);
    return centre ? turf.circle(centre, geometry.radius, { units: 'meters', steps: 64 }) : null;
  }

  const rings = flightAreaRings(geometry.coordinates);
  if (!rings) return null;

  // A ring the API left open would be rejected by turf
  const closed = rings.map(ring => {
    const [first] = ring;
    const last = ring[ring.length - 1];
    return first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
  });

  return turf.polygon(closed);
}

export function buildNfzObstacles(areas: FlightArea[]): Obstacle[] {
  const obstacles: Obstacle[] = [];

  for (const area of areas.filter(isEnabledNfz)) {
    const shape = toTurfShape(area);
    if (!shape) {
      log.warn(`Skipping NFZ ${area.id}: unreadable geometry`, area.content.geometry);
      continue;
    }

    let buffered: any;
    let testBuffered: any;
    try {
      buffered = turf.buffer(shape, BUFFER_METERS, { units: 'meters', steps: BUFFER_STEPS });
      testBuffered = turf.buffer(shape, TEST_BUFFER_METERS, { units: 'meters', steps: BUFFER_STEPS });
    } catch (err) {
      log.warn(`Skipping NFZ ${area.id}: could not buffer`, err);
      continue;
    }
    if (!buffered || !testBuffered) continue;

    // A buffer can come back as a MultiPolygon; treat each part as its own zone
    const parts: any[] = buffered.geometry.type === 'MultiPolygon'
      ? buffered.geometry.coordinates.map((coords: any) => turf.polygon(coords))
      : [buffered];

    parts.forEach((part, index) => {
      obstacles.push({
        id: parts.length > 1 ? `${area.id}-${index}` : area.id,
        name: area.name,
        polygon: part,
        ring: part.geometry.coordinates[0] as Position[],
        testPolygon: testBuffered,
        bbox: turf.bbox(part),
      });
    });
  }

  return obstacles;
}

// ==========================================
// AVOIDANCE
// ==========================================

const metresBetween = (a: Position, b: Position): number =>
  get3DDistanceInMeters(a[1], a[0], 0, b[1], b[0], 0);

export function pathLengthMeters(path: Position[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += metresBetween(path[i - 1], path[i]);
  return total;
}

const isInside = (point: Position, obstacle: Obstacle): boolean =>
  turf.booleanPointInPolygon(turf.point(point), obstacle.polygon);

export const isInsideAnyObstacle = (point: Position, obstacles: Obstacle[]): boolean =>
  obstacles.some(obstacle => isInside(point, obstacle));

// Cheap reject before the real intersection test — most legs are nowhere near
// most zones, and this runs on every distance recalculation
function legCouldTouch(from: Position, to: Position, obstacle: Obstacle): boolean {
  const [minX, minY, maxX, maxY] = obstacle.bbox;
  return !(
    Math.max(from[0], to[0]) < minX ||
    Math.min(from[0], to[0]) > maxX ||
    Math.max(from[1], to[1]) < minY ||
    Math.min(from[1], to[1]) > maxY
  );
}

// Walks the zone's boundary from where the leg enters to where it leaves, in
// whichever direction is shorter, and returns the vertices to fly instead.
function crossesObstacle(from: Position, to: Position, obstacle: Obstacle): boolean {
  if (!legCouldTouch(from, to, obstacle)) return false;
  return turf.booleanIntersects(turf.lineString([from, to]), obstacle.testPolygon);
}

const crossesAny = (from: Position, to: Position, obstacles: Obstacle[]): boolean =>
  obstacles.some(obstacle => crossesObstacle(from, to, obstacle));

// The boundary walk emits every vertex it passes, most of which are redundant
// once the path is viewed as a whole. Pull the string taut: from each anchor,
// jump to the furthest later point still reachable in a straight line.
function shortcut(path: Position[], obstacles: Obstacle[]): Position[] {
  if (path.length <= 2) return path;

  const taut: Position[] = [path[0]];
  let anchor = 0;

  while (anchor < path.length - 1) {
    let next = anchor + 1;

    for (let candidate = path.length - 1; candidate > anchor + 1; candidate--) {
      if (!crossesAny(path[anchor], path[candidate], obstacles)) {
        next = candidate;
        break;
      }
    }

    taut.push(path[next]);
    anchor = next;
  }

  return taut;
}

function detourAround(from: Position, to: Position, obstacle: Obstacle): Position[] | null {
  const boundary = turf.polygonToLine(obstacle.polygon) as any;

  const entrySnap = turf.nearestPointOnLine(boundary, turf.point(from));
  const exitSnap = turf.nearestPointOnLine(boundary, turf.point(to));

  const entryIndex = entrySnap.properties.index ?? 0;
  const exitIndex = exitSnap.properties.index ?? 0;

  // ring is closed, so the final coordinate repeats the first
  const vertexCount = obstacle.ring.length - 1;
  if (vertexCount < 3) return null;

  const forward: Position[] = [];
  for (let k = (entryIndex + 1) % vertexCount; forward.length <= vertexCount; k = (k + 1) % vertexCount) {
    forward.push(obstacle.ring[k]);
    if (k === exitIndex) break;
  }

  const backward: Position[] = [];
  for (let k = entryIndex; backward.length <= vertexCount; k = (k - 1 + vertexCount) % vertexCount) {
    backward.push(obstacle.ring[k]);
    if (k === (exitIndex + 1) % vertexCount) break;
  }

  const cost = (chain: Position[]) => pathLengthMeters([from, ...chain, to]);
  const best = cost(forward) <= cost(backward) ? forward : backward;

  return best.length > 0 ? best : null;
}

export interface AvoidanceResult {
  path: Position[];
  distanceMeters: number;
  // Points that sit inside a zone's clearance, so no detour can reach them
  blockedIndices: number[];
  unresolved: boolean;
}

// Routes a single leg around whatever it clips. Its two endpoints are fixed, so
// shortcutting can only ever drop vertices this function inserted.
function resolveLeg(from: Position, to: Position, obstacles: Obstacle[]): { path: Position[]; unresolved: boolean } {
  let path: Position[] = [from, to];
  let unresolved = true;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const next: Position[] = [path[0]];
    let detoured = false;

    for (let i = 1; i < path.length; i++) {
      const start = path[i - 1];
      const end = path[i];

      for (const obstacle of obstacles) {
        if (!crossesObstacle(start, end, obstacle)) continue;

        const detour = detourAround(start, end, obstacle);
        if (!detour) continue;

        next.push(...detour);
        detoured = true;
        break;
      }

      next.push(end);
    }

    path = next;

    if (!detoured) {
      unresolved = false;
      break;
    }
  }

  return { path: shortcut(path, obstacles), unresolved };
}

// Threads a straight point sequence around every no-fly zone it would clip.
// Works leg by leg, so every point handed in survives into the result.
export function avoidObstacles(points: Position[], obstacles: Obstacle[]): AvoidanceResult {
  const blockedIndices = points
    .map((point, index) => (obstacles.some(o => isInside(point, o)) ? index : -1))
    .filter(index => index !== -1);

  if (obstacles.length === 0 || points.length < 2) {
    return { path: points, distanceMeters: pathLengthMeters(points), blockedIndices, unresolved: false };
  }

  const path: Position[] = [points[0]];
  let unresolved = false;

  for (let i = 1; i < points.length; i++) {
    const leg = resolveLeg(points[i - 1], points[i], obstacles);
    path.push(...leg.path.slice(1));
    unresolved = unresolved || leg.unresolved;
  }

  if (unresolved) {
    log.warn('Gave up routing around no-fly zones after repeated passes; path may still clip a zone');
  }

  return { path, distanceMeters: pathLengthMeters(path), blockedIndices, unresolved };
}

// Straight home -> stops -> home, before any avoidance
export function straightPath(stops: RouteStop[], home: HomePoint): Position[] {
  return [
    [home.longitude, home.latitude],
    ...stops.map(stop => [stop.longitude, stop.latitude] as Position),
    [home.longitude, home.latitude],
  ];
}
