// Define your log levels (higher number = more severe)
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4, // Use this to silence everything
}

// --- THE CONTROL PANEL ---
const CONFIG = {
  // 1. Set the minimum level to show. (e.g., INFO hides DEBUG messages)
  globalLevel: LogLevel.DEBUG,

  // 2. Which components are allowed to speak? 
  // Use '*' to allow all, or pass an array of names: ['DashboardView', 'CloudStorage']
  enabledComponents: '*' as '*' | string[],
};

/**
 * Helper to determine if a log should be printed
 */
function shouldLog(componentName: string, level: LogLevel): boolean {
  if (level < CONFIG.globalLevel) return false;
  if (CONFIG.enabledComponents === '*') return true;
  return CONFIG.enabledComponents.includes(componentName);
}

/**
 * Creates a logger instance for a specific component
 */
export function createLogger(componentName: string) {
  // Adding some colors makes the console infinitely easier to read
  const prefix = `%c[${componentName}]`;
  const infoStyle = 'color: #0066ff; font-weight: bold;'; // Nice DJI blue!
  const warnStyle = 'color: #ff9900; font-weight: bold;';
  const errorStyle = 'color: #ff0000; font-weight: bold;';

  return {
    get debug() {
      if (!shouldLog(componentName, LogLevel.DEBUG)) return () => { };
      return console.debug.bind(console, prefix, infoStyle);
    },
    get info() {
      if (!shouldLog(componentName, LogLevel.INFO)) return () => { };
      return console.info.bind(console, prefix, infoStyle);
    },
    get warn() {
      if (!shouldLog(componentName, LogLevel.WARN)) return () => { };
      return console.warn.bind(console, prefix, warnStyle);
    },
    get error() {
      if (!shouldLog(componentName, LogLevel.ERROR)) return () => { };
      return console.error.bind(console, prefix, errorStyle);
    },
    get table() {
      if (!shouldLog(componentName, LogLevel.DEBUG)) return () => { };
      // table doesn't support %c prefixing well, so we just bind it directly
      return console.table.bind(console);
    },
    clear: () => console.clear()
  }
};

// Optional: Export a way to change settings at runtime from the browser console!
export const setLoggerConfig = (components: '*' | string[], level?: LogLevel) => {
  CONFIG.enabledComponents = components;
  if (level !== undefined) CONFIG.globalLevel = level;
  console.log(`[Logger] Config updated. Active components:`, components);
};

// Expose it to the global window object so you can type `window.setLoggerConfig(['DashboardView'])` in the Chrome console!
if (typeof window !== 'undefined') {
  (window as any).setLoggerConfig = setLoggerConfig;
}