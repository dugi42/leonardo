import { useEffect } from 'react';
import { decodeDesign, encodeDesign } from '../design/codec';
import { translate } from '../i18n';
import { resetStore, useStore } from '../state/store';

function readHash(): 'none' | 'bad' | ReturnType<typeof decodeDesign> {
  const m = /^#d=(.+)$/.exec(location.hash);
  if (!m) return 'none';
  return decodeDesign(m[1]) ?? 'bad';
}

/** First load replaces the throwaway startup design; later hash changes are undoable edits. */
function load(initial: boolean) {
  const result = readHash();
  const s = useStore.getState();
  if (result === 'none') return;
  if (result === 'bad' || result === null) s.notify(translate(s.lang, 'error.badLink'), 'error');
  else if (encodeDesign(result) === encodeDesign(s.design)) return;
  else if (initial) resetStore(result, s.mode);
  else s.setDesign(result);
}

const onHashChange = () => load(false);

/** The address bar always holds the current design, so a reload or a copied URL reproduces it. */
export function useHashSync() {
  useEffect(() => {
    load(true);
    window.addEventListener('hashchange', onHashChange);
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
      window.removeEventListener('hashchange', onHashChange);
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);
}
