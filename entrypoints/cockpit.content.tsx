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

// FlightHub has shipped two live player layouts: the newer one wraps the <video> in
// #volcano-live-source-{sn}-DronePayload, the older one had a canvas #live-canvas-player-{sn}-DronePayload
// inside a .live-canvas-player wrapper that also held the <video>.
function findLiveSource(deviceSn: string): HTMLElement | null {
  const ids = [
    `volcano-live-source-${deviceSn}-DronePayload`,
    `live-canvas-player-${deviceSn}-DronePayload`,
  ];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) {
      log.info(`findLiveSource: found "${id}"`);
      return el;
    }
  }
  log.info(`findLiveSource: no element with any of ids ${ids.map((id) => `"${id}"`).join(', ')}`);
  return null;
}

function isSourceVisible(source: HTMLElement): boolean {
  return source.offsetParent !== null;
}

function getOfflineTip(source: HTMLElement): string | null {
  const wrapper = source.closest('.cockpit-drone-live-inner-wrapper, .live-pane');
  const tip = wrapper?.querySelector('.empty-live-tip')?.textContent?.trim();
  return tip || null;
}

function findLiveVideo(source: HTMLElement): HTMLVideoElement | null {
  if (source instanceof HTMLVideoElement) return source;
  const wrapper = source.closest('.live-canvas-player') ?? source;
  return wrapper.querySelector('video');
}

async function captureStill(projectId: string, deviceSn: string): Promise<Still | null> {
  log.info('captureStill: starting', { deviceSn });
  const source = findLiveSource(deviceSn);
  if (!source) {
    log.error('captureStill: no live player element found on the page');
    return null;
  }

  if (!isSourceVisible(source)) {
    const offlineTip = getOfflineTip(source);
    log.error(`captureStill: live player is hidden, stream appears offline${offlineTip ? ` ("${offlineTip}")` : ''} - refusing to capture a blank image`);
    return null;
  }

  const video = findLiveVideo(source);
  if (!video) {
    log.error('captureStill: no <video> element found in the live player');
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
    canvasId: source.id,
    capturedAt: Date.now(),
    dataUrl,
  };

  return still;
}