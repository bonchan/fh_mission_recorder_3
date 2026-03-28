import { Mission, Waypoint } from '@/utils/interfaces';

// WGS84 Ellipsoid Constants
const WGS84_A = 6378137.0; // Equatorial radius in meters
const WGS84_E2 = 0.00669437999014; // Eccentricity squared

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