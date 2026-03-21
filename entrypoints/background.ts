// entrypoints/background/index.ts
export default defineBackground(() => {
  const registry = new Map<number, number>();

  browser.runtime.onMessage.addListener(async (message) => {
    if (message.type === 'OPEN_DASHBOARD') {
      const { missionId, orgId, projectId, sourceTabId } = message;

      const url = browser.runtime.getURL(`/dashboard.html?missionId=${missionId}&orgId=${orgId}&projectId=${projectId}`);

      const dashboardTab = await browser.tabs.create({ url });
      registry.set(sourceTabId, dashboardTab.id!);
    }
  });



  browser.tabs.onRemoved.addListener((tabId) => {
    if (registry.has(tabId)) {
      const dashboardId = registry.get(tabId);
      browser.tabs.remove(dashboardId!).catch(() => { }); // Ignore if already closed
      registry.delete(tabId);
    }
  });


});