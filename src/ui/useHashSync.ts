import { useEffect } from 'react';
import { decodeDesign, encodeDesign } from '../design/codec';
import { translate } from '../i18n';
import { useStore } from '../state/store';

function readHash(): 'none' | 'bad' | ReturnType<typeof decodeDesign> {
  const m = /^#d=(.+)$/.exec(location.hash);
  if (!m) return 'none';
  return decodeDesign(m[1]) ?? 'bad';
}

function load() {
  const result = readHash();
  const s = useStore.getState();
  if (result === 'none') return;
  if (result === 'bad' || result === null) s.notify(translate(s.lang, 'error.badLink'), 'error');
  else if (encodeDesign(result) !== encodeDesign(s.design)) s.setDesign(result);
}

/** The address bar always holds the current design, so a reload or a copied URL reproduces it. */
export function useHashSync() {
  useEffect(() => {
    load();
    window.addEventListener('hashchange', load);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useStore.subscribe((state, prev) => {
      if (state.design === prev.design) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const hash = `#d=${encodeDesign(useStore.getState().design)}`;
        if (location.hash !== hash) history.replaceState(null, '', hash);
      }, 300);
    });
    return () => {
      window.removeEventListener('hashchange', load);
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);
}
