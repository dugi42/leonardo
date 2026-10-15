import { clear, createStore, del, entries, get, set } from 'idb-keyval';
import { encodeDesign } from '../design/codec';
import { normaliseDesign, type Design } from '../design/schema';

export interface HistoryEntry {
  /** The encoded design, so saving the same design twice updates one entry. */
  id: string;
  design: Design;
  thumb?: string;
  created: number;
  starred: boolean;
}

let store: ReturnType<typeof createStore> | null = null;
const db = () => (store ??= createStore('leonardo', 'history'));

export async function listHistory(): Promise<HistoryEntry[]> {
  const all = await entries<string, HistoryEntry>(db());
  return all
    .map(([, e]) => e)
    .filter((e) => normaliseDesign(e.design))
    .sort((a, b) => b.created - a.created);
}

export async function saveDesign(design: Design, thumb?: string): Promise<HistoryEntry> {
  const id = encodeDesign(design);
  const existing = await get<HistoryEntry>(id, db());
  const entry: HistoryEntry = {
    id,
    design,
    thumb: thumb ?? existing?.thumb,
    created: Date.now(),
    starred: existing?.starred ?? false,
  };
  await set(id, entry, db());
  return entry;
}

export async function setStarred(id: string, starred: boolean): Promise<void> {
  const e = await get<HistoryEntry>(id, db());
  if (e) await set(id, { ...e, starred }, db());
}

export async function deleteEntry(id: string): Promise<void> {
  await del(id, db());
}

export async function clearHistory(): Promise<void> {
  await clear(db());
}
