import { Mission, Waypoint } from '@/utils/interfaces';

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