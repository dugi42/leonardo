/// <reference lib="webworker" />
import type { Design } from '../design/schema';
import { exportFile, type Format } from './exportFile';

self.onmessage = (event: MessageEvent<{ id: number; design: Design; format: Format }>) => {
  const { id, design, format } = event.data;
  try {
    const file = exportFile(design, format);
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({ id, file }, [file.bytes.buffer]);
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
