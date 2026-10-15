// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { defaultDesign } from '../../design/schema';
import { KMAX, MMAX } from '../../engine/constants';
import { resetStore, useStore } from '../../state/store';
import { kilnColor } from './kiln';
import { SpectrumEditor } from './SpectrumEditor';

const CELL = 10;
beforeAll(() => {
  // jsdom has no layout: give the heatmap a fixed 1 cell = 10 px box.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width: MMAX * CELL, height: KMAX * CELL, right: MMAX * CELL, bottom: KMAX * CELL, x: 0, y: 0, toJSON: () => ({}),
  } as DOMRect);
});

beforeEach(() => {
  resetStore(defaultDesign(1));
  useStore.setState({ lang: 'en' });
});

/** Client coordinates of the centre of cell (k, m); k = 0 is the bottom row. */
const at = (k: number, m: number) => ({ clientX: (m + 0.5) * CELL, clientY: (KMAX - k - 0.5) * CELL, pointerId: 1 });

describe('SpectrumEditor', () => {
  it('drags the kept rectangle corner to set K and M', () => {
    render(<SpectrumEditor />);
    const map = screen.getByRole('img', { name: 'Spectrum' });
    expect(screen.getByRole('radio', { name: 'Resize' })).toBeChecked();
    fireEvent.pointerDown(map, at(7, 11));
    fireEvent.pointerMove(map, at(5, 7));
    fireEvent.pointerUp(map, at(5, 7));
    expect(useStore.getState().design.spectrum.K).toBe(6);
    expect(useStore.getState().design.spectrum.M).toBe(8);
  });

  it('boosts a cell with the boost brush and resets edits', () => {
    render(<SpectrumEditor />);
    fireEvent.click(screen.getByRole('radio', { name: 'Boost' }));
    const map = screen.getByRole('img', { name: 'Spectrum' });
    fireEvent.pointerDown(map, at(2, 3));
    fireEvent.pointerUp(map, at(2, 3));
    expect(useStore.getState().design.spectrum.edits).toEqual({ '2,3': 1.25 });
    fireEvent.click(screen.getByRole('button', { name: 'Reset edits' }));
    expect(useStore.getState().design.spectrum.edits).toEqual({});
  });

  it('damps each cell once per stroke', () => {
    render(<SpectrumEditor />);
    fireEvent.click(screen.getByRole('radio', { name: 'Damp' }));
    const map = screen.getByRole('img', { name: 'Spectrum' });
    fireEvent.pointerDown(map, at(1, 1));
    fireEvent.pointerMove(map, at(1, 1));
    fireEvent.pointerMove(map, at(1, 2));
    fireEvent.pointerUp(map, at(1, 2));
    expect(useStore.getState().design.spectrum.edits).toEqual({ '1,1': 0.8, '1,2': 0.8 });
  });

  it('never edits the mean term', () => {
    render(<SpectrumEditor />);
    fireEvent.click(screen.getByRole('radio', { name: 'Boost' }));
    const map = screen.getByRole('img', { name: 'Spectrum' });
    fireEvent.pointerDown(map, at(0, 0));
    fireEvent.pointerUp(map, at(0, 0));
    expect(useStore.getState().design.spectrum.edits).toEqual({});
  });
});

describe('kilnColor', () => {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  };
  it('gets brighter with magnitude', () => {
    const steps = Array.from({ length: 11 }, (_, i) => lum(kilnColor(i / 10)));
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThan(steps[i - 1]);
  });
});
