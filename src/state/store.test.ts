import { defaultDesign } from '../design/schema';
import { resetStore, useStore } from './store';

const s = () => useStore.getState();
const bulge = () => s().design.spectrum.recipe.bulge;
const setBulge = (v: number) =>
  s().setDesign((d) => ({ ...d, spectrum: { ...d.spectrum, recipe: { ...d.spectrum.recipe, bulge: v } } }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  resetStore(defaultDesign(1));
});
afterEach(() => vi.useRealTimers());

describe('store', () => {
  it('normalises designs on the way in', () => {
    setBulge(9);
    expect(bulge()).toBe(1);
  });

  it('newDesign changes the seed and keeps body and print', () => {
    s().setDesign((d) => ({ ...d, body: { ...d.body, kind: 'hollow' } }));
    const before = s().design;
    s().newDesign();
    expect(s().design.seed).not.toBe(before.seed);
    expect(s().design.body).toEqual(before.body);
  });

  it('coalesces rapid changes into one undo step', () => {
    setBulge(0.1);
    vi.advanceTimersByTime(100);
    setBulge(0.2);
    vi.advanceTimersByTime(100);
    setBulge(0.3);
    s().undo();
    expect(bulge()).toBe(0.5);
  });

  it('undoes separate changes one at a time and redoes them', () => {
    setBulge(0.1);
    vi.advanceTimersByTime(1000);
    setBulge(0.2);
    s().undo();
    expect(bulge()).toBe(0.1);
    s().undo();
    expect(bulge()).toBe(0.5);
    s().redo();
    expect(bulge()).toBe(0.1);
  });

  it('clears redo after a new change and ignores no-op changes', () => {
    setBulge(0.1);
    vi.advanceTimersByTime(1000);
    s().undo();
    setBulge(0.5);
    expect(s().past.length).toBe(0);
    setBulge(0.4);
    expect(s().future.length).toBe(0);
  });

  it('switches mode and language', () => {
    s().setMode('print');
    s().setLang('de');
    expect(s().mode).toBe('print');
    expect(s().lang).toBe('de');
  });
});
