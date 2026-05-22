import { Mission, RouteCollisionResult, Waypoint, WaypointMini } from '@/utils/interfaces';
import { createLogger } from '@/utils/logger';
import { toWaypointMini } from '@/utils/mapper';
import { RouteEditor, type DjiKmzData } from 'dji-kmz-parser';

// WGS84 Ellipsoid Constants
const WGS84_A = 6378137.0; // Equatorial radius in meters
const WGS84_E2 = 0.00669437999014; // Eccentricity squared

const log = createLogger('geo');


// 1. Calculate the exact radius of curvature for a specific latitude
function getWGS84Radii(latDeg: number) {
  const latRad = latDeg * (Math.PI / 180);
  const sinLat = Math.sin(latRad);
  const w = Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);

  const M = (WGS84_A * (1 - WGS84_E2)) / (w * w * w); // Meridian radius (North/South curvature)
  const N = WGS84_A / w; // Prime vertical radius (East/West curvature)

  return { M, N };
}

// 2. FOR THE GENERATOR: Project new coordinates relative to the drone's nose
export function projectRelativeOffset(
  originLat: number, originLon: number, originYaw: number,
  rightX: number, forwardY: number
) {
  const distance = Math.sqrt(rightX * rightX + forwardY * forwardY);
  if (distance === 0) return { lat: originLat, lon: originLon };

  // Get true global bearing
  const localAngle = Math.atan2(rightX, forwardY) * (180 / Math.PI);
  const trueBearing = (originYaw + localAngle + 360) % 360;
  const trueBearingRad = trueBearing * (Math.PI / 180);

  // Calculate North and East offsets in exact meters
  const dN = distance * Math.cos(trueBearingRad);
  const dE = distance * Math.sin(trueBearingRad);

  // Convert meters to decimal degrees using local WGS84 curvature
  const { M, N } = getWGS84Radii(originLat);
  const originLatRad = originLat * (Math.PI / 180);

  const dLat = (dN / M) * (180 / Math.PI);
  const dLon = (dE / (N * Math.cos(originLatRad))) * (180 / Math.PI);

  return { lat: originLat + dLat, lon: originLon + dLon };
}

// 3. FOR THE UI: Read the offset relative to the drone's nose
export function getRelativeOffset(
  originLat: number, originLon: number, originYaw: number,
  targetLat: number, targetLon: number
) {
  const { M, N } = getWGS84Radii(originLat);
  const originLatRad = originLat * (Math.PI / 180);

  // Calculate global N/S and E/W distance in exact meters
  const dLatRad = (targetLat - originLat) * (Math.PI / 180);
  const dLonRad = (targetLon - originLon) * (Math.PI / 180);

  const dN = dLatRad * M;
  const dE = dLonRad * N * Math.cos(originLatRad);

  // Find true distance and global bearing between points
  const distance = Math.sqrt(dN * dN + dE * dE);
  const trueBearingRad = Math.atan2(dE, dN);
  const trueBearingDeg = (trueBearingRad * (180 / Math.PI) + 360) % 360;

  // Subtract the drone's yaw to find out where the point is relative to its nose!
  const relativeAngleDeg = (trueBearingDeg - originYaw + 360) % 360;
  const relativeAngleRad = relativeAngleDeg * (Math.PI / 180);

  // Break back down into Forward (Y) and Right (X)
  const forwardY = distance * Math.cos(relativeAngleRad);
  const rightX = distance * Math.sin(relativeAngleRad);

  return { x: rightX, y: forwardY };
}

export function get3DDistanceInMeters(
  lat1: number, lon1: number, elev1: number,
  lat2: number, lon2: number, elev2: number
): number {
  // 1. Calculate 2D horizontal distance using Haversine
  const R = 6371e3; // Earth's radius in meters
  const toRad = (value: number) => (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance2D = R * c;

  // 2. Calculate vertical distance
  const distanceVertical = elev2 - elev1;

  // 3. Combine them using the Pythagorean theorem for true 3D distance
  return Math.sqrt((distance2D * distance2D) + (distanceVertical * distanceVertical));
}

export const optimizeMissionPath = (mission: Mission | undefined): Mission | void => {
  if (!mission) return;
  const waypoints = mission.waypoints || [];

  // 👇 1. Strip out all security waypoints immediately
  const filteredWaypoints = waypoints.filter(wp => wp.type !== 'security');

  // 👇 2. If 2 or fewer points remain, return the mission with the security points removed
  if (filteredWaypoints.length <= 2) {
    return {
      ...mission,
      waypoints: filteredWaypoints
    };
  }

  // 👇 3. Use the filtered list for everything else! Lock the first waypoint.
  const sortedPath: Waypoint[] = [filteredWaypoints[0]];

  // Pool of unvisited points (using the filtered list)
  let unvisited: Waypoint[] = filteredWaypoints.slice(1);
  let currentPoint = sortedPath[0];

  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let shortestDistance = Infinity;

    // Find the closest point in 3D space
    for (let i = 0; i < unvisited.length; i++) {
      const targetPoint = unvisited[i];

      // Now using 3D distance with elevation!
      const distance = get3DDistanceInMeters(
        currentPoint.latitude, currentPoint.longitude, currentPoint.elevation,
        targetPoint.latitude, targetPoint.longitude, targetPoint.elevation
      );

      if (distance < shortestDistance) {
        shortestDistance = distance;
        nearestIndex = i;
      }
    }

    // Move closest point to sorted path
    const nextPoint = unvisited[nearestIndex];
    sortedPath.push(nextPoint);

    currentPoint = nextPoint;
    unvisited.splice(nearestIndex, 1);
  }

  // Return the fresh mission, now optimized and free of security waypoints!
  const updatedMission = {
    ...mission,
    waypoints: sortedPath
  };

  return updatedMission;
};

