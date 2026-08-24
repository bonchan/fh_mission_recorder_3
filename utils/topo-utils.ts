// Decoders for the DJI Dock (gateway) "thing model" enum_int properties, as
// documented for the M3TD and M4TD device property lists. Both docs describe
// the same dock property schema - wording differs slightly between them but
// the codes match, EXCEPT home_position_is_valid, where M4TD adds two extra
// codes on top of M3TD's 0/1. The M4TD (superset) version is used below.

function enumLabel(map: Record<number, string>, code: number | undefined | null, fallback = 'Unknown'): string {
  if (code === undefined || code === null) return fallback;
  return map[code] ?? `${fallback} (${code})`;
}

// --- Home point / RTK source ---

export const getHomePositionValidityLabel = (code?: number) => enumLabel({
  0: 'Both invalid',
  1: 'Both valid',
  2: 'Heading valid, position invalid',
  3: 'Position valid, heading invalid',
}, code);

export const getRtkSourceTypeLabel = (code?: number) => enumLabel({
  0: 'Not calibrated',
  1: 'Self/auto-convergence calibration',
  2: 'Manual calibration',
  3: 'Network RTK calibration',
}, code);

// --- Air conditioner ---

export const getAcStateLabel = (code?: number) => enumLabel({
  0: 'Idle (no cooling, heating, or dehumidification)',
  1: 'Cooling mode',
  2: 'Heating mode',
  3: 'Dehumidification mode',
  4: 'Cooling exit mode',
  5: 'Heating exit mode',
  6: 'Dehumidification exit mode',
  7: 'Cooling ready mode',
  8: 'Heating ready mode',
  9: 'Dehumidification ready mode',
  10: 'Preparing for air cooling',
  11: 'Air cooling in progress',
  12: 'Air cooling exiting',
  13: 'Preparing for defogger',
  14: 'Defogger in progress',
  15: 'Defogger exiting',
}, code);

// --- Dock-level modes / status codes ---

export const getSilentModeLabel = (code?: number) => enumLabel({
  0: 'Non-silent mode',
  1: 'Silent mode',
}, code);

export const getUserExperienceImprovementLabel = (code?: number) => enumLabel({
  0: 'Initial state',
  1: 'Refused',
  2: 'Agreed',
}, code);

export const getBatteryStoreModeLabel = (code?: number) => enumLabel({
  1: 'Schedule mode (55-60%)',
  2: 'Standby mode (90-95%)',
}, code);

export const getCompatibleStatusLabel = (code?: number) => enumLabel({
  0: 'No update required',
  1: 'Consistency update required',
}, code);

export const getModeCodeLabel = (code?: number) => enumLabel({
  0: 'Idle',
  1: 'On-site debugging',
  2: 'Remote debugging',
  3: 'Firmware upgrade in progress',
  4: 'In operation',
  5: 'To be calibrated',
}, code);

export const getFlightTaskStepCodeLabel = (code?: number) => enumLabel({
  0: 'Operation preparation',
  1: 'In-flight operation',
  2: 'Post-operation state recovery',
  3: 'Custom flight area updating',
  4: 'Terrain obstacle updating',
  5: 'Mission idle',
  255: 'Aircraft error',
  256: 'Unknown state',
}, code);

export const getFirmwareUpgradeStatusLabel = (code?: number) => enumLabel({
  0: 'Idle (not upgrading)',
  1: 'Upgrading',
}, code);

export const getDrcStateLabel = (code?: number) => enumLabel({
  0: 'Not connected',
  1: 'Connecting',
  2: 'Connected',
}, code);

// --- Dock hardware state ---

export const getCoverStateLabel = (code?: number) => enumLabel({
  0: 'Closed',
  1: 'Open',
  2: 'Half open',
  3: 'Abnormal',
}, code);

export const getAlarmStateLabel = (code?: number) => enumLabel({
  0: 'Disabled',
  1: 'Enabled',
}, code);

export const getEmergencyStopStateLabel = (code?: number) => enumLabel({
  0: 'Released',
  1: 'Pressed',
}, code);

export const getSupplementLightStateLabel = (code?: number) => enumLabel({
  0: 'Disabled',
  1: 'On',
}, code);

export const getRainfallLabel = (code?: number) => enumLabel({
  0: 'No rain',
  1: 'Light rain',
  2: 'Moderate rain',
  3: 'Heavy rain',
}, code);

export const getDroneInDockLabel = (code?: number) => enumLabel({
  0: 'Outside the dock',
  1: 'Inside the dock',
}, code);

// --- Batteries / charging ---

export const getBatteryIndexLabel = (index?: number) => enumLabel({
  0: 'Left battery',
  1: 'Right battery',
}, index);

export const getBatteryMaintenanceStateLabel = (code?: number) => enumLabel({
  0: 'No maintenance required',
  1: 'Waiting for maintenance',
  2: 'In maintenance',
}, code);

export const getBatteryHeatStateLabel = (code?: number) => enumLabel({
  0: 'Not heating/preserving',
  1: 'Heating',
  2: 'Heat preservation',
}, code);

export const getChargeStateLabel = (code?: number) => enumLabel({
  0: 'Idle',
  1: 'Charging',
}, code);

export const getBackupBatterySwitchLabel = (code?: number) => enumLabel({
  0: 'Disabled',
  1: 'Enabled',
}, code);

