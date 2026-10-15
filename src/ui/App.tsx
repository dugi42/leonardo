import { useCallback, useState } from 'react';
import { useT } from '../i18n/useT';
import { useStore } from '../state/store';
import { ExploreGrid, ExplorePanel } from './explore/ExploreGrid';
import { HistoryDrawer } from './HistoryDrawer';
import { PrintPanel } from './panels/PrintPanel';
import { RefinePanel } from './panels/RefinePanel';
import { Toast } from './Toast';
import { TopBar } from './TopBar';
import { useHashSync } from './useHashSync';
import { useShortcuts } from './useShortcuts';
import { Viewport } from './Viewport';
import './theme.css';

export function App() {
  const t = useT();
  const mode = useStore((s) => s.mode);
  const [historyOpen, setHistoryOpen] = useState(false);
  const closeHistory = useCallback(() => setHistoryOpen(false), []);
  useHashSync();
  useShortcuts();

  return (
    <div className="app" data-mode={mode}>
      <TopBar onHistory={() => setHistoryOpen(true)} />
      <main className="workspace">
        <div className="stage">{mode === 'explore' ? <ExploreGrid /> : <Viewport />}</div>
        <aside className="panel" aria-label={t(`mode.${mode}`)}>
          {mode === 'explore' && <ExplorePanel />}
          {mode === 'refine' && <RefinePanel />}
          {mode === 'print' && <PrintPanel />}
        </aside>
      </main>
      <HistoryDrawer open={historyOpen} onClose={closeHistory} />
      <Toast />
    </div>
  );
}
