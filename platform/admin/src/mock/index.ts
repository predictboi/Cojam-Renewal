// Mock mode (VITE_API_MOCK=1): the design's own mock data (platform/design/admin/data.js, imported unchanged; it sets
// window.AD) so every screen and every ?state= preset matches the prototype. Writes resolve after a short delay.
let loaded: Promise<any> | null = null;
export function loadMock(): Promise<any> {
  if (!loaded) loaded = import('../../../design/admin/data.js').then(() => (window as any).AD);
  return loaded;
}
export const mockDelay = (ms = 450) => new Promise((r) => setTimeout(r, ms));
