import { DJI_COCKPIT_REGEX } from '@/utils/constants';
import { Still } from '@/utils/interfaces';
import { createLogger } from '@/utils/logger';

const log = createLogger('cockpit.content');

export default defineContentScript({
  matches: ['https://fh.dji.com/*'],
  async main() {

    const url = window.location.href;
    const match = url.match(DJI_COCKPIT_REGEX);

    if (!match) return

    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'CAPTURE_STILL') {
        const { deviceSn, orgId, projectId } = message;
        log.debug('CAPTURE_STILL message received', message);
        captureStill(projectId, deviceSn).then(still => {
          log.debug('CAPTURE_STILL replying with', still ? still.id : null);
          sendResponse({ still });
        });
        return true;
      }
    });

  }
});

function findLiveCanvas(deviceSn: string): HTMLCanvasElement | null {
  const canvasId = `live-canvas-player-${deviceSn}-DronePayload`;
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;

  if (!canvas) {
    log.info(`findLiveCanvas: no element with id "${canvasId}"`);
    return null;
  }

  log.info(`findLiveCanvas: found "${canvas.id}" (${canvas.width}x${canvas.height})`);
  return canvas;
}

function isCanvasStreaming(canvas: HTMLCanvasElement): boolean {
  return canvas.offsetParent !== null;
}

function getOfflineTip(canvas: HTMLCanvasElement): string | null {
  const wrapper = canvas.closest('.cockpit-drone-live-inner-wrapper');
  const tip = wrapper?.querySelector('.empty-live-tip')?.textContent?.trim();
  return tip || null;
}

function findLiveVideo(canvas: HTMLCanvasElement): HTMLVideoElement | null {
  const wrapper = canvas.closest('.live-canvas-player');
  return wrapper?.querySelector('video') ?? null;
}

async function captureStill(projectId: string, deviceSn: string): Promise<Still | null> {
  log.info('captureStill: starting', { deviceSn });
  const canvas = findLiveCanvas(deviceSn);
  if (!canvas) {
    log.error('captureStill: no live canvas found (expected a canvas.live-canvas element on the page)');
    return null;
  }

  if (!isCanvasStreaming(canvas)) {
    const offlineTip = getOfflineTip(canvas);
    log.error(`captureStill: live canvas is hidden, stream appears offline${offlineTip ? ` ("${offlineTip}")` : ''} - refusing to capture a blank image`);
    return null;
  }

  const video = findLiveVideo(canvas);
  if (!video) {
    log.error('captureStill: no <video> element found alongside the live canvas');
    return null;
  }

  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
    log.error(`captureStill: video has no frame data yet (readyState=${video.readyState}, ${video.videoWidth}x${video.videoHeight})`);
    return null;
  }

  const offscreen = document.createElement('canvas');
  offscreen.width = video.videoWidth;
  offscreen.height = video.videoHeight;
  const ctx = offscreen.getContext('2d');
  if (!ctx) {
    log.error('captureStill: could not get a 2d context for the offscreen canvas');
    return null;
  }
  ctx.drawImage(video, 0, 0, offscreen.width, offscreen.height);

  let dataUrl: string;
  try {
    dataUrl = offscreen.toDataURL('image/png');
  } catch (error) {
    log.error('captureStill: failed to read video frame pixels (it may be tainted by a cross-origin source)', error);
    return null;
  }
  log.info(`captureStill: got dataUrl (${Math.round(dataUrl.length / 1024)} KB) from video "${video.id}" (${offscreen.width}x${offscreen.height})`);

  const still: Still = {
    id: crypto.randomUUID(),
    projectId,
    deviceSn,
    canvasId: canvas.id,
    capturedAt: Date.now(),
    dataUrl,
  };

  return still;
}