/**
 * Calculates the shortest distance in meters from a point (circle center) to a line segment.
 */
export function getDistanceToSegment(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
  cLat: number, cLon: number
): number {
  const kLat = 111320.0;
  const kLon = (40075000.0 * Math.cos(cLat * (Math.PI / 180))) / 360.0;

  // Convert points to local flat-earth Cartesian coordinates (in meters) relative to the circle center
  const x1 = (lon1 - cLon) * kLon;
  const y1 = (lat1 - cLat) * kLat;
  const x2 = (lon2 - cLon) * kLon;
  const y2 = (lat2 - cLat) * kLat;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  // If the segment is just a single point, return the distance to that point
  if (lenSq === 0) return Math.hypot(x1, y1);

  // Project the origin (circle center) onto the line segment to find the closest point
  const t = Math.max(0, Math.min(1, -(x1 * dx + y1 * dy) / lenSq));

  return Math.hypot(x1 + t * dx, y1 + t * dy);
}

/**
 * Calculates a 3-point tangent bypass path around a circle.
 */
export function calculateTangentBypass(
  latA: number, lonA: number,
  latB: number, lonB: number,
  cLat: number, cLon: number,
  radiusM: number
): { latitude: number; longitude: number }[] {
  const kLat = 111320.0;
  const kLon = (40075000.0 * Math.cos(cLat * (Math.PI / 180))) / 360.0;

  const ax = (lonA - cLon) * kLon;
  const ay = (latA - cLat) * kLat;
  const bx = (lonB - cLon) * kLon;
  const by = (latB - cLat) * kLat;

  const distA = Math.hypot(ax, ay);
  const distB = Math.hypot(bx, by);

  // If either point is already inside the danger zone, a simple tangent bypass won't work
  if (distA <= radiusM || distB <= radiusM) return [];

  const angleA = Math.atan2(ay, ax);
  const angleB = Math.atan2(by, bx);

  // Calculate the angle offset for the tangent points
  const thetaA = Math.acos(radiusM / distA);
  const thetaB = Math.acos(radiusM / distB);

  // The two possible tangent angles for point A and point B
  const t1Opts = [angleA + thetaA, angleA - thetaA];
  const t2Opts = [angleB + thetaB, angleB - thetaB];

  let bestPair: [number, number] | null = null;
  let minDiff = Infinity;
  const TWO_PI = 2 * Math.PI;

  // Find the pair of tangent points that results in the shortest path around the circle
  for (const a1 of t1Opts) {
    for (const a2 of t2Opts) {
      const delta = a1 - a2 + Math.PI;

      // Safe JS Modulo to mimic Python's % behavior with negative numbers
      const pyMod = ((delta % TWO_PI) + TWO_PI) % TWO_PI;
      const diff = Math.abs(pyMod - Math.PI);

      if (diff < minDiff) {
        minDiff = diff;
        bestPair = [a1, a2];
      }
    }
  }

  if (!bestPair) return [];

  const [ang1, ang2] = bestPair;

  // Calculate the midpoint angle of the curve
  const midAngle = ang1 + (Math.atan2(Math.sin(ang2 - ang1), Math.cos(ang2 - ang1)) / 2);

  // Generate the 3 bypass points (Entry tangent, Midpoint pushed out by 2m, Exit tangent)
  const pts = [
    { x: radiusM * Math.cos(ang1), y: radiusM * Math.sin(ang1) },
    { x: (radiusM + 2) * Math.cos(midAngle), y: (radiusM + 2) * Math.sin(midAngle) },
    { x: radiusM * Math.cos(ang2), y: radiusM * Math.sin(ang2) }
  ];

  // Convert back to Global GPS coordinates
  return pts.map(p => ({
    latitude: cLat + (p.y / kLat),
    longitude: cLon + (p.x / kLon)
  }));
}

