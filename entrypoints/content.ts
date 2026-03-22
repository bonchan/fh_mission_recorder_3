import { fhApi } from '@/utils/api';

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
    });

    async function handleGetTopologies(sendResponse: any, orgId: string, projectId: string) {
      if (!projectId) return sendResponse({ error: "Missing projectId" });
      // The fhApi call happens here because it has access to the page's localStorage
      const topologies = await fhApi.getTopologies(projectId);
      sendResponse({ topologies, orgId, projectId });
    }

    async function handleGetCurrentUser(sendResponse: any, orgId: string, projectId: string) {
      if (!orgId) return sendResponse({ error: "Missing orgId" });
      // The fhApi call happens here because it has access to the page's localStorage
      const currentUser = await fhApi.getCurrentUser(orgId);
      sendResponse({ currentUser, orgId, projectId });
    }

    async function handleGetAnnotations(sendResponse: any, orgId: string, projectId: string) {
      if (!projectId) return sendResponse({ error: "Missing projectId" });
      // The fhApi call happens here because it has access to the page's localStorage
      const annotations = await fhApi.getAnnotations(projectId);
      sendResponse({ annotations, orgId, projectId });
    }

  },
});
