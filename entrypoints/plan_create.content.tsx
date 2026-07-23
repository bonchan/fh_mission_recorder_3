// entrypoints/plan_create.content.tsx
import { DJI_PLAN_CREATE_URL_REGEX } from '@/utils/constants';
import { createLogger } from '@/utils/logger';
import { createRoot, type Root as ReactRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';

const log = createLogger('plan_create.content');

const SELECT_DEVICE_LABEL = 'Select Device';

// The "Select Device" uranus-form-item is identified by its label text -
// this stays stable whether a device is selected or not (unselected: label
// div + button both sit inside .uranus-form-label-left; selected: button
// moves out to be a sibling), so matching on the label prefix covers both.
function findFormItem(labelText: string): HTMLElement | null {
  const items = Array.from(document.querySelectorAll<HTMLElement>('.uranus-form-item'));
  return items.find(item => {
    const label = item.querySelector('.uranus-form-label-left');
    return label?.textContent?.trim().startsWith(labelText);
  }) ?? null;
}

// The device card is rendered into the .uranus-form-content that is a DIRECT
// child of .uranus-form-item (a sibling of .uranus-form-label). There's also
// a nested .uranus-form-content wrapping the "+" button in the unselected
// state, so :scope is required to avoid grabbing that one instead.
function getDeviceContentArea(formItem: HTMLElement): HTMLElement | null {
  return formItem.querySelector<HTMLElement>(':scope > .uranus-form-content');
}

function readSelectedDeviceName(formItem: HTMLElement): string | null {
  const contentArea = getDeviceContentArea(formItem);
  const titleEl = contentArea?.querySelector('.uranus-tsa-device-base-wrapper-title');
  const nameSpan = titleEl?.querySelectorAll('span')[1]; // 2nd span = "#23 - CT1"
  const text = nameSpan?.textContent?.trim();
  return text || null;
}

function PlanCreatePopup() {
  const [deviceName, setDeviceName] = useState<string | null>(null);

  useEffect(() => {
    let formObserver: MutationObserver | null = null;
    let bodyObserver: MutationObserver | null = null;

    const watch = (formItem: HTMLElement) => {
      setDeviceName(readSelectedDeviceName(formItem));

      formObserver = new MutationObserver(() => {
        setDeviceName(readSelectedDeviceName(formItem));
      });
      formObserver.observe(formItem, { childList: true, subtree: true, characterData: true });
    };

    const existing = findFormItem(SELECT_DEVICE_LABEL);
    if (existing) {
      watch(existing);
    } else {
      // Form item isn't in the DOM yet (page still rendering) - wait for it.
      bodyObserver = new MutationObserver(() => {
        const formItem = findFormItem(SELECT_DEVICE_LABEL);
        if (formItem) {
          bodyObserver?.disconnect();
          watch(formItem);
        }
      });
      bodyObserver.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      formObserver?.disconnect();
      bodyObserver?.disconnect();
    };
  }, []);

  if (!deviceName) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 16,
      right: 16,
      zIndex: 999999,
      background: '#111',
      color: '#fff',
      padding: '10px 14px',
      borderRadius: 8,
      border: '1px solid #333',
      fontSize: 13,
      fontFamily: 'system-ui, sans-serif',
    }}>
      Selected device: <strong>{deviceName}</strong>
    </div>
  );
}

export default defineContentScript({
  matches: ['https://fh.dji.com/organization/*/project/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    let ui: Awaited<ReturnType<typeof createShadowRootUi<ReactRoot>>> | null = null;

    const start = async () => {
      if (!DJI_PLAN_CREATE_URL_REGEX.test(location.href) || ui) return;
      log.info('on plan-create, mounting popup');

      ui = await createShadowRootUi(ctx, {
        name: 'plan-create-popup',
        position: 'overlay',
        anchor: 'body',
        onMount: (container) => {
          const root = createRoot(container);
          root.render(<PlanCreatePopup />);
          return root;
        },
        onRemove: (root) => root?.unmount(),
      });
      ui.mount();
    };

    const stop = () => {
      ui?.remove();
      ui = null;
    };

    await start();
    ctx.addEventListener(window, 'wxt:locationchange', () => {
      DJI_PLAN_CREATE_URL_REGEX.test(location.href) ? start() : stop();
    });
  },
});
