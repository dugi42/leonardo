import { create } from 'zustand';
import { randomDesign } from '../design/mutate';
import { normaliseDesign, type Design } from '../design/schema';
import { randomSeed } from '../engine/prng';
import { initialLang, persistLang, type Lang } from '../i18n';

export type Mode = 'explore' | 'refine' | 'print';

export interface ExploreState {
  tiles: Design[];
  selected: number;
  temperature: number;
  /** Variations put the parent in the centre tile. */
  kind: 'shuffle' | 'variations';
}

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error';
}

interface State {
  design: Design;
  mode: Mode;
  lang: Lang;
  past: Design[];
  future: Design[];
  lastChange: number;
  toast: Toast | null;
  /** Bumped whenever the saved history changes, so lists reload. */
  historyVersion: number;
  showOverhang: boolean;
  /** Format being exported, or null; export buttons are busy meanwhile. */
  exporting: 'stl' | '3mf' | null;
  /** Spectrum cell under the pointer; the viewport tints the model by its basis function. */
  hoverCell: { k: number; m: number } | null;
  setHoverCell: (cell: { k: number; m: number } | null) => void;
  explore: ExploreState;
  setExplore: (patch: Partial<ExploreState>) => void;
  setShowOverhang: (on: boolean) => void;
  bumpHistory: () => void;
  setDesign: (next: Design | ((d: Design) => Design)) => void;
  newDesign: () => void;
  undo: () => void;
  redo: () => void;
  setMode: (mode: Mode) => void;
  setLang: (lang: Lang) => void;
  notify: (text: string, tone?: Toast['tone']) => void;
}

/** Changes closer together than this (e.g. one slider drag) form one undo step. */
const COALESCE_MS = 400;
const HISTORY_LIMIT = 100;

const same = (a: Design, b: Design) => JSON.stringify(a) === JSON.stringify(b);

export const useStore = create<State>()((set, get) => ({
  design: randomDesign(randomSeed()),
  mode: 'refine',
  lang: initialLang(),
  past: [],
  future: [],
  lastChange: -Infinity,
  toast: null,
  historyVersion: 0,
  showOverhang: false,
  exporting: null,
  hoverCell: null,
  setHoverCell: (hoverCell) => set({ hoverCell }),
  explore: { tiles: [], selected: 0, temperature: 0.35, kind: 'shuffle' },
  setExplore: (patch) => set((s) => ({ explore: { ...s.explore, ...patch } })),
  setShowOverhang: (showOverhang) => set({ showOverhang }),
  bumpHistory: () => set((s) => ({ historyVersion: s.historyVersion + 1 })),

  setDesign: (next) => {
    const { design, past, lastChange } = get();
    const raw = typeof next === 'function' ? next(design) : next;
    const normalised = normaliseDesign(raw);
    if (!normalised || same(normalised, design)) return;
    const now = Date.now();
    const coalesce = now - lastChange < COALESCE_MS && past.length > 0;
    set({
      design: normalised,
      past: coalesce ? past : [...past, design].slice(-HISTORY_LIMIT),
      future: [],
      lastChange: now,
    });
  },

  newDesign: () => {
    const { design, setDesign } = get();
    set({ lastChange: -Infinity });
    setDesign(randomDesign(randomSeed(), design));
    set({ lastChange: -Infinity });
  },

  undo: () => {
    const { past, design, future } = get();
    if (!past.length) return;
    set({
      design: past[past.length - 1],
      past: past.slice(0, -1),
      future: [design, ...future],
      lastChange: -Infinity,
    });
  },

  redo: () => {
    const { past, design, future } = get();
    if (!future.length) return;
    set({ design: future[0], past: [...past, design], future: future.slice(1), lastChange: -Infinity });
  },

  setMode: (mode) => set({ mode }),
  setLang: (lang) => {
    persistLang(lang);
    set({ lang });
  },
  notify: (text, tone = 'info') => set({ toast: { id: Date.now() + Math.random(), text, tone } }),
}));

/** Test and load helper: start over with a given design and empty undo history. */
export function resetStore(design: Design, mode: Mode = 'refine') {
  useStore.setState({ design, past: [], future: [], lastChange: -Infinity, mode, toast: null, hoverCell: null });
}
