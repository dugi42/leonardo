import { useEffect, useState } from 'react';
import { useT } from '../i18n/useT';
import { useStore } from '../state/store';
import { deleteEntry, listHistory, setStarred, type HistoryEntry } from '../storage/history';
import { Icon } from './icons';

const formatDate = (ms: number, lang: string) =>
  new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(ms);

export function HistoryDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const version = useStore((s) => s.historyVersion);
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!open) return;
    let live = true;
    listHistory()
      .then((list) => live && setEntries(list))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [open, version, tick]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const shown = (entries ?? []).filter((e) => !favoritesOnly || e.starred);
  const refresh = () => setTick((n) => n + 1);

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={t('history.title')}>
        <header className="drawer-head">
          <h2>{t('history.title')}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('action.close')}>
            <Icon name="close" />
          </button>
        </header>
        <label className="toggle">
          <input type="checkbox" checked={favoritesOnly} onChange={(e) => setFavoritesOnly(e.target.checked)} />
          <span>{t('history.favorites')}</span>
        </label>
        {failed && <p className="note warn">{t('history.unavailable')}</p>}
        {entries && shown.length === 0 && !failed && <p className="empty">{t('history.empty')}</p>}
        <ul className="history-list">
          {shown.map((e) => (
            <li key={e.id} className="history-item">
              <button
                className="history-open"
                aria-label={`${t('history.open')} #${e.design.seed}`}
                onClick={() => {
                  useStore.getState().setDesign(e.design);
                  if (useStore.getState().mode === 'explore') useStore.getState().setMode('refine');
                  onClose();
                }}
              >
                {e.thumb ? <img src={e.thumb} alt="" /> : <span className="tile-wait" aria-hidden="true" />}
                <span className="history-meta">
                  <span className="history-seed">#{e.design.seed}</span>
                  <span className="muted small">
                    {t(`body.${e.design.body.kind}`)} · {formatDate(e.created, lang)}
                  </span>
                </span>
              </button>
              <button
                className={e.starred ? 'icon-btn starred' : 'icon-btn'}
                aria-label={e.starred ? t('history.unstar') : t('history.star')}
                onClick={() => setStarred(e.id, !e.starred).then(refresh)}
              >
                <Icon name="star" />
              </button>
              <button className="icon-btn" aria-label={t('history.delete')} onClick={() => deleteEntry(e.id).then(refresh)}>
                <Icon name="trash" />
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </>
  );
}
