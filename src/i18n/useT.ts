import { useCallback } from 'react';
import { useStore } from '../state/store';
import { translate, type MessageKey } from './index';

export function useT() {
  const lang = useStore((s) => s.lang);
  return useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang],
  );
}
