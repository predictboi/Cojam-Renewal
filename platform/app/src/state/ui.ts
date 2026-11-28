// Shell state shared by every screen: the toast queue, the bottom sheet and the screen reader live region.
import type { ReactNode } from 'react';
import { create } from 'zustand';

export interface ToastOpts { btn?: string; fn?: () => void; ms?: number; key?: string }
interface Toast { id: number; msg: string; o: ToastOpts }
export interface SheetOpts { label?: string; closable?: boolean; onClose?: () => void }

interface UiState {
  toasts: Toast[];          // [0] is the one on screen, the rest queue
  sheet: { content: ReactNode | string; o: SheetOpts; seq: number } | null;
  live: string;
  bare: boolean;
}
export const useUi = create<UiState>(() => ({ toasts: [], sheet: null, live: '', bare: false }));

let tid = 0;
/** one visible, the rest queue; the same notice (o.key) is never stacked */
export function toast(msg: string, o: ToastOpts = {}) {
  const s = useUi.getState();
  if (o.key && s.toasts.some((x) => x.o.key === o.key)) return;
  useUi.setState({ toasts: [...s.toasts, { id: ++tid, msg, o }] });
}
export function dropToast(id: number) { useUi.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })); }

let sseq = 0;
export const sheet = {
  open(content: ReactNode | string, o: SheetOpts = {}) {
    const cur = useUi.getState().sheet;
    useUi.setState({ sheet: { content, o, seq: cur ? cur.seq : ++sseq } });
  },
  close(silent?: boolean) {
    const cur = useUi.getState().sheet;
    if (!cur) return;
    useUi.setState({ sheet: null });
    if (!silent && cur.o.onClose) cur.o.onClose();
  },
  closable() { const s = useUi.getState().sheet; return !s || s.o.closable !== false; },
  isOpen() { return !!useUi.getState().sheet; },
};

export function live(msg: string) {
  useUi.setState({ live: '' });
  setTimeout(() => useUi.setState({ live: msg }), 30);
}
