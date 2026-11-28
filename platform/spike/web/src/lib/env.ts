// Step a: where the app runs. Standalone detection as in DEV-PLAN 1.3 and 9.4.

export interface EnvInfo {
  userAgent: string;
  platform: 'iOS' | 'Android' | 'other';
  standalone: boolean;
  displayMode: string;
  navigatorStandalone: boolean | null;
  launchedFrom: string | null;
  inAppBrowser: string | null;
  serviceWorker: 'controlling' | 'registered, not controlling yet' | 'unsupported' | 'none';
  storagePersisted: boolean | null;
  storagePersistRequest: boolean | null;
  storageEstimateMB: { usage: number; quota: number } | null;
  indexedDB: boolean;
  online: boolean;
  screen: string;
  language: string;
  checkedAt: string;
}

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

function platformOf(ua: string): EnvInfo['platform'] {
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'iOS';
  if (/Android/i.test(ua)) return 'Android';
  return 'other';
}

function inAppOf(ua: string): string | null {
  const m = ua.match(/KAKAOTALK|Line\/|Instagram|FBAN|FBAV|NAVER\(inapp/i);
  return m ? m[0] : null;
}

export async function readEnv(requestPersist: boolean): Promise<EnvInfo> {
  const ua = navigator.userAgent;
  const modes = ['standalone', 'fullscreen', 'minimal-ui', 'browser'];
  const displayMode = modes.find((m) => window.matchMedia(`(display-mode: ${m})`).matches) || 'unknown';
  let persisted: boolean | null = null;
  let persistReq: boolean | null = null;
  let est: EnvInfo['storageEstimateMB'] = null;
  try {
    if (navigator.storage?.persisted) persisted = await navigator.storage.persisted();
    if (requestPersist && navigator.storage?.persist) persistReq = await navigator.storage.persist();
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      est = { usage: Math.round(((e.usage || 0) / 1048576) * 10) / 10, quota: Math.round((e.quota || 0) / 1048576) };
    }
  } catch {
    /* reported as null */
  }
  let sw: EnvInfo['serviceWorker'] = 'unsupported';
  if ('serviceWorker' in navigator) {
    if (navigator.serviceWorker.controller) sw = 'controlling';
    else sw = (await navigator.serviceWorker.getRegistration()) ? 'registered, not controlling yet' : 'none';
  }
  return {
    userAgent: ua,
    platform: platformOf(ua),
    standalone: isStandalone(),
    displayMode,
    navigatorStandalone: (navigator as unknown as { standalone?: boolean }).standalone ?? null,
    launchedFrom: new URLSearchParams(location.search).get('source'),
    inAppBrowser: inAppOf(ua),
    serviceWorker: sw,
    storagePersisted: persisted,
    storagePersistRequest: persistReq,
    storageEstimateMB: est,
    indexedDB: typeof indexedDB !== 'undefined',
    online: navigator.onLine,
    screen: `${screen.width}x${screen.height} @${window.devicePixelRatio}`,
    language: navigator.language,
    checkedAt: new Date().toISOString(),
  };
}
