import type { Design } from '../design/schema';
import { exportFile, type ExportedFile, type Format } from './exportFile';

let worker: Worker | null = null;
let nextId = 1;

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  worker ??= new Worker(new URL('./export.worker.ts', import.meta.url), { type: 'module' });
  return worker;
}

/** Builds the export file off the main thread; falls back to the main thread if workers fail. */
export function exportInBackground(design: Design, format: Format): Promise<ExportedFile> {
  const w = getWorker();
  if (!w) return Promise.resolve().then(() => exportFile(design, format));
  const id = nextId++;
  return new Promise<ExportedFile>((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.id !== id) return;
      w.removeEventListener('message', onMessage);
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.file);
    };
    w.addEventListener('message', onMessage);
    w.postMessage({ id, design, format });
  }).catch((err: Error) => {
    // Mesh validation errors are real; anything else (worker crash) retries on this thread.
    if (/closed|orientation|volume|non-finite/.test(err.message)) throw err;
    return exportFile(design, format);
  });
}

export function downloadBytes(file: ExportedFile) {
  const blob = new Blob([file.bytes as BlobPart], { type: file.mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
