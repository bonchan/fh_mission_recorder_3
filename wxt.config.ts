import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    permissions: ['sidePanel', 'storage', 'tabs', 'activeTab', 'debugger'],
    host_permissions: [
      'https://fh.dji.com/*',
      '*://*.google.com/*'
    ],
    action: {},
  },
});
