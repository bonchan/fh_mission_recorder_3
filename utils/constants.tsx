export const DJI_COCKPIT_REGEX          = /^https:\/\/fh\.dji\.com\/organization\/([^\/]+)\/project\/([^\/?]+).*[?&]droneSn=([^&]+).*[?&]gatewaySn=([^&#]+)#\/cockpit$/;
export const DJI_PROJECT_BASE_REGEX     = /^https:\/\/fh\.dji\.com\/organization\/([^\/]+)\/project\/([^\/\?#]+)(?:[\/#\?].*)?$/;
export const DJI_COCKPIT_URL_REGEX      = /^https:\/\/fh\.dji\.com\/organization\/([^\/]+)\/project\/([^\/\?#]+)\?droneSn=([^&]+)&gatewaySn=([^&#]+).*$/;
export const DJI_PLAN_CREATE_URL_REGEX  = /^https:\/\/fh\.dji\.com\/organization\/([^\/]+)\/project\/([^\/#\?]+)#\/plan\/create-plan.*$/;

export const INVALID_ROUTE_CHARS_REGEX = /[<>:"\/|?*._\\]/

// Dock selection standing for "no dock yet" — the home point is placed by hand
// and the dock model is chosen at upload time
export const FUTURE_DOCK = 'future';

export interface DockTemplate {
  id: string;
  label: string;
  // Same shape the topologies payload uses:
  // deviceModelKey is domain-type-subType, payloadIndex is type-subType-gimbalIndex
  deviceModelKey: string;
  payloadIndex: string;
}

// Stands in for a dock that isn't in the project yet, so a mission can still be
// built for it. VALUES NEED CONFIRMING against a real dock of each model —
// read device_model.key and payload_index off the topologies response.
export const DOCK_TEMPLATES: DockTemplate[] = [
  { id: 'dock2', label: 'DJI Dock 2', deviceModelKey: '0-90-0', payloadIndex: '81-0-0' },
  { id: 'dock3', label: 'DJI Dock 3', deviceModelKey: '0-91-0', payloadIndex: '99-0-0' },
];

export const FIVE_MIN_MS = 5 * 60 * 1000;
export const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

export const ICONS_ON = {
    "128": "icon/128-on.png",
    "96": "icon/96-on.png",
    "48": "icon/48-on.png",
    "32": "icon/32-on.png",
    "16": "icon/16-on.png",
}

export const ICONS_OFF = {
    "128": "icon/128-off.png",
    "96": "icon/96-off.png",
    "48": "icon/48-off.png",
    "32": "icon/32-off.png",
    "16": "icon/16-off.png",
}