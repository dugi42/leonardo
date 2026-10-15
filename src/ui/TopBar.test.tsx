// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { defaultDesign } from '../design/schema';
import { resetStore, useStore } from '../state/store';
import { listHistory, clearHistory } from '../storage/history';
import { TopBar } from './TopBar';

const download = vi.fn();
const exportMock = vi.hoisted(() => ({ calls: 0, release: null as null | (() => void) }));
vi.mock('../worker/client', () => ({
  exportInBackground: vi.fn(async (_d: unknown, format: string) => {
    exportMock.calls++;
    if (exportMock.release === null) await Promise.resolve();
    else await new Promise<void>((r) => (exportMock.release = r));
    return { bytes: new Uint8Array([1]), name: `leonardo-1-solid.${format}`, mime: 'model/stl' };
  }),
  downloadBytes: (f: unknown) => download(f),
}));

beforeEach(async () => {
  resetStore(defaultDesign(1));
  useStore.setState({ lang: 'en' });
  download.mockReset();
  await clearHistory();
});

describe('TopBar', () => {
  it('makes a new design', async () => {
    render(<TopBar />);
    await userEvent.click(screen.getByRole('button', { name: 'New design' }));
    expect(useStore.getState().design.seed).not.toBe(1);
  });

  it('downloads an STL and keeps the design in history', async () => {
    render(<TopBar />);
    await userEvent.click(screen.getByRole('button', { name: /STL/ }));
    await waitFor(() => expect(download).toHaveBeenCalledWith(expect.objectContaining({ name: 'leonardo-1-solid.stl' })));
    await waitFor(async () => expect((await listHistory()).length).toBe(1));
  });

  it('ignores a second export click while one is running and shows it is busy', async () => {
    exportMock.calls = 0;
    exportMock.release = () => {};
    render(<TopBar />);
    const button = screen.getByRole('button', { name: /3MF/ });
    await userEvent.click(button);
    await userEvent.click(button);
    expect(exportMock.calls).toBe(1);
    expect(button).toHaveAttribute('aria-busy', 'true');
    exportMock.release!();
    await waitFor(() => expect(button).toHaveAttribute('aria-busy', 'false'));
    exportMock.release = null;
  });

  it('switches modes', async () => {
    render(<TopBar />);
    await userEvent.click(screen.getByRole('tab', { name: 'Print' }));
    expect(useStore.getState().mode).toBe('print');
    expect(screen.getByRole('tab', { name: 'Print' })).toHaveAttribute('aria-selected', 'true');
  });

  it('switches to German', async () => {
    render(<TopBar />);
    await userEvent.click(screen.getByRole('button', { name: 'Deutsch' }));
    expect(screen.getByRole('tab', { name: 'Drucken' })).toBeInTheDocument();
  });

  it('undoes a change', async () => {
    render(<TopBar />);
    await userEvent.click(screen.getByRole('button', { name: 'New design' }));
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(useStore.getState().design.seed).toBe(1);
  });
});
