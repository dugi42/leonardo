// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { encodeDesign } from '../design/codec';
import { randomDesign } from '../design/mutate';
import { defaultDesign } from '../design/schema';
import { resetStore, useStore } from '../state/store';
import { App } from './App';

vi.mock('./Viewport', () => ({ Viewport: () => <div data-testid="viewport" /> }));
vi.mock('./thumbnail', () => ({ renderThumbnail: vi.fn(async () => undefined) }));

beforeEach(() => {
  history.replaceState(null, '', '/');
  resetStore(defaultDesign(1));
  useStore.setState({ lang: 'en', explore: { tiles: [], selected: 0, temperature: 0.35 } });
});

describe('App', () => {
  it('renders the workspace', () => {
    render(<App />);
    expect(screen.getByText('Leonardo')).toBeInTheDocument();
    expect(screen.getByTestId('viewport')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Spectrum' })).toBeInTheDocument();
  });

  it('loads a design from the link', () => {
    const shared = randomDesign(4242);
    history.replaceState(null, '', `/#d=${encodeDesign(shared)}`);
    render(<App />);
    expect(useStore.getState().design).toEqual(shared);
  });

  it('keeps the current design and explains a broken link', () => {
    history.replaceState(null, '', '/#d=broken');
    render(<App />);
    expect(useStore.getState().design.seed).toBe(1);
    expect(screen.getByText(/no valid design/)).toBeInTheDocument();
  });

  it('writes the current design into the address bar', async () => {
    vi.useFakeTimers();
    render(<App />);
    act(() => useStore.getState().setDesign(randomDesign(99)));
    await act(async () => vi.advanceTimersByTime(500));
    expect(location.hash).toBe(`#d=${encodeDesign(useStore.getState().design)}`);
    vi.useRealTimers();
  });

  it('switches modes with number keys and shows the explore grid', () => {
    render(<App />);
    fireEvent.keyDown(window, { key: '1' });
    expect(useStore.getState().mode).toBe('explore');
    expect(screen.getAllByRole('button', { name: /^Design \d+/ })).toHaveLength(9);
    fireEvent.keyDown(window, { key: '3' });
    expect(screen.getByRole('radiogroup', { name: 'Body' })).toBeInTheDocument();
  });

  it('undoes with Ctrl+Z', () => {
    render(<App />);
    act(() => useStore.getState().newDesign());
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(useStore.getState().design.seed).toBe(1);
  });

  it('ignores shortcuts while typing in a field', () => {
    render(<App />);
    const input = screen.getByLabelText('Bulge');
    fireEvent.keyDown(input, { key: '1' });
    expect(useStore.getState().mode).toBe('refine');
  });
});
