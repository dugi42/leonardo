import { useEffect, useState } from 'react';
import { useStore } from '../state/store';

export function Toast() {
  const toast = useStore((s) => s.toast);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const id = setTimeout(() => setVisible(false), toast.tone === 'error' ? 6000 : 2600);
    return () => clearTimeout(id);
  }, [toast]);
  return (
    <div className={`toast ${toast?.tone ?? ''} ${visible ? 'show' : ''}`} role="status" aria-live="polite">
      {toast?.text}
    </div>
  );
}
