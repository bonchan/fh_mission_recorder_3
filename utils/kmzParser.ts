import JSZip from 'jszip';
import { Waypoint } from './interfaces';
import { getZoomFromFocalLength } from '@/utils/utils';

export const kmzParser = {
  async unzip(blob: Blob) {
    const zip = await JSZip.loadAsync(blob);
    const templateFile = zip.file("wpmz/template.kml");
    const waylinesFile = zip.file("wpmz/waylines.wpml");

    if (!templateFile || !waylinesFile) throw new Error("Missing KML/WPML files");

    const [templateKml, waylinesWpml] = await Promise.all([
      templateFile.async('string'),
      waylinesFile.async('string')
    ]);

    return {
      templateKml,
      waylinesWpml
    };
  },

  extractWaypoints(kmlString: string): Waypoint[] {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(kmlString, "text/xml");

    // We usually pull from <Placemark> in the template.kml
    const placemarks = xmlDoc.getElementsByTagName("Placemark");
    const waypoints: Waypoint[] = [];

    for (let i = 0; i < placemarks.length; i++) {
      const pm = placemarks[i];

      // 1. Base Coordinates
      const coordText = pm.getElementsByTagName("coordinates")[0]?.textContent || "0,0";
      const [lng, lat] = coordText.split(',').map(Number);

      const elevation = Number(pm.getElementsByTagName("wpml:ellipsoidHeight")[0]?.textContent || 0);
      const height = Number(pm.getElementsByTagName("wpml:executeHeight")[0]?.textContent || pm.getElementsByTagName("wpml:height")[0]?.textContent || 0);

      // 2. Setup default Waypoint (will be overwritten by actions)
      const waypoint: Waypoint = {
        id: crypto.randomUUID(),
        longitude: lng,
        latitude: lat,
        elevation: elevation,
        height: height,
        yaw: 0,
        pitch: 0,
        zoom: 1,
        hoverTime: 0,
        turn: 'CW',
        actionGroup: null, // You can store the raw parsed actions here if needed
        type: 'default',
        tagIds: []
      };

      // 3. Reverse-Engineer the Action Group
      const actions = pm.getElementsByTagName("wpml:action");

      for (let j = 0; j < actions.length; j++) {
        const action = actions[j];
        const func = action.getElementsByTagName("wpml:actionActuatorFunc")[0]?.textContent;
        const params = action.getElementsByTagName("wpml:actionActuatorFuncParam")[0];

        if (!func || !params) continue;

        switch (func) {
          case "rotateYaw":
            waypoint.yaw = Number(params.getElementsByTagName("wpml:aircraftHeading")[0]?.textContent || 0);
            const pathMode = params.getElementsByTagName("wpml:aircraftPathMode")[0]?.textContent;
            waypoint.turn = pathMode === "counterClockwise" ? "CCW" : "CW";
            break;

          case "gimbalRotate":
            waypoint.pitch = Number(params.getElementsByTagName("wpml:gimbalPitchRotateAngle")[0]?.textContent || 0);
            break;

          case "zoom":
            const focalLength = Number(params.getElementsByTagName("wpml:focalLength")[0]?.textContent || 0);
            waypoint.zoom = getZoomFromFocalLength(focalLength); // Inverse util needed
            break;

          case "orientedShoot":
            waypoint.type = 'picture';

            // Reconstruct tags if they exist
            const tags = action.getElementsByTagName("wpml:actionActuatorTags")[0]?.textContent;
            if (tags) waypoint.tagIds = tags.split(',');

            // Overwrite pitch/yaw/zoom based on the specific shoot params (M3E logic)
            waypoint.pitch = Number(params.getElementsByTagName("wpml:gimbalPitchRotateAngle")[0]?.textContent || waypoint.pitch);
            waypoint.yaw = Number(params.getElementsByTagName("wpml:aircraftHeading")[0]?.textContent || waypoint.yaw);

            const shootFocalLength = Number(params.getElementsByTagName("wpml:focalLength")[0]?.textContent || 0);
            if (shootFocalLength) waypoint.zoom = getZoomFromFocalLength(shootFocalLength);
            break;

          case "hover":
            waypoint.hoverTime = Number(params.getElementsByTagName("wpml:hoverTime")[0]?.textContent || 0);
            if (waypoint.type === 'default') {
              waypoint.type = 'hover'; // Optionally mark type as hover if it's not a picture
            }
            break;
        }
      }

      waypoints.push(waypoint);
    }

    return waypoints;
  }
};