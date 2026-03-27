import { useState } from 'react';
import { Mission } from '@/utils/interfaces';
import { useToast } from '@/providers/ToastProvider';
import { useExtensionData } from '@/providers/ExtensionDataProvider';
import { generateDJIMission } from '@/utils/wpml-generator';
import { uploadToCloudStorage } from '@/services/cloudStorage';
import { delay } from '@/utils/time';
import { createLogger } from '@/utils/logger';

const log = createLogger('useMissionActions');

export function useMissionActions() {
  // Pull in the necessary contexts internally!
  const { showToast } = useToast();
  const { getStorageUploadCredentials, duplicateNameStorageCheck, importCallbackStorage } = useExtensionData();

  // Manage the uploading state locally within the hook
  const [isUploading, setIsUploading] = useState(false);

  const debugMission = async (mission: Mission, setDebugXml: any) => {
    const { template, waylines } = await generateDJIMissionFiles(mission);
    setDebugXml({ template, waylines });
  };

  const exportMission = async (mission: Mission) => {
    if (mission.waypoints.length === 0) return showToast('Mission has no waypoints!', '', 'warning');
    const blob = await generateDJIMission(mission);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cleanName = mission.name.replace(/[<>:"/|?*._\\]/g, '');
    a.download = `P3--${cleanName}.kmz`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const uploadMission = async (mission: Mission) => {
    if (mission.waypoints.length === 0) return showToast('Mission has no waypoints!', '', 'warning');
    if (!mission.orgId || !mission.projectId) return showToast('Mission has no orgId or projectId!', '', 'warning');

    const toastTTL = 3000;
    try {
      setIsUploading(true);
      showToast('Getting storage credentials', '', 'info', toastTTL, true);
      const stsResponse = await getStorageUploadCredentials(mission.orgId, mission.projectId);
      const { object_key_prefix } = stsResponse.credentials.data;

      showToast('Generating mission file', '', 'info', toastTTL, true);
      const blob = await generateDJIMission(mission);
      const cleanName = mission.name.replace(/[<>:"/|?*._\\]/g, '');
      const fileUUID = crypto.randomUUID();
      const tempFileName = `${fileUUID}.kmz`;
      const file = new File([blob], tempFileName, { type: 'application/zip' });

      const objectKey = `${object_key_prefix}/${tempFileName}`;
      showToast('Uploading mission to FH', '', 'info', toastTTL, true);
      await uploadToCloudStorage(file, objectKey, stsResponse.credentials.data);
      await delay(500);

      let desiredFileName = `P3--${cleanName}.kmz`;
      showToast('Checking file name', desiredFileName, 'info', toastTTL, true);
      const nscResponse = await duplicateNameStorageCheck(mission.orgId, mission.projectId, desiredFileName);
      desiredFileName = nscResponse.dnResponse.data.index_name;
      showToast('Final file name', desiredFileName, 'warning', toastTTL, true);

      const icResponse = await importCallbackStorage(mission.orgId, mission.projectId, desiredFileName, objectKey);
      const finalFileName = icResponse.icResponse.data.name;
      showToast('Mission uploaded to FlightHub', finalFileName, 'success', toastTTL, true);
    } catch (err) {
      log.error("Failed to upload mission sequence:", err);
      showToast('Failed to upload mission sequence:', String(err), 'error', toastTTL, true);
    } finally {
      setIsUploading(false);
    }
  };



  // Return the functions and the loading state
  return {
    debugMission,
    exportMission,
    uploadMission,
    isUploading
  };
}