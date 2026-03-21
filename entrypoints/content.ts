export default defineContentScript({
  matches: ['https://fh.dji.com/organization/*'],
  main() {
    console.log('Requesting debugger attachment...');
    browser.runtime.sendMessage({ type: 'START_DEBUGGING' });
  },
});