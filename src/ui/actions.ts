import { encodeDesign } from '../design/codec';
import { translate } from '../i18n';
import { useStore } from '../state/store';
import { saveDesign } from '../storage/history';
import { downloadBytes, exportInBackground } from '../worker/client';
import type { Format } from '../worker/exportFile';
import { renderThumbnail } from './thumbnail';

const tr = (...args: Parameters<typeof translate> extends [unknown, ...infer R] ? R : never) =>
  translate(useStore.getState().lang, ...args);

/** Keeps the current design in history; storage problems never break the calling action. */
export async function keepInHistory(): Promise<boolean> {
  const { design, bumpHistory } = useStore.getState();
  try {
    const key = encodeDesign(design);
    await saveDesign(design, await renderThumbnail(design, key));
    bumpHistory();
    return true;
  } catch {
    return false;
  }
}

export async function exportCurrent(format: Format) {
  const { design, notify } = useStore.getState();
  const label = format.toUpperCase();
  notify(tr('action.exporting', { format: label }));
  try {
    const file = await exportInBackground(design, format);
    downloadBytes(file);
    notify(tr('action.exported', { file: file.name }));
    await keepInHistory();
  } catch (err) {
    notify(tr('error.mesh', { reason: err instanceof Error ? err.message : String(err) }), 'error');
  }
}

export function shareUrl(): string {
  const { design } = useStore.getState();
  return `${location.origin}${location.pathname}#d=${encodeDesign(design)}`;
}

export async function shareCurrent() {
  const url = shareUrl();
  history.replaceState(null, '', url);
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    // clipboard blocked: the address bar still holds the link
  }
  useStore.getState().notify(tr('action.shared'));
  await keepInHistory();
}

export async function saveCurrent() {
  if (await keepInHistory()) useStore.getState().notify(tr('action.saved'));
  else useStore.getState().notify(tr('history.unavailable'), 'error');
}
