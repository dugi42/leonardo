// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { defaultDesign } from '../../design/schema';
import { resetStore, useStore } from '../../state/store';
import { ExploreGrid, ExplorePanel } from './ExploreGrid';

vi.mock('../thumbnail', () => ({ renderThumbnail: vi.fn(async () => undefined) }));

beforeEach(() => {
  resetStore(defaultDesign(1));
  useStore.setState({ lang: 'en', explore: { tiles: [], selected: 0, temperature: 0.35, kind: 'shuffle' } });
});

const tiles = () => screen.getAllByRole('button', { name: /^Design \d+/ });

describe('ExploreGrid', () => {
  it('fills nine tiles on first visit', () => {
    render(<><ExploreGrid /><ExplorePanel /></>);
    expect(tiles()).toHaveLength(9);
  });

  it('shuffles to nine new designs that keep the print setup', () => {
    useStore.setState((s) => ({ design: { ...s.design, body: { ...s.design.body, kind: 'planter' } } }));
    render(<><ExploreGrid /><ExplorePanel /></>);
    const before = useStore.getState().explore.tiles.map((d) => d.seed);
    fireEvent.click(screen.getByRole('button', { name: 'Shuffle' }));
    const after = useStore.getState().explore.tiles;
    expect(after.map((d) => d.seed)).not.toEqual(before);
    expect(after.every((d) => d.body.kind === 'planter')).toBe(true);
  });

  it('puts the selected design in the centre and fills the rest with variations', () => {
    render(<><ExploreGrid /><ExplorePanel /></>);
    fireEvent.click(tiles()[2]);
    const parent = useStore.getState().explore.tiles[2];
    fireEvent.click(screen.getByRole('button', { name: 'Variations' }));
    const { tiles: next, selected } = useStore.getState().explore;
    expect(selected).toBe(4);
    expect(next[4]).toEqual(parent);
    expect(next.filter((d) => JSON.stringify(d) === JSON.stringify(parent))).toHaveLength(1);
  });

  it('labels the parent and its variations', () => {
    render(<><ExploreGrid /><ExplorePanel /></>);
    fireEvent.click(tiles()[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Variations' }));
    expect(screen.getByText('Parent')).toBeInTheDocument();
    expect(screen.getByText('Variation 1')).toBeInTheDocument();
    expect(screen.getByText('Variation 8')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Shuffle' }));
    expect(screen.queryByText('Parent')).toBeNull();
  });

  it('opens the selected design in Refine', () => {
    render(<><ExploreGrid /><ExplorePanel /></>);
    fireEvent.click(tiles()[5]);
    const chosen = useStore.getState().explore.tiles[5];
    fireEvent.click(screen.getByRole('button', { name: 'Refine this design' }));
    expect(useStore.getState().design).toEqual(chosen);
    expect(useStore.getState().mode).toBe('refine');
  });
});
