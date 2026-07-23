// entrypoints/plan_create.content.tsx
import { DJI_PLAN_CREATE_URL_REGEX } from '@/utils/constants';
import { createLogger } from '@/utils/logger';
import { fhApi } from '@/services/fhApi';
import { weatherApi, type WeatherForecast } from '@/services/weatherApi';
import { kpApi, type KpEntry } from '@/services/kpApi';
import { topoUtils } from '@/utils/topo-utils';
import { createRoot, type Root as ReactRoot } from 'react-dom/client';
import { useEffect, useRef, useState } from 'react';

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
    const [showHide, setShowHide] = useState(true);

    // Weather per device name, kept in-memory only (never persisted) - it's
    // live data, refreshed on its own timer below. Cached per device so
    // switching back to a device we've already seen shows its last known
    // forecast immediately instead of going blank while waiting on a refetch.
    const [weatherByDevice, setWeatherByDevice] = useState<Record<string, WeatherForecast>>({});
    const fetchedWeatherForRef = useRef<Set<string>>(new Set());

    // Planetary Kp index isn't location-specific, so it's fetched once ever
    // (not per device) and kept in-memory only, same as weather.
    const [kpEntries, setKpEntries] = useState<KpEntry[] | null>(null);
    const hasFetchedKpRef = useRef(false);

    // parents is a list - the dock we care about is always parents[0]. The
    // dock is always powered on, so its state is what's actually live; the
    // host (drone) keeps reporting its last known state after it's powered
    // off, so anything battery/mode-related has to come from the parent
    // instead (dock mode_code and drone mode_code are different code spaces).
    const parentDeviceState = dockTopology?.parents?.[0]?.device_state;

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
        // Reset immediately on every device change (including switching
        // between two selected devices) so the table doesn't keep showing
        // the previous device's readings until the next poll lands - it
        // shows "Waiting for live data..." until the timer below refills it.
        setDockTopology(null);
        if (!deviceName) return;

        let cancelled = false;

        const poll = async () => {
            try {
                const match = await fetchDockTopology(projectId, deviceName);
                if (cancelled) return;

                setDockTopology(match);

                // Weather fetched once per device name, right here where we
                // actually have coordinates - keyed only on deviceName via
                // fetchedWeatherForRef, nothing to do with position.
                const matchLat = match?.parents?.[0]?.device_state?.latitude;
                const matchLon = match?.parents?.[0]?.device_state?.longitude;

                if (matchLat != null && matchLon != null && !fetchedWeatherForRef.current.has(deviceName)) {
                    fetchedWeatherForRef.current.add(deviceName);

                    weatherApi.getForecast(matchLat, matchLon)
                        .then(forecast => {
                            if (!cancelled) setWeatherByDevice(prev => ({ ...prev, [deviceName]: forecast }));
                        })
                        .catch(error => {
                            log.error('Failed to fetch weather forecast', error);
                            fetchedWeatherForRef.current.delete(deviceName); // allow a retry later
                        });
                }

                // Kp index isn't tied to the dock at all, so it's fetched
                // once ever (not per device, no interval).
                if (!hasFetchedKpRef.current) {
                    hasFetchedKpRef.current = true;

                    kpApi.getPlanetaryKIndex()
                        .then(entries => {
                            if (!cancelled) setKpEntries(entries);
                        })
                        .catch(error => {
                            log.error('Failed to fetch Kp index', error);
                            hasFetchedKpRef.current = false; // allow a retry later
                        });
                }
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

    const weather = weatherByDevice[deviceName] ?? null;

    const gps = parentDeviceState?.position_state;

    // Real per-cell battery data lives here, not drone_charge_state - a
    // drone can report 1 or 2 batteries depending on model.
    const batteries: any[] = parentDeviceState?.drone_battery_maintenance_info?.batteries ?? [];
    const batteryLabel = batteries.length > 1 ? 'Battery (per cell)' : 'Battery';
    const batteryValue = batteries.length === 0
        ? '--'
        : batteries.length === 1
            ? `${batteries[0].capacity_percent}%`
            : batteries
                .map(b => `${topoUtils.getBatteryIndexLabel(b.index)}: ${b.capacity_percent}%`)
                .join(' / ');

    const rows: [string, string][] = parentDeviceState ? [
        [batteryLabel, batteryValue],
        ['Dock Mode', topoUtils.getModeCodeLabel(parentDeviceState.mode_code)],
        ['Task State', topoUtils.getFlightTaskStepCodeLabel(parentDeviceState.flighttask_step_code)],
        ['In Dock', topoUtils.getDroneInDockLabel(parentDeviceState.drone_in_dock)],
        ['Cover', topoUtils.getCoverStateLabel(parentDeviceState.cover_state)],
        ['Wind', `${parentDeviceState.wind_speed ?? '--'} m/s`],
        ['Rainfall', topoUtils.getRainfallLabel(parentDeviceState.rainfall)],
        ['Temp Hamb', `${parentDeviceState.environment_temperature ?? '--'}°C`],
        ['Int Humidity', `${parentDeviceState.humidity ?? '--'}%`],
        ['GPS/RTK', `${gps?.gps_number ?? 0} GPS / ${gps?.rtk_number ?? 0} RTK sats — ${topoUtils.getFixStateLabel(gps?.is_fixed)}`],
        ['Alarm', topoUtils.getAlarmStateLabel(parentDeviceState.alarm_state)],
        ['E-Stop', topoUtils.getEmergencyStopStateLabel(parentDeviceState.emergency_stop_state)],
        ['Firmware', topoUtils.getFirmwareUpgradeStatusLabel(parentDeviceState.firmware_upgrade_status)],
    ] : [];

    const weatherHourIndex = weather ? weatherApi.findCurrentHourIndex(weather.hourly.time) : -1;
    // hourly.time is like "2026-07-23T14:00" (local, per timezone=auto) -
    // just the HH:mm is enough since forecast_days=1 means it's always today.
    const selectedWeatherTime = weatherHourIndex >= 0 ? weather!.hourly.time[weatherHourIndex]?.split('T')[1] : null;
    const weatherRows: [string, string][] = weather && weatherHourIndex >= 0 ? [
        ['Temp', `${weather.hourly.temperature_2m[weatherHourIndex]}°C (feels ${weather.hourly.apparent_temperature[weatherHourIndex]}°C)`],
        ['Humidity', `${weather.hourly.relative_humidity_2m[weatherHourIndex]}%`],
        ['Rain', `${weather.hourly.precipitation_probability[weatherHourIndex]}% chance, ${weather.hourly.rain[weatherHourIndex]} mm`],
        ['Wind', `${weather.hourly.wind_speed_10m[weatherHourIndex]} m/s (gusts ${weather.hourly.wind_gusts_10m[weatherHourIndex]} m/s)`],
        ['Wind @120m', `${weather.hourly.wind_speed_120m[weatherHourIndex]} m/s`],
        ['Visibility', `${weather.hourly.visibility[weatherHourIndex]} m`],
    ] : [];

    // Every entry for today (~3 hours apart) - each row is its own time/kp
    // pair, with the current one labeled so it stands out in the list.
    const kpTodayEntries = kpEntries ? kpApi.getTodayEntries(kpEntries) : [];
    const kpCurrentIndex = kpApi.findCurrentIndex(kpTodayEntries);
    const kpRows: [string, string][] = kpTodayEntries.map((entry, i) => [
        // i === kpCurrentIndex ? `Now (${kpApi.formatTime(entry.timeTag)})` : kpApi.formatTime(entry.timeTag),
        kpApi.formatTime(entry.timeTag),
        entry.kp.toFixed(2),
    ]);

    return (
        <div style={{
            position: 'fixed',
            top: 16,
            right: 90,
            width: 340,
            zIndex: 999999,
            background: '#111',
            color: '#fff',
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid #333',
            fontSize: 13,
            fontFamily: 'system-ui, sans-serif',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <span>Dock: <strong>{deviceName}</strong></span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#aaa', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <input
                        type="checkbox"
                        checked={showFullData}
                        onChange={(e) => setShowFullData(e.target.checked)}
                    />
                    Full data
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#aaa', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <input
                        type="checkbox"
                        checked={showHide}
                        onChange={(e) => setShowHide(e.target.checked)}
                    />
                    Show/Hide
                </label>
            </div>

            {showHide && rows.length > 0 ? (
                <>
                    <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #333', fontSize: 11, color: '#888' }}>
                        FH Data
                    </div>
                    <table style={{ marginTop: 8, width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 11 }}>
                        <tbody>
                            {rows.map(([label, value]) => (
                                <tr key={label}>
                                    <td style={{ width: 90, padding: '2px 12px 2px 0', color: '#888' }}>{label}</td>
                                    <td style={{ padding: '2px 0', color: '#fff', fontWeight: 500, wordBreak: 'break-word' }}>{value}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            ) : (
                <div style={{ marginTop: 4, fontSize: 11, color: '#aaa' }}>{showHide ? 'Waiting for live data...' : 'Data Hidden'}</div>
            )}

            {showHide && showFullData && parentDeviceState && (
                <pre style={{
                    marginTop: 8,
                    maxHeight: 400,
                    width: '100%',
                    boxSizing: 'border-box',
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

            {showHide && weatherRows.length > 0 && (
                <>
                    <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #333', fontSize: 11, color: '#888' }}>
                        Weather (Open-Meteo){selectedWeatherTime ? ` — ${selectedWeatherTime}` : ''}, CON PINZAS
                    </div>
                    <table style={{ marginTop: 4, width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 11 }}>
                        <tbody>
                            {weatherRows.map(([label, value]) => (
                                <tr key={label}>
                                    <td style={{ width: 90, padding: '2px 12px 2px 0', color: '#888' }}>{label}</td>
                                    <td style={{ padding: '2px 0', color: '#fff', fontWeight: 500, wordBreak: 'break-word' }}>{value}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}

            {showHide && kpRows.length > 0 && (
                <>
                    <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #333', fontSize: 11, color: '#888' }}>
                        Kp Index (NOAA), CON PINZAS
                    </div>
                    <table style={{ marginTop: 4, width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 11 }}>
                        <tbody>
                            {kpRows.map(([time, kp]) => (
                                <tr key={time}>
                                    <td style={{ width: 90, padding: '2px 12px 2px 0', color: '#888' }}>{time}</td>
                                    <td style={{ padding: '2px 0', color: '#fff', fontWeight: 500 }}>{kp}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
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
