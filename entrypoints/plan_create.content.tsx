// entrypoints/plan_create.content.tsx
import { DJI_PLAN_CREATE_URL_REGEX } from '@/utils/constants';
import { createLogger } from '@/utils/logger';
import { fhApi } from '@/services/fhApi';
import { createRoot, type Root as ReactRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';

const log = createLogger('plan_create.content');

const SELECT_DEVICE_LABEL = 'Select Device';
const TOPOLOGY_POLL_MS = 1000;

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

// Same call the app itself makes for this data (fhApi reads the page's own
// localStorage auth token/zone), so this works from the content script
// with no message-passing back to global.content.ts.
async function fetchDockTopology(projectId: string, deviceLabel: string): Promise<any | null> {
    const response = await fhApi.getTopologies(projectId);
    const rawList = response?.data?.list || [];
    // parents[0].device_organization_callsign is the exact same "#23 - CT1"
    // string rendered in the Select Device panel we're already reading.
    return rawList.find((item: any) => item.parents?.[0]?.device_organization_callsign === deviceLabel) ?? null;
}

function PlanCreatePopup({ projectId }: { projectId: string }) {
    const [deviceName, setDeviceName] = useState<string | null>(null);
    const [dockTopology, setDockTopology] = useState<any | null>(null);
    const [showFullData, setShowFullData] = useState(false);

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

    // Only poll while a device is actually selected, and only for that one
    // dock - no reason to pull/store the full project topology list here.
    useEffect(() => {
        if (!deviceName) {
            setDockTopology(null);
            return;
        }

        let cancelled = false;

        const poll = async () => {
            try {
                const match = await fetchDockTopology(projectId, deviceName);
                if (!cancelled) setDockTopology(match);
            } catch (error) {
                log.error('Failed to poll dock topology', error);
            }
        };

        poll();
        const intervalId = setInterval(poll, TOPOLOGY_POLL_MS);

        return () => {
            cancelled = true;
            clearInterval(intervalId);
        };
    }, [deviceName, projectId]);

    if (!deviceName) return null;

    // parents is a list - the dock we care about is always parents[0].
    const parentDeviceState = dockTopology?.parents?.[0]?.device_state;

    const battery = dockTopology?.host?.device_state?.battery?.capacity_percent;
    const mode = dockTopology?.host?.device_state?.mode_code;

    return (
        <div style={{
            position: 'fixed',
            top: 16,
            right: 90,
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
            <div style={{ marginTop: 4, fontSize: 11, color: '#aaa' }}>
                {dockTopology ? `Battery: ${battery ?? '--'}% | Mode: ${mode ?? '--'}` : 'Waiting for live data...'}
            </div>

            {parentDeviceState && (
                <pre style={{
                    marginTop: 8,
                    maxHeight: 400,
                    maxWidth: 420,
                    overflow: 'auto',
                    background: '#000',
                    padding: 8,
                    borderRadius: 6,
                    border: '1px solid #333',
                    fontSize: 11,
                    color: '#a0aec0',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                }}>
                    {JSON.stringify(parentDeviceState, null, 2)}
                </pre>
            )}
        </div>
    );
}

export default defineContentScript({
    matches: ['https://fh.dji.com/organization/*/project/*'],
    cssInjectionMode: 'ui',
    async main(ctx) {
        let ui: Awaited<ReturnType<typeof createShadowRootUi<ReactRoot>>> | null = null;

        const start = async () => {
            const match = DJI_PLAN_CREATE_URL_REGEX.exec(location.href);
            if (!match || ui) return;
            const [, , projectId] = match;
            log.info('on plan-create, mounting popup', { projectId });

            ui = await createShadowRootUi(ctx, {
                name: 'plan-create-popup',
                position: 'overlay',
                anchor: 'body',
                onMount: (container) => {
                    const root = createRoot(container);
                    root.render(<PlanCreatePopup projectId={projectId} />);
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
