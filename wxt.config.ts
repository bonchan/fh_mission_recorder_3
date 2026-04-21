import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    permissions: ['sidePanel', 'storage', 'tabs', 'activeTab', 'debugger', 'usb'],
    host_permissions: [
      'https://fh.dji.com/*',
      '*://*.djigate.com/*'
    ],
    action: {},
    web_accessible_resources: [
      {
        resources: ['*.wasm', '*.png'],
        matches: ['<all_urls>'],
      },
    ],
  },
  
  // THE FIX: Tell Vite's esbuild to stop mangling the ADB library
  vite: () => ({
    optimizeDeps: {
      exclude: [
        '@yume-chan/adb',
        '@yume-chan/adb-daemon-webusb',
        '@yume-chan/adb-credential-web'
      ]
    }
  })
});