import L from 'leaflet';

import dockEmptyIconUrl from '@/assets/icons/dock_empty.svg';
import dockFullIconUrl from '@/assets/icons/dock_full.svg';
import droneIconUrl from '@/assets/icons/drone.png';

export const dockFullIcon = new L.Icon({
  iconUrl: dockFullIconUrl,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  tooltipAnchor: [0, -32],
});

export const dockEmptyIcon = new L.Icon({
  iconUrl: dockEmptyIconUrl,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  tooltipAnchor: [0, -32],
});

export const droneIcon = new L.Icon({
  iconUrl: droneIconUrl,
  iconSize: [40, 40],
  iconAnchor: [16, 40],
  tooltipAnchor: [0, -40],
});

export const homeIcon = new L.DivIcon({
  className: 'clear-custom-icon',
  html: `<div style="width:28px;height:28px;border-radius:50%;background:#fff;border:3px solid #111;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;font-weight:800;font-size:15px;color:#111;box-shadow:0 1px 4px rgba(0,0,0,0.5);">H</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  tooltipAnchor: [0, -18],
});

// A clustered stop gets a white outer ring so it reads as several points flown
// as one, with its member count in the corner
export const getRoutePointIcon = (sequence: number, color: string, memberCount = 1) => {
  const clustered = memberCount > 1;
  const size = clustered ? 26 : 22;
  const ring = clustered ? 'box-shadow:0 0 0 2px #fff;' : '';
  const badge = clustered
    ? `<div style="position:absolute;top:-6px;right:-8px;min-width:14px;height:14px;padding:0 3px;border-radius:7px;background:#fff;border:1px solid #000;font-size:9px;line-height:12px;text-align:center;font-weight:700;color:#000;">${memberCount}</div>`
    : '';

  return new L.DivIcon({
    className: 'clear-custom-icon',
    html: `<div style="position:relative;width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid #000;${ring}display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;font-weight:700;font-size:11px;color:#000;">${sequence}${badge}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [0, -(size / 2 + 3)],
  });
};

// Sits at the midpoint of a leg, rotated to point at the next waypoint.
// Takes a compass bearing; the glyph itself points east, hence the -90.
export const getDirectionArrowIcon = (bearing: number, color: string) => {
  return new L.DivIcon({
    className: 'clear-custom-icon',
    html: `<div style="transform: rotate(${bearing - 90}deg); transform-origin: center center; font-size: 16px; line-height: 16px; color:${color}; text-shadow: 0 0 3px #000, 0 0 3px #000;">&#10148;</div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
};

export const getRotatedDroneIcon = (angle: number) => {
  return new L.DivIcon({
    className: 'clear-custom-icon',
    html: `<img src="${droneIconUrl}" style="transform: rotate(${angle}deg); width: 40px; height: 40px; transform-origin: center center;" />`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    tooltipAnchor: [0, -20],
  });
};