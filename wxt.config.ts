import { defineConfig } from 'wxt';

const fixYumeChanTdzBug = () => ({
  name: 'fix-yume-chan-tdz',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    // Only target the broken files inside the yume-chan library
    if (id.includes('@yume-chan') && code.includes('extends ReadableStream')) {
      
      // Create a safe, anonymous middleman class that defers the start() execution
      const safeClass = `(class extends globalThis.ReadableStream {
        constructor(source = {}, strategy = {}) {
          if (source && typeof source.start === 'function') {
            const origStart = source.start;
            source.start = (c) => Promise.resolve().then(() => origStart(c));
          }
          super(source, strategy);
        }
      })`;
      
      // Inject the middleman directly into the library's inheritance chain
      const fixedCode = code.replace(/extends\s+ReadableStream/g, `extends ${safeClass}`);
      return { code: fixedCode, map: null };
    }
  }
});

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    minimum_chrome_version: "120",
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
  
  vite: () => ({
    // Apply our surgical fix
    plugins: [fixYumeChanTdzBug()],
    optimizeDeps: {
      exclude: [
        '@yume-chan/adb',
        '@yume-chan/adb-daemon-webusb',
        '@yume-chan/adb-credential-web'
      ]
    },
    esbuild: {
      target: 'esnext'
    },
    build: {
      target: 'esnext',
      minify: true
    }
  })
});