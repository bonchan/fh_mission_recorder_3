import { useMessage } from '@/hooks/useMessage';
import { useToast } from '@/providers/ToastProvider';
import { uploadToCloudStorage } from '@/services/cloudStorage';
import { Mission } from '@/utils/interfaces';
import { createLogger } from '@/utils/logger';
import { delay } from '@/utils/time';
import { generateDJIMission } from '@/utils/wpml-generator';
import { RouteBuilder } from 'dji-kmz-parser';
import { useState } from 'react';


const log = createLogger('useMissionActions');

export function useMissionActions(orgId: string, projectId: string) {
  const { showToast } = useToast();
  const { getStorageUploadCredentials, duplicateNameStorageCheck, importCallbackStorage } = useMessage(orgId, projectId);
  const [isUploading, setIsUploading] = useState(false);

  const debugMission = async (mission: Mission, setDebugXml: any) => {
    const { template, waylines } = await generateDJIMissionFiles(mission);
    setDebugXml({ template, waylines });
  };

  const exportMission = async (mission: Mission) => {
    if (mission.waypoints.length === 0) return showToast('Mission has no waypoints!', '', { type: "warning" })
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
    if (mission.waypoints.length === 0) return showToast('Mission has no waypoints!', '', { type: "warning" })
    if (!mission.orgId || !mission.projectId) return showToast('Mission has no orgId or projectId!', '', { type: "warning" })

    const toastTTL = 3000;
    try {
      setIsUploading(true);
      showToast('Getting storage credentials', '', { type: "info", swarm: true, duration: toastTTL })
      const stsResponse = await getStorageUploadCredentials();
      const { object_key_prefix } = stsResponse.credentials.data;

      showToast('Generating mission file', '', { type: "info", swarm: true, duration: toastTTL })
      const blob = await generateDJIMission(mission);
      const cleanName = mission.name.replace(/[<>:"/|?*._\\]/g, '');
      const fileUUID = crypto.randomUUID();
      const tempFileName = `${fileUUID}.kmz`;
      const file = new File([blob], tempFileName, { type: 'application/zip' });

      const objectKey = `${object_key_prefix}/${tempFileName}`;
      showToast('Uploading mission to FH', '', { type: "info", swarm: true, duration: toastTTL })
      await uploadToCloudStorage(file, objectKey, stsResponse.credentials.data);
      await delay(500);

      let desiredFileName = `P3--${cleanName}.kmz`;
      showToast('Checking file name', desiredFileName, { type: "info", swarm: true, duration: toastTTL })
      const nscResponse = await duplicateNameStorageCheck(desiredFileName);
      desiredFileName = nscResponse.dnResponse.data.index_name;
      showToast('Final file name', desiredFileName, { type: "warning", swarm: true, duration: toastTTL })

      const icResponse = await importCallbackStorage(desiredFileName, objectKey);
      const finalFileName = icResponse.icResponse.data.name;
      showToast('Mission uploaded to FlightHub', finalFileName, { type: "success", swarm: true, duration: toastTTL })
    } catch (err) {
      log.error("Failed to upload mission sequence:", err);
      showToast('Failed to upload mission sequence:', String(err), { type: "error", permanent: true })
    } finally {
      setIsUploading(false);
    }
  };

  const uploadFlightRoute = async (route: FlightRoute) => {
    if (route.data?.modifiedData) {
      const toastTTL = 3000;
      try {
        setIsUploading(true);
        showToast('Generating mission file', '', { type: "info", swarm: true, duration: toastTTL })
        const date = new Date();
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const fileName = `NO VOLAR ${route.name} ${yyyy}-${mm}-${dd}`;
        
        const cleanName = fileName.replace(/[<>:"/|?*._\\]/g, '');
        const fileUUID = crypto.randomUUID();
        const tempFileName = `${fileUUID}.kmz`;
        
        const builder = new RouteBuilder();
        const newKmzBinary = await builder.buildKmz(route.data.modifiedData);
        const file = new File([newKmzBinary.buffer as ArrayBuffer], tempFileName, { type: 'application/zip' });

        showToast('Getting storage credentials', '', { type: "info", swarm: true, duration: toastTTL })
        const stsResponse = await getStorageUploadCredentials();
        const { object_key_prefix } = stsResponse.credentials.data;

        const objectKey = `${object_key_prefix}/${tempFileName}`;
        showToast('Uploading mission to FH', '', { type: "info", swarm: true, duration: toastTTL })
        await uploadToCloudStorage(file, objectKey, stsResponse.credentials.data);
        await delay(500);

        let desiredFileName = `P3--${cleanName}.kmz`;
        showToast('Checking file name', desiredFileName, { type: "info", swarm: true, duration: toastTTL })
        const nscResponse = await duplicateNameStorageCheck(desiredFileName);
        desiredFileName = nscResponse.dnResponse.data.index_name;
        showToast('Final file name', desiredFileName, { type: "warning", swarm: true, duration: toastTTL })

        const icResponse = await importCallbackStorage(desiredFileName, objectKey);
        const finalFileName = icResponse.icResponse.data.name;
        showToast('Mission uploaded to FlightHub', finalFileName, { type: "success", swarm: true, duration: toastTTL })
      } catch (err) {
        log.error("Failed to upload mission sequence:", err);
        showToast('Failed to upload mission sequence:', String(err), { type: "error", swarm: true, duration: toastTTL })
      } finally {
        setIsUploading(false);
      }
    }
  };

  return {
    debugMission,
    exportMission,
    uploadMission,
    uploadFlightRoute,
    isUploading
  };
}