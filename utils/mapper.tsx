import { Drone, Dock, Annotation, Waypoint, FlatDevice } from '@/utils/interfaces';
import { extractNumber, prefixKeys } from '@/utils/utils'

export function toDock(djiItem: any): any | null {
    if (!djiItem.host || !djiItem.parents || djiItem.parents.length === 0) return null;
    const parentRaw = djiItem.parents[0];
    const device_state = parentRaw.device_state;

    const dock: Dock = {
        index: extractNumber(parentRaw.device_organization_callsign),
        deviceSn: parentRaw.device_sn,
        deviceModelName: parentRaw.device_model.name,
        deviceProjectCallsign: parentRaw.device_project_callsign,
        deviceOrganizationCallsign: parentRaw.device_organization_callsign,
        longitude: device_state.longitude,
        latitude: device_state.latitude,
        height: device_state.height,
    };
    return dock
}

export function toDrone(djiItem: any, dock: Dock | null): any | null {
    if (!djiItem.host || !djiItem.parents || djiItem.parents.length === 0) return null;
    const hostRaw = djiItem.host;
    const camera = hostRaw.device_state.cameras?.[0] || { payload_index: 'unknown' };

    const drone: Drone = {
        deviceSn: hostRaw.device_sn,
        deviceModelName: hostRaw.device_model.name,
        deviceModelKey: hostRaw.device_model.key,
        deviceProjectCallsign: hostRaw.device_project_callsign,
        deviceOrganizationCallsign: hostRaw.device_organization_callsign,
        payloadIndex: camera.payload_index,
        parent: dock,
    };

    return drone
}

export function toWaypoint(djiItem: any, hostSn?: string): any | null {
    if (!djiItem.host || !djiItem.parents || djiItem.parents.length === 0) return null;
    const hostRaw = djiItem.host;

    if (hostSn && hostSn !== hostRaw.device_sn) return null

    const device_state = hostRaw.device_state;
    const payload_index = device_state.cameras[0].payload_index;

    const waypoint: Waypoint = {
        id: crypto.randomUUID(),
        longitude: device_state.longitude,
        latitude: device_state.latitude,
        elevation: device_state.elevation,
        height: device_state.height,
        yaw: device_state[payload_index].gimbal_yaw,
        pitch: device_state[payload_index].gimbal_pitch,
        zoom: device_state.cameras[0].zoom_factor,
        hoverTime: 0,
        turn: 'CW',
        actionGroup: null,
        type: 'default'
    };
    return waypoint
}

export function toDockDrone(djiItem: any): any | null {
    if (!djiItem.host || !djiItem.parents || djiItem.parents.length === 0) return null;
    const dock: Dock = toDock(djiItem)
    const drone: Drone = toDrone(djiItem, dock)
    return drone;
}

export const toFlatDevice = (item: any): FlatDevice | null => {
    if (!item || !item.host) return null;

    const host = item.host;
    // DJI data usually puts the Dock inside a 'parents' array
    const parent = (item.parents && item.parents.length > 0) ? item.parents[0] : null;

    if (!parent) return null

    return {
        id: host.device_sn || crypto.randomUUID(),

        // Host (Drone)
        hostSn: host.device_sn || '--',
        hostModel: host.device_model?.name || '--',
        hostCallsign: host.device_organization_callsign || host.device_project_callsign || '--',
        hostStatus: host.device_online_status ? '🟢 Online' : '🔴 Offline',
        // Parent (Dock)
        parentIndex: extractNumber(parent?.device_organization_callsign),
        parentSn: parent?.device_sn || '--',
        parentModel: parent?.device_model?.name || '--',
        parentCallsign: parent?.device_organization_callsign || parent?.device_project_callsign || '--',
        parentStatus: parent?.device_online_status ? '🟢 Online' : '🔴 Offline',

        // The massive raw objects for deep inspection
        rawHost: host,
        rawParent: parent,
    };
};

export function toAnnotation(djiItem: any): any | null {
    const geometry = djiItem.resource.content.geometry
    const properties = djiItem.resource.content.properties
    if (geometry.type == 'Point') {
        const [lon, lat, _] = geometry.coordinates;
        const annotation: Annotation = {
            id: djiItem.id,
            name: djiItem.name,
            longitude: lon,
            latitude: lat,
            color: properties.color,
        }
        return annotation
    }
    return null
}