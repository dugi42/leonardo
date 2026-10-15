import { useEffect } from 'react';
import { useStore } from '../state/store';
import { saveCurrent } from './actions';
import { shuffleTiles } from './explore/ExploreGrid';

const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) &&
  !(el instanceof HTMLInputElement && (el.type === 'range' || el.type === 'checkbox' || el.type === 'radio'));

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveCurrent();
        return;
      }
      if (mod || e.altKey || typing(e.target)) return;
      if (e.target instanceof HTMLInputElement && e.target.type === 'range' && /^[123 ]$/.test(e.key)) return;
      if (e.key === '1') s.setMode('explore');
      else if (e.key === '2') s.setMode('refine');
      else if (e.key === '3') s.setMode('print');
      else if (e.key === ' ' && s.mode === 'explore' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        shuffleTiles();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
