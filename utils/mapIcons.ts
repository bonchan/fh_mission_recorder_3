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

export const getRotatedDroneIcon = (angle: number) => {
  return new L.DivIcon({
    className: 'clear-custom-icon',
    html: `<img src="${droneIconUrl}" style="transform: rotate(${angle}deg); width: 40px; height: 40px; transform-origin: center center;" />`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    tooltipAnchor: [0, -20],
  });
};