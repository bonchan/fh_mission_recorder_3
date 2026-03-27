
import { Waypoint } from '@/utils/interfaces';
import * as turf from '@turf/turf';
import { MissionTemplate } from '@/components/mission/templates'

export function generateWaypointsFromTemplate(triggerData: Waypoint, missionTemplate: MissionTemplate) {
  const { latitude, longitude, yaw, elevation } = triggerData;
  const originPos = [longitude, latitude];

  return missionTemplate.template.map((point, index, array) => {
    const isFirstOrLastSecurityPoint = (index === 0 || index === array.length - 1) && point.type == 'security';

    // 1. Calculate straight-line distance from the drone (0,0)
    const distanceMeters = Math.sqrt(point.x * point.x + point.y * point.y);

    let newLng = longitude;
    let newLat = latitude;

    // Only do the heavy math if the point actually moves away from the drone
    if (distanceMeters > 0) {
      // 2. Calculate local angle. Math.atan2(x, y) beautifully maps to a compass
      // where +Y is Forward (0 deg) and +X is Right (90 deg).
      const localAngleDeg = Math.atan2(point.x, point.y) * (180 / Math.PI);

      // 3. Add drone's global heading to get the true compass bearing
      const trueBearing = (yaw + localAngleDeg + 360) % 360;

      // 4. Project the new GPS coordinates
      const dest = turf.destination(
        originPos,
        distanceMeters / 1000, // Turf requires kilometers!
        trueBearing,
        { units: 'kilometers' }
      ).geometry.coordinates;

      newLng = dest[0];
      newLat = dest[1];
    }

    // 5. Calculate new global yaw (heading)
    const trueHeading = (yaw + point.yaw + 360) % 360;

    // FIXME move this values to a config file 
    const trueElevation = isFirstOrLastSecurityPoint ? 70 : elevation + point.z

    // 6. Return the finalized global waypoint
    return {
      ...triggerData,               // Keep timestamp, serial number, etc.
      id: crypto.randomUUID(),
      longitude: newLng,
      latitude: newLat,
      elevation: trueElevation, // FIXME
      height: trueElevation, // FIXME
      yaw: trueHeading,
      pitch: point.pitch,     // Use template's exact pitch
      zoom: point.zoomFactor,
      type: point.type
    };
  });
}


export function generateWaypointsFromTemplate2(triggerData: LiveDroneData, template: any[]) {
  const { latitude, longitude, heading, altitude } = triggerData;
  const originPos = [longitude, latitude];

  return template.map(point => {
    // 1. Calculate straight-line distance from the drone (0,0)
    const distanceMeters = Math.sqrt(point.x * point.x + point.y * point.y);

    let newLng = longitude;
    let newLat = latitude;

    // Only do the heavy math if the point actually moves away from the drone
    if (distanceMeters > 0) {
      // 2. Calculate local angle. Math.atan2(x, y) beautifully maps to a compass
      // where +Y is Forward (0 deg) and +X is Right (90 deg).
      const localAngleDeg = Math.atan2(point.x, point.y) * (180 / Math.PI);

      // 3. Add drone's global heading to get the true compass bearing
      const trueBearing = (heading + localAngleDeg + 360) % 360;

      // 4. Project the new GPS coordinates
      const dest = turf.destination(
        originPos,
        distanceMeters / 1000, // Turf requires kilometers!
        trueBearing,
        { units: 'kilometers' }
      ).geometry.coordinates;

      newLng = dest[0];
      newLat = dest[1];
    }

    // 5. Calculate new global yaw (heading)
    const trueHeading = (heading + point.yaw + 360) % 360;

    // 6. Return the finalized global waypoint
    return {
      ...triggerData,               // Keep timestamp, serial number, etc.
      longitude: newLng,
      latitude: newLat,
      altitude: altitude + point.z, // Add the local Z to the drone's absolute altitude
      heading: trueHeading,
      gimbalPitch: point.pitch,     // Use template's exact pitch
      zoomFactor: point.zoomFactor,
      type: point.type
    };
  });
}