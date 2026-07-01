import { useMessage } from '@/hooks/useMessage';
import { useToast } from '@/providers/ToastProvider';
import { uploadToCloudStorage } from '@/services/cloudStorage';
import { Mission } from '@/utils/interfaces';
import { createLogger } from '@/utils/logger';
import { delay } from '@/utils/time';
import { sanitizeRouteName } from '@/utils/utils';
import { generateDJIMission } from '@/utils/wpml-generator';
import { RouteBuilder, type DjiKmlRoot } from 'dji-kmz-parser';
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
    const cleanName = sanitizeRouteName(mission.name)
    a.download = `${cleanName}.kmz`;
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
      const cleanName = sanitizeRouteName(mission.name)
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

        const cleanName = sanitizeRouteName(fileName)
        const fileUUID = crypto.randomUUID();
        const tempFileName = `${fileUUID}.kmz`;

        sanitizeSpotCheckData(route.data.modifiedData.template);
        sanitizeSpotCheckData(route.data.modifiedData.waylines);

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


  /**
   * Scrubs AI Spot-Check photo references from the flight plan.
   * If these are left in but the `res` folder is missing, FlightHub will reject the upload.
   */
  function sanitizeSpotCheckData(data: DjiKmlRoot): void {
    // Helper to ensure we can iterate safely
    const ensureArray = (item: any) => Array.isArray(item) ? item : (item ? [item] : []);

    // AI Spot-Check actions only exist in the template file
    const folders = ensureArray(data.kml.Document.Folder);

    folders.forEach((folder: any) => {
      const placemarks = ensureArray(folder.Placemark);

      placemarks.forEach((placemark: any) => {
        const actionGroups = ensureArray(placemark['wpml:actionGroup']);

        actionGroups.forEach((actionGroup: any) => {
          const actions = ensureArray(actionGroup['wpml:action']);

          actions.forEach((action: any) => {
            // Only target the orientedShoot actions
            if (action['wpml:actionActuatorFunc'] === 'orientedShoot') {
              const params = action['wpml:actionActuatorFuncParam'];
              if (params) {
                // 1. Delete the problematic file references
                delete params['wpml:orientedCameraType'];
                delete params['wpml:orientedFilePath'];
                delete params['wpml:orientedFileMD5'];
                delete params['wpml:orientedFileSize'];
                delete params['wpml:orientedFileSuffix'];

                delete params['wpml:orientedCameraApertue'];
                delete params['wpml:orientedCameraLuminance'];
                delete params['wpml:orientedCameraShutterTime'];

                // 2. AGGRESSIVELY OVERWRITE AI TARGETING DATA
                params['wpml:accurateFrameValid'] = 0;
                params['wpml:focusX'] = 0;
                params['wpml:focusY'] = 0;
                params['wpml:focusRegionWidth'] = 0;
                params['wpml:focusRegionHeight'] = 0;
                params['wpml:imageWidth'] = 0;
                params['wpml:imageHeight'] = 0;
                params['wpml:targetAngle'] = 0;
                params['wpml:AFPos'] = 0;

                // 3. Generate a brand new UUID
                // This permanently breaks the link between this action and FlightHub's old image records
                params['wpml:actionUUID'] = crypto.randomUUID();

                // Note: We leave pitch, yaw, aircraftHeading, focalLength, 
                // and payloadLensIndex untouched so the drone still takes the shot properly!
              }
            }
          });
        });
      });
    });
  }


  return {
    debugMission,
    exportMission,
    uploadMission,
    uploadFlightRoute,
    isUploading
  };
}