// --- Maintenance history ---

export const getMaintainStateLabel = (code?: number) => enumLabel({
  0: 'No maintenance',
  1: 'Maintained',
}, code);

export const getLastMaintainTypeLabel = (code?: number) => enumLabel({
  0: 'No maintenance',
  17: 'Standard dock maintenance',
  18: 'Deep dock maintenance',
}, code);

// --- Position / RTK state ---

export const getCalibrationStateLabel = (code?: number) => enumLabel({
  0: 'Not calibrated',
  1: 'Calibrated',
}, code);

export const getFixStateLabel = (code?: number) => enumLabel({
  0: 'Not started',
  1: 'Fixing',
  2: 'Fixing successful',
  3: 'Fixing failed',
}, code);

export const getSignalQualityLabel = (code?: number) => enumLabel({
  1: 'Level 1',
  2: 'Level 2',
  3: 'Level 3',
  4: 'Level 4',
  5: 'Level 5',
  10: 'RTK fixed',
}, code);

// --- Network / video transmission link ---

export const getNetworkTypeLabel = (code?: number) => enumLabel({
  1: '4G',
  2: 'Ethernet',
}, code);

export const getNetworkQualityLabel = (code?: number) => enumLabel({
  0: 'No signal',
  1: 'Very poor',
  2: 'Poor',
  3: 'Fair',
  4: 'Good',
  5: 'Excellent',
}, code);

export const getLinkStateLabel = (code?: number) => enumLabel({
  0: 'Disconnected',
  1: 'Connected',
}, code);

export const getLinkWorkModeLabel = (code?: number) => enumLabel({
  0: 'SDR mode',
  1: '4G fusion mode',
}, code);

// --- 4G dongle / SIM ---

export const getDongleTypeLabel = (code?: number) => enumLabel({
  6: 'Old dongle',
  10: 'New dongle (eSIM support)',
}, code);

export const getEsimActivateStateLabel = (code?: number) => enumLabel({
  0: 'Unknown',
  1: 'Not activated',
  2: 'Activated',
}, code);

export const getSimCardStateLabel = (code?: number) => enumLabel({
  0: 'Not inserted',
  1: 'Inserted',
}, code);

export const getSimSlotLabel = (code?: number) => enumLabel({
  0: 'Unknown',
  1: 'Physical SIM card',
  2: 'eSIM',
}, code);

export const getSimTypeLabel = (code?: number) => enumLabel({
  0: 'Unknown',
  1: 'Other regular SIM card',
  2: 'Three-network card',
}, code);

export const getTelecomOperatorLabel = (code?: number) => enumLabel({
  0: 'Unknown',
  1: 'China Mobile',
  2: 'China Unicom',
  3: 'China Telecom',
}, code);

// --- Sub-device (paired aircraft, as seen from the dock) ---

export const getSubDeviceOnlineStatusLabel = (code?: number) => enumLabel({
  0: 'Power off',
  1: 'Power on',
}, code);

export const getSubDevicePairedLabel = (code?: number) => enumLabel({
  0: 'Not paired',
  1: 'Paired',
}, code);

// --- Live streaming ---

export const getLiveStreamQualityLabel = (code?: number) => enumLabel({
  0: 'Adaptive',
  1: 'Smooth',
  2: 'Standard definition',
  3: 'High definition',
  4: 'Ultra-high definition',
}, code);

export const getLiveStreamStatusLabel = (code?: number) => enumLabel({
  0: 'Not live streaming',
  1: 'Live streaming',
}, code);

// --- Misc ---

export const getIsConfiguredLabel = (code?: number) => enumLabel({
  0: 'Not set',
  1: 'Already set',
}, code);

// Single namespace object - `import { topoUtils } from '@/utils/topo-utils'`
// then call `topoUtils.getCoverStateLabel(...)` etc. without importing each
// converter individually.
export const topoUtils = {
  getHomePositionValidityLabel,
  getRtkSourceTypeLabel,

  getAcStateLabel,

  getSilentModeLabel,
  getUserExperienceImprovementLabel,
  getBatteryStoreModeLabel,
  getCompatibleStatusLabel,
  getModeCodeLabel,
  getFlightTaskStepCodeLabel,
  getFirmwareUpgradeStatusLabel,
  getDrcStateLabel,

  getCoverStateLabel,
  getAlarmStateLabel,
  getEmergencyStopStateLabel,
  getSupplementLightStateLabel,
  getRainfallLabel,
  getDroneInDockLabel,

  getBatteryIndexLabel,
  getBatteryMaintenanceStateLabel,
  getBatteryHeatStateLabel,
  getChargeStateLabel,
  getBackupBatterySwitchLabel,

  getMaintainStateLabel,
  getLastMaintainTypeLabel,

  getCalibrationStateLabel,
  getFixStateLabel,
  getSignalQualityLabel,

  getNetworkTypeLabel,
  getNetworkQualityLabel,
  getLinkStateLabel,
  getLinkWorkModeLabel,

  getDongleTypeLabel,
  getEsimActivateStateLabel,
  getSimCardStateLabel,
  getSimSlotLabel,
  getSimTypeLabel,
  getTelecomOperatorLabel,

  getSubDeviceOnlineStatusLabel,
  getSubDevicePairedLabel,

  getLiveStreamQualityLabel,
  getLiveStreamStatusLabel,

  getIsConfiguredLabel,
};
