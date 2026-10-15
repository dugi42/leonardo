// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { defaultDesign } from '../../design/schema';
import { ARCHETYPES } from '../../engine/profile';
import { resetStore, useStore } from '../../state/store';
import { FormSection } from './FormSection';

beforeEach(() => {
  resetStore(defaultDesign(1));
  useStore.setState({ lang: 'en' });
});
const form = () => useStore.getState().design.form;

describe('FormSection', () => {
  it('switches archetype and adopts its proportion', () => {
    render(<FormSection />);
    fireEvent.click(screen.getByRole('radio', { name: 'Bowl' }));
    expect(form().archetype).toBe('bowl');
    expect(form().proportion).toBe(ARCHETYPES.bowl.proportion);
  });

  it('draws a silhouette for every archetype', () => {
    render(<FormSection />);
    expect(screen.getAllByTestId('silhouette')).toHaveLength(Object.keys(ARCHETYPES).length);
  });

  it('sets proportion, rim and foot', () => {
    render(<FormSection />);
    fireEvent.change(screen.getByLabelText('Proportion'), { target: { value: '0.7' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Flared' }));
    fireEvent.change(screen.getByLabelText('Foot'), { target: { value: '0.5' } });
    expect(form()).toMatchObject({ proportion: 0.7, rim: 'flare', foot: 0.5 });
  });

  it('shows the proportion as slender or squat', () => {
    render(<FormSection />);
    fireEvent.change(screen.getByLabelText('Proportion'), { target: { value: '0.1' } });
    expect(screen.getByText('slender')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Proportion'), { target: { value: '0.9' } });
    expect(screen.getByText('squat')).toBeInTheDocument();
  });
});
