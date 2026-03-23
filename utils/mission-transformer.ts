// utils/mission-transformer.ts
import { getFocalLengthFromZoom, normalizeHeading360, getShortestTurn } from '@/utils/utils'
import { Waypoint } from './interfaces';

export function recalculateWaypointTurns(waypoints: Waypoint[]): Waypoint[] {
    if (!waypoints || waypoints.length === 0) return [];

    // Create a new array so we don't mutate React state directly
    const updated = [...waypoints];

    for (let i = 0; i < updated.length - 1; i++) {
        const currentWp = updated[i];
        const nextWp = updated[i + 1];

        // Update the current waypoint's turn based on where it needs to look next
        currentWp.turn = getShortestTurn(currentWp.yaw, nextWp.yaw);
    }

    // The very last waypoint doesn't have a next point to turn toward.
    // You can default it to CW, or keep whatever it currently has.
    updated[updated.length - 1].turn = 'CW';

    return updated;
}

export const transformWaypointsForExport = (waypoints: Waypoint[], payloadPositionIndex: number) => {
    return waypoints.map((wp, index) => {

        // 1. Start with the base coordinate data
        const waypoint = {
            ...wp,
            index: index,
            waypointSpeed: 15, // Default speed
            isRisky: false,
            ellipsoidHeight: wp.elevation,// FIXME wp.height,
            height: wp.elevation,
            useStraightLine: 1,

        };

        // 2. Add Actions based on your logic (Dynamic Injection)
        const actions = [];
        let actionId = 0

        actions.push({
            actionId: actionId++,
            actionActuatorFunc: "rotateYaw",
            actionActuatorFuncParam: {
                aircraftHeading: normalizeHeading360(wp.yaw),
                aircraftPathMode: wp.turn ? "clockwise" : "counterClockwise",
            }
        });

        actions.push({
            actionId: actionId++,
            actionActuatorFunc: "gimbalRotate",
            actionActuatorFuncParam: {
                gimbalRotateMode: "absoluteAngle",
                gimbalPitchRotateEnable: 1,
                gimbalPitchRotateAngle: wp.pitch,
            }
        });

        actions.push({
            actionId: actionId++,
            actionActuatorFunc: "zoom",
            actionActuatorFuncParam: {
                payloadPositionIndex: payloadPositionIndex,
                focalLength: getFocalLengthFromZoom(wp.zoom),
            }
        });

        // actions.push({
        //     actionId: actionId++,
        //     actionActuatorFunc: "takePhoto",
        //     actionActuatorFuncParam: {
        //         payloadPositionIndex: payloadPositionIndex,
        //         payloadLensIndex: "zoom,ir",
        //         useGlobalPayloadLensIndex: 1
        //     }
        // });

        actions.push({
            actionId: actionId++,
            actionActuatorFunc: "orientedShoot",
            actionActuatorFuncParam: {
                gimbalPitchRotateAngle: wp.pitch,               // From recorded data
                gimbalRollRotateAngle: 0,
                gimbalYawRotateAngle: normalizeHeading360(wp.yaw),                   // Align with aircraftHeading for M3E
                focusX: 0,                                    // Center (960/2)
                focusY: 0,                                    // Center (720/2)
                focusRegionWidth: 0,
                focusRegionHeight: 0,
                focalLength: getFocalLengthFromZoom(wp.zoom),   // Example focal length
                aircraftHeading: normalizeHeading360(wp.yaw),                        // True north relative
                accurateFrameValid: 0,                          // 1: AI Spot-check ON
                payloadPositionIndex: payloadPositionIndex,
                // payloadLensIndex: "zoom,ir",                    // "wide", "zoom", or "wide,ir"
                useGlobalPayloadLensIndex: 1,
                targetAngle: 0,
                actionUuid: crypto.randomUUID(),                // Unique ID for image association
                imageWidth: 0,
                imageHeight: 0,
                afPos: 0,
                gimbalPort: 0,
                // orientedCameraType: 53,                         // 52: M30 Dual, 53: M30T Triple
                orientedPhotoMode: "normalPhoto"                // "normalPhoto" or "lowLightSmartShooting"
            }
        });

        actions.push({
            actionId: actionId++,
            actionActuatorFunc: "zoom",
            actionActuatorFuncParam: {
                payloadPositionIndex: payloadPositionIndex,
                focalLength: getFocalLengthFromZoom(1),
            }
        });



        // 3. Wrap into an Action Group if actions exist
        if (actions.length > 0) {
            waypoint.actionGroup = {
                actionGroupId: index,
                actionGroupStartIndex: index,
                actionGroupEndIndex: index,
                actionGroupMode: "sequence",
                actionTrigger: {
                    actionTriggerType: "reachPoint"
                },
                actions: actions
            };
        }

        return waypoint;
    });
};