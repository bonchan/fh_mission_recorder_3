import { fhApi } from '@/services/fhApi';

export default defineContentScript({
  matches: ['https://fh.dji.com/*'],
  async main() {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {

      const { action, orgId, projectId } = message;

      if (action === "GET_TOPOLOGIES") {
        handleGetTopologies(sendResponse, orgId, projectId);
        return true
      }

      if (action === "GET_CURRENT_USER") {
        handleGetCurrentUser(sendResponse, orgId, projectId);
        return true
      }

      if (action === "GET_ANNOTATIONS") {
        handleGetAnnotations(sendResponse, orgId, projectId);
        return true
      }

      if (action === "GET_STORAGE_UPLOAD_CREDENTIALS") {
        handleGetStorageUploadCredentials(sendResponse, orgId, projectId);
        return true
      }

      if (action === "DUPLICATE_NAME_STORAGE_CHECK") {
        handleDuplicateNameStorageUpload(sendResponse, orgId, projectId, message.duplicateName);
        return true
      }

      if (action === "IMPORT_CALLBACK_STORAGE") {
        handleImportCallbackStorageUpload(sendResponse, orgId, projectId, message.fileName, message.objectKey);
        return true
      }
    });

    async function handleGetTopologies(sendResponse: any, orgId: string, projectId: string) {
      if (!projectId) return sendResponse({ error: "Missing projectId" });
      const topologies = await fhApi.getTopologies(projectId);
      sendResponse({ topologies, orgId, projectId });
    }

    async function handleGetCurrentUser(sendResponse: any, orgId: string, projectId: string) {
      if (!orgId) return sendResponse({ error: "Missing orgId" });
      const currentUser = await fhApi.getCurrentUser(orgId);
      sendResponse({ currentUser, orgId, projectId });
    }

    async function handleGetAnnotations(sendResponse: any, orgId: string, projectId: string) {
      if (!projectId) return sendResponse({ error: "Missing projectId" });
      const annotations = await fhApi.getAnnotations(projectId);
      sendResponse({ annotations, orgId, projectId });
    }

    async function handleGetStorageUploadCredentials(sendResponse: any, orgId: string, projectId: string) {
      if (!projectId) return sendResponse({ error: "Missing projectId" });
      const credentials = await fhApi.getStorageUploadCredentials(projectId);
      sendResponse({ credentials, orgId, projectId });
    }

    async function handleDuplicateNameStorageUpload(sendResponse: any, orgId: string, projectId: string, duplicateName: string) {
      if (!projectId) return sendResponse({ error: "Missing projectId" });
      const dnResponse = await fhApi.duplicateNameStorageUpload(projectId, duplicateName);
      sendResponse({ dnResponse, orgId, projectId });
    }

    async function handleImportCallbackStorageUpload(sendResponse: any, orgId: string, projectId: string, fileName: string, objectKey: string) {
      if (!projectId) return sendResponse({ error: "Missing projectId" });
      const icResponse = await fhApi.importCallbackStorageUpload(projectId, fileName, objectKey);
      sendResponse({ icResponse, orgId, projectId });
    }

  },
});
