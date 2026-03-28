import { Waypoint } from '@/utils/interfaces';
import { MissionTemplate } from '@/components/mission/templates';
import { projectRelativeOffset } from '@/utils/geo'; // Import our new WGS84 math!

export function generateWaypointsFromTemplate(triggerData: Waypoint, missionTemplate: MissionTemplate) {
  const { latitude, longitude, yaw, elevation } = triggerData;

  return missionTemplate.template.map((point, index, array) => {
    const isFirstOrLastSecurityPoint = (index === 0 || index === array.length - 1) && point.type == 'security';

    // 1. Generate ultra-accurate WGS84 coordinates using our new geo function!
    const { lat: newLat, lon: newLng } = projectRelativeOffset(
      latitude, 
      longitude, 
      yaw, 
      point.x, 
      point.y
    );

    // 2. Calculate new global yaw (heading)
    const trueHeading = (yaw + point.yaw + 360) % 360;

    // FIXME move this values to a config file 
    const trueElevation = isFirstOrLastSecurityPoint ? 70 : elevation + point.z;
    const trueTags = [...(missionTemplate.templateTagIds || []), ...(point.tagIds || [])];

    // 3. Return the finalized global waypoint
    return {
      ...triggerData,
      id: crypto.randomUUID(),
      longitude: newLng,
      latitude: newLat,
      elevation: trueElevation, 
      height: trueElevation, 
      yaw: trueHeading,
      pitch: point.pitch, 
      zoom: point.zoomFactor,
      type: point.type,
      tagIds: trueTags
    };
  });
}
