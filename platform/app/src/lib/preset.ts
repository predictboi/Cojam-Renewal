// Design review presets: ?state=<name> as in platform/design/index.html. Honoured only in mock or non production builds,
// read from the address of the current screen, so a link inside the app (which never carries ?state=) drops it.
import { CONFIG } from '../config';

export function presetOf(search: string): string {
  if (!CONFIG.dev) return '';
  return new URLSearchParams(search).get('state') || '';
}
/** The state the app was opened with (for app wide presets such as offline). */
export const BOOT_PRESET = presetOf(location.search);
