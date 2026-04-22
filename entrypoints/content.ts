import { fhApi } from '@/services/fhApi';
import { simulateClick } from '@/utils/utils';

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

      if (action === "DISPATCH_KEY") {
        handleDispatchKey(message.keyType, message.keyName, message.keyCode, message.codeString);
        return true;
      }

      if (action === "ZOOM_STEP") {
        handleZoomStep(message.direction);
        return true;
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

    async function handleDispatchKey(type: 'keydown' | 'keyup' | 'tap', keyName: string, keyCode: number, codeString: string) {
      const fireEvent = (eventType: 'keydown' | 'keyup') => {
        const eventObj = new KeyboardEvent(eventType, {
          key: keyName,
          code: codeString,
          keyCode: keyCode,
          which: keyCode,
          bubbles: true,
          cancelable: true,
          composed: true,
        });

        document.dispatchEvent(eventObj);
        if (document.activeElement) {
          document.activeElement.dispatchEvent(
            new KeyboardEvent(eventType, { key: keyName, code: codeString, keyCode, which: keyCode, bubbles: true, cancelable: true, composed: true })
          );
        }
      };
      // Handle the logic based on the requested type
      if (type === 'keydown' || type === 'keyup') {
        fireEvent(type);
      } else if (type === 'tap') {
        // 1. Press the key down
        fireEvent('keydown');
        // 2. Wait 50 milliseconds, then release it
        setTimeout(() => {
          fireEvent('keyup');
        }, 50);
      }
    }

    function handleZoomStep(direction: 'in' | 'out') {
      // 1. Find the current indicator
      const currentIndicator = document.querySelector('.current-scale') as HTMLElement;
      if (!currentIndicator) return;

      // 2. Extract its current bottom percentage (e.g., "calc(40% - 8px)" -> 40)
      const match = currentIndicator.style.bottom.match(/(\d+)%/);
      if (!match) return;
      const currentPercent = parseInt(match[1], 10);

      // 3. Get all zoom points and their percentages
      const containers = Array.from(document.querySelectorAll('.point-container')) as HTMLElement[];
      const points = containers.map(el => {
        const pMatch = el.style.bottom.match(/(\d+)%/);
        return { el, percent: pMatch ? parseInt(pMatch[1], 10) : -1 };
      }).filter(p => p.percent !== -1).sort((a, b) => a.percent - b.percent);

      // 4. Find which point we are currently closest to
      let currentIndex = 0;
      let minDiff = Infinity;
      points.forEach((p, i) => {
        const diff = Math.abs(p.percent - currentPercent);
        if (diff < minDiff) {
          minDiff = diff;
          currentIndex = i;
        }
      });

      // 5. Determine the target index (in = up the slider, out = down the slider)
      let targetIndex = direction === 'in' ? currentIndex + 1 : currentIndex - 1;

      // 6. Keep it within bounds
      if (targetIndex < 0) targetIndex = 0;
      if (targetIndex >= points.length) targetIndex = points.length - 1;

      // 7. Click the new point!
      if (targetIndex !== currentIndex) {
        simulateClick(points[targetIndex].el);
      }
    }

  },
});
