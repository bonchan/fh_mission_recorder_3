import { Drone, Dock, Annotation } from '@/utils/interfaces';
import { extractNumber } from '@/utils/utils'

export function toDock(djiItem: any): any | null {
    if (!djiItem.host || !djiItem.parents || djiItem.parents.length === 0) return null;
    const parentRaw = djiItem.parents[0];
    const device_state = parentRaw.device_state;

    const dock: Dock = {
        index: extractNumber(parentRaw.device_organization_callsign),
        deviceSn: parentRaw.device_sn,
        deviceModelName: parentRaw.device_model.name,
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
        deviceOrganizationCallsign: hostRaw.device_organization_callsign,
        payloadIndex: camera.payload_index,
        parent: dock,
    };

    return drone
}

export function toDockDrone(djiItem: any): any | null {
    if (!djiItem.host || !djiItem.parents || djiItem.parents.length === 0) return null;
    const dock: Dock = toDock(djiItem)
    const drone: Drone = toDrone(djiItem, dock)
    return drone;
}

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