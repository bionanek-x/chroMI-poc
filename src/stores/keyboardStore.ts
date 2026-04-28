import { create } from 'zustand';

type Layout = 'default' | 'numeric';

interface KeyboardState {
  visible: boolean;
  layout: Layout;
  value: string;
  onCommit: ((v: string) => void) | null;
  open: (opts: { layout?: Layout; initial?: string; onCommit: (v: string) => void }) => void;
  close: () => void;
  setValue: (v: string) => void;
}

export const useKeyboardStore = create<KeyboardState>((set) => ({
  visible: false,
  layout: 'default',
  value: '',
  onCommit: null,
  open: ({ layout = 'default', initial = '', onCommit }) =>
    set({ visible: true, layout, value: initial, onCommit }),
  close: () => set({ visible: false, onCommit: null }),
  setValue: (value) => set({ value }),
}));
