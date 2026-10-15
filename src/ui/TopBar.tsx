import { useT } from '../i18n/useT';
import { useStore, type Mode } from '../state/store';
import { exportCurrent, saveCurrent, shareCurrent } from './actions';
import { Icon } from './icons';

const MODES: Mode[] = ['explore', 'refine', 'print'];

export function TopBar({ onHistory }: { onHistory?: () => void }) {
  const t = useT();
  const mode = useStore((s) => s.mode);
  const seed = useStore((s) => s.design.seed);
  const lang = useStore((s) => s.lang);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const exporting = useStore((s) => s.exporting);
  const { setMode, setLang, newDesign, undo, redo } = useStore.getState();

  return (
    <header className="topbar">
      <div className="brand">
        <span className="wordmark">Leonardo</span>
        <span className="tagline">{t('app.tagline')}</span>
      </div>

      <div className="modes" role="tablist" aria-label="Mode">
        {MODES.map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            className="mode"
            onClick={() => setMode(m)}
          >
            {t(`mode.${m}`)}
          </button>
        ))}
      </div>

      <div className="toolbar">
        <div className="group">
          <button className="icon-btn" onClick={undo} disabled={!canUndo} aria-label={t('action.undo')} title={`${t('action.undo')} (⌘Z)`}>
            <Icon name="undo" />
          </button>
          <button className="icon-btn" onClick={redo} disabled={!canRedo} aria-label={t('action.redo')} title={`${t('action.redo')} (⇧⌘Z)`}>
            <Icon name="redo" />
          </button>
        </div>
        <button className="btn ghost" onClick={newDesign} title={t('action.newDesign')}>
          <Icon name="dice" />
          <span className="label">{t('action.newDesign')}</span>
        </button>
        <span className="seed" title="Seed">#{seed}</span>
        <div className="group">
          <button className="icon-btn" onClick={saveCurrent} aria-label={t('action.save')} title={`${t('action.save')} (⌘S)`}>
            <Icon name="bookmark" />
          </button>
          <button className="icon-btn" onClick={shareCurrent} aria-label={t('action.share')} title={t('action.share')}>
            <Icon name="link" />
          </button>
          <button className="icon-btn" onClick={onHistory} aria-label={t('action.history')} title={t('action.history')}>
            <Icon name="clock" />
          </button>
        </div>
        <div className="group export">
          <button
            className="btn primary"
            onClick={() => exportCurrent('3mf')}
            aria-busy={exporting === '3mf'}
            aria-disabled={exporting !== null}
            title={t('action.exportTitle', { format: '3MF' })}
          >
            {exporting === '3mf' ? <span className="spinner" aria-hidden="true" /> : <Icon name="download" />}
            {t('action.export3mf')}
          </button>
          <button
            className="btn"
            onClick={() => exportCurrent('stl')}
            aria-busy={exporting === 'stl'}
            aria-disabled={exporting !== null}
            title={t('action.exportTitle', { format: 'STL' })}
          >
            {exporting === 'stl' && <span className="spinner" aria-hidden="true" />}
            {t('action.exportStl')}
          </button>
        </div>
        <button className="btn ghost lang" onClick={() => setLang(lang === 'en' ? 'de' : 'en')}>
          {t('action.language')}
        </button>
      </div>
    </header>
  );
}