export function calculateRouteCollision1(
  routeId: string | number,
  waypoints: any[],
  annotations: any[],
  circleBuffer: number
) {
  let isCompromised = false;
  const safeWaypoints: any[] = [];
  let lastSafeWp: any = null;
  let activeDangerZone: any = null;

  const buffer5 = circleBuffer * 1.05;
  const buffer15 = circleBuffer * 1.15;

  // Sort waypoints by index to ensure chronological order
  const sortedWps = [...waypoints].sort((a, b) => a.index - b.index);

  for (const wp of sortedWps) {
    // 1. Check if waypoint is inside an annotation circle
    const hitZone = annotations.find(a => {
      if (!a.latitude || !a.longitude) return false;
      const dist = get3DDistanceInMeters(wp.latitude, wp.longitude, 0, a.latitude, a.longitude, 0);
      return dist <= circleBuffer;
    });

    if (!hitZone) {
      if (activeDangerZone && lastSafeWp) {
        // 2. Check if the straight line between last safe point and current safe point clips the circle
        const distToCircle = getDistanceToSegment(
          lastSafeWp.latitude, lastSafeWp.longitude,
          wp.latitude, wp.longitude,
          activeDangerZone.latitude, activeDangerZone.longitude
        );

        if (distToCircle < buffer5) {
          // 3. Generate the 3-point bypass route
          const bypass = calculateTangentBypass(
            lastSafeWp.latitude, lastSafeWp.longitude,
            wp.latitude, wp.longitude,
            activeDangerZone.latitude, activeDangerZone.longitude,
            buffer15
          );

          // Add bypass points to the safe route
          bypass.forEach(bWp => safeWaypoints.push({ ...bWp }));
        }
        activeDangerZone = null;
      }

      safeWaypoints.push(wp);
      lastSafeWp = wp;
    } else {
      isCompromised = true;
      activeDangerZone = hitZone;
    }
  }

  return {
    flight_route_id: routeId,
    compromised: isCompromised,
    safe_waypoints: safeWaypoints
  };
}



export function calculateRouteCollision(
  originalData: DjiKmzData,
  annotations: Annotation[],
  circleBuffer: number
): RouteCollisionResult {

  const buffer5 = circleBuffer * 1.05;
  const buffer15 = circleBuffer * 1.15;

  // --- PASS 1: figure out what needs to happen, using WaypointMini for math ---
  const waypoints = toWaypointMini(originalData);
  const sortedWps = [...waypoints].sort((a, b) => a.index - b.index);

  let isCompromised = false;
  let lastSafeWp: WaypointMini | null = null;
  let activeDangerZone: Annotation | null = null;

  const indicesToRemove: number[] = [];
  const bypassInsertions: { afterIndex: number; lat: number; lon: number }[] = [];

  for (const wp of sortedWps) {
    const hitZone = annotations.find(a => {
      const dist = get3DDistanceInMeters(wp.latitude, wp.longitude, 0, a.latitude, a.longitude, 0);
      return dist <= circleBuffer;
    });

    if (!hitZone) {
      if (activeDangerZone && lastSafeWp) {
        const distToCircle = getDistanceToSegment(
          lastSafeWp.latitude, lastSafeWp.longitude,
          wp.latitude, wp.longitude,
          activeDangerZone.latitude, activeDangerZone.longitude
        );

        if (distToCircle < buffer5) {
          const bypass = calculateTangentBypass(
            lastSafeWp.latitude, lastSafeWp.longitude,
            wp.latitude, wp.longitude,
            activeDangerZone.latitude, activeDangerZone.longitude,
            buffer15
          );

          // record where to insert bypass points — after lastSafeWp
          bypass.forEach(bWp => bypassInsertions.push({
            afterIndex: lastSafeWp!.index,
            lat: bWp.latitude,
            lon: bWp.longitude,
          }));
        }
        activeDangerZone = null;
      }

      lastSafeWp = wp;
    } else {
      isCompromised = true;
      activeDangerZone = hitZone;
      indicesToRemove.push(wp.index);
    }
  }

  if (!isCompromised) {
    return { compromised: false, modifiedData: null };
  }

  // --- PASS 2: apply changes via RouteEditor ---
  const editor = new RouteEditor(originalData); // structuredClone happens inside

  // Remove compromised waypoints — highest index first to avoid reindex shifting
  [...indicesToRemove].sort((a, b) => b - a).forEach(index => {
    editor.removeWaypoint(index);
  });

  const baseOffset = editor.getHeightOffset();
  const geoidUndulation = editor.getGeoidUndulation();
  const desiredFlightHeight = 70;
  const absoluteHeight = desiredFlightHeight + baseOffset;
  const egm96Height = absoluteHeight - geoidUndulation; 

  log.info("baseOffset", baseOffset);

  // Sort insertions by afterIndex ascending so we process them in order
  const sortedInsertions = [...bypassInsertions].sort((a, b) => a.afterIndex - b.afterIndex);

  // Track how many waypoints we've inserted so far to offset the target index
  let insertionOffset = 0;

  // Also account for removed waypoints that come BEFORE the insertion point
  sortedInsertions.forEach(({ afterIndex, lat, lon }) => {
    // How many removed indices were <= afterIndex?
    const removedBefore = indicesToRemove.filter(i => i <= afterIndex).length;

    // Adjusted index in the mutated array
    const adjustedIndex = afterIndex - removedBefore + insertionOffset;

    const templateWp = editor.buildTemplateBypassWp(lat, lon, egm96Height, absoluteHeight);
    const waylineWp = editor.buildWaylineBypassWp(lat, lon, absoluteHeight);

    editor.addWaypoint(adjustedIndex + 1, templateWp, waylineWp);

    insertionOffset++;
  });

  return {
    compromised: true,
    modifiedData: editor.getData(),
  };
}
