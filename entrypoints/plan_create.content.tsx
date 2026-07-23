// entrypoints/plan_create.content.tsx
import { DJI_PLAN_CREATE_URL_REGEX } from '@/utils/constants';
import { createLogger } from '@/utils/logger';
import { createRoot, type Root } from 'react-dom/client';

const log = createLogger('plan_create.content');

export default defineContentScript({
  matches: ['https://fh.dji.com/organization/*/project/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    let ui: Awaited<ReturnType<typeof createShadowRootUi<Root>>> | null = null;

    const start = async () => {
      if (!DJI_PLAN_CREATE_URL_REGEX.test(location.href) || ui) return;
      log.info('on plan-create, arming watcher');

      ui = await createShadowRootUi(ctx, {
        name: 'plan-create-popup',
        position: 'overlay',
        anchor: () => document.querySelector('.the-panel-that-appears-after-selection'),
        onMount: (container) => {
          const root = createRoot(container);
          root.render(<div>your popup</div>);
          return root;
        },
        onRemove: (root) => root?.unmount(),
      });
      ui.autoMount();
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