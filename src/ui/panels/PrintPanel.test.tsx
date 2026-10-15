// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { defaultDesign } from '../../design/schema';
import { resetStore, useStore } from '../../state/store';
import { PrintPanel } from './PrintPanel';

beforeEach(() => {
  resetStore(defaultDesign(1));
  useStore.setState({ lang: 'en', showOverhang: false });
});

describe('PrintPanel', () => {
  it('shows wall and floor only for vessels', () => {
    render(<PrintPanel />);
    expect(screen.queryByLabelText('Wall')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Hollow' }));
    expect(useStore.getState().design.body.kind).toBe('hollow');
    expect(screen.getByLabelText('Wall')).toBeInTheDocument();
    expect(screen.queryByLabelText('Drainage hole')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Planter' }));
    expect(screen.getByLabelText('Drainage hole')).toBeInTheDocument();
  });

  it('explains vase mode', () => {
    render(<PrintPanel />);
    fireEvent.click(screen.getByRole('radio', { name: 'Vase mode' }));
    expect(screen.getByText(/Spiral vase/)).toBeInTheDocument();
  });

  it('warns when the printer forces a smaller size', () => {
    render(<PrintPanel />);
    fireEvent.change(screen.getByLabelText('Printer'), { target: { value: 'a1mini' } });
    fireEvent.change(screen.getByLabelText('Height'), { target: { value: '300' } });
    expect(screen.getByText(/Scaled down to 180 mm/)).toBeInTheDocument();
  });

  it('shows size and weight estimates', () => {
    render(<PrintPanel />);
    expect(screen.getByText('Size')).toBeInTheDocument();
    expect(screen.getByText(/ g$/)).toBeInTheDocument();
  });

  it('toggles the overhang view', () => {
    render(<PrintPanel />);
    fireEvent.click(screen.getByLabelText('Show overhangs'));
    expect(useStore.getState().showOverhang).toBe(true);
  });
});
