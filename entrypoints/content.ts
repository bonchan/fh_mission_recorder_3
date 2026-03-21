import { fhApi } from '@/utils/api';
import { DJI_PROJECT_BASE_REGEX } from '@/utils/constants';

export default defineContentScript({
  matches: ['https://fh.dji.com/*'],
  async main() {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === "GET_TOPOLOGIES") {
        handleGetTopologies(sendResponse);
        return true
      }

      if (message.action === "GET_CURRENT_USER") {
        handleGetCurrentUser(sendResponse);
        return true
      }

      if (message.action === "GET_ANNOTATIONS") {
        handleGetAnnotations(sendResponse);
        return true
      }
    });

    async function handleGetTopologies(sendResponse: any) {
      const match = window.location.href.match(DJI_PROJECT_BASE_REGEX);
      if (!match) {
        throw new Error("Not on a valid DJI Project page");
      }

      const [_, orgId, projectId] = match;

      // The fhApi call happens here because it has access to the page's localStorage
      const topologies = await fhApi.getTopologies(projectId);

      sendResponse({ topologies, orgId, projectId });
    }

    async function handleGetCurrentUser(sendResponse: any) {
      const match = window.location.href.match(DJI_PROJECT_BASE_REGEX);
      if (!match) {
        throw new Error("Not on a valid DJI Project page");
      }

      const [_, orgId, projectId] = match;

      // The fhApi call happens here because it has access to the page's localStorage
      const currentUser = await fhApi.getCurrentUser(orgId);

      sendResponse({ currentUser, orgId, projectId });
    }

    async function handleGetAnnotations(sendResponse: any) {
      const match = window.location.href.match(DJI_PROJECT_BASE_REGEX);
      if (!match) {
        throw new Error("Not on a valid DJI Project page");
      }

      const [_, orgId, projectId] = match;

      // The fhApi call happens here because it has access to the page's localStorage
      const annotations = await fhApi.getAnnotations(projectId);

      sendResponse({ annotations, orgId, projectId });
    }


  },
});
