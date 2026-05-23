// import { RcIcon } from '@/components/ui/RcIcon';
import { DJI_COCKPIT_REGEX } from '@/utils/constants';
import { createLogger } from '@/utils/logger';
// import { createRoot } from 'react-dom/client';

const log = createLogger('cockpit.content');


export default defineContentScript({
  matches: ['https://fh.dji.com/*'],
  async main() {

    const url = window.location.href;
    const match = url.match(DJI_COCKPIT_REGEX);

    if (!match) return

    const orgId = match[1];
    const projectId = match[2];

    log.info("cockpit", orgId, projectId);

    // const findMenuInterval = setInterval(() => {
    //   // Use querySelector to grab the first element with this class
    //   const rightMenuBar = document.querySelector('.right-menu-bar');
    //   log.info("findMenuInterval");

    //   if (rightMenuBar) {
    //     // Stop looking! We found it.
    //     clearInterval(findMenuInterval);
    //     log.info("✅ Menu bar found! Injecting RC Icon.");

    //     // 2. Create a dedicated HTML container for your React app
    //     const iconContainer = document.createElement('div');
    //     iconContainer.id = 'dji-custom-rc-icon';
    //     iconContainer.style.display = 'flex'; // Helps it align nicely with existing DJI buttons

    //     // 3. prepend() forces it to the VERY BEGINNING of the menu bar
    //     rightMenuBar.prepend(iconContainer);

    //     // 4. Mount your React component inside the new container
    //     const root = createRoot(iconContainer);
    //     root.render(<RcIcon
    //       orgId={orgId}
    //       projectId={projectId}
    //     />);
    //   }
    // }, 1000); // Checks every 1 second
  }
});