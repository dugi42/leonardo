// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { defaultDesign } from '../../design/schema';
import { resetStore, useStore } from '../../state/store';
import { RefinePanel } from './RefinePanel';

beforeEach(() => {
  resetStore(defaultDesign(1));
  useStore.setState({ lang: 'en' });
});

describe('RefinePanel', () => {
  it('updates the recipe from a slider', () => {
    render(<RefinePanel />);
    fireEvent.change(screen.getByLabelText('Bulge'), { target: { value: '0.8' } });
    expect(useStore.getState().design.spectrum.recipe.bulge).toBe(0.8);
  });

  it('updates modifiers', () => {
    render(<RefinePanel />);
    fireEvent.change(screen.getByLabelText('Twist'), { target: { value: '1.5' } });
    expect(useStore.getState().design.modifiers.twist).toBe(1.5);
  });

  it('resets a slider to its default on double click', () => {
    render(<RefinePanel />);
    const input = screen.getByLabelText('Corners');
    fireEvent.change(input, { target: { value: '3' } });
    fireEvent.doubleClick(input);
    expect(useStore.getState().design.modifiers.edginess).toBe(0);
  });

  it('shows symmetry 0 as off', () => {
    render(<RefinePanel />);
    expect(screen.getByText('off')).toBeInTheDocument();
  });

  it('rerolls the seed but keeps the recipe', () => {
    render(<RefinePanel />);
    const before = useStore.getState().design;
    fireEvent.click(screen.getByRole('button', { name: 'Reroll' }));
    const after = useStore.getState().design;
    expect(after.seed).not.toBe(before.seed);
    expect(after.spectrum.recipe).toEqual(before.spectrum.recipe);
  });
});
