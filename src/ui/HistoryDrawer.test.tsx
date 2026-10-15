// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { randomDesign } from '../design/mutate';
import { defaultDesign } from '../design/schema';
import { resetStore, useStore } from '../state/store';
import { clearHistory, listHistory, saveDesign } from '../storage/history';
import { HistoryDrawer } from './HistoryDrawer';

beforeEach(async () => {
  resetStore(defaultDesign(1));
  useStore.setState({ lang: 'en' });
  await clearHistory();
});

describe('HistoryDrawer', () => {
  it('invites saving when empty', async () => {
    render(<HistoryDrawer open onClose={() => {}} />);
    expect(await screen.findByText(/Saved designs appear here/)).toBeInTheDocument();
  });

  it('opens a saved design', async () => {
    await saveDesign(randomDesign(77));
    const onClose = vi.fn();
    render(<HistoryDrawer open onClose={onClose} />);
    fireEvent.click(await screen.findByRole('button', { name: /Open #77/ }));
    expect(useStore.getState().design.seed).toBe(77);
    expect(onClose).toHaveBeenCalled();
  });

  it('stars, filters and deletes', async () => {
    await saveDesign(randomDesign(1));
    await saveDesign(randomDesign(2));
    render(<HistoryDrawer open onClose={() => {}} />);
    const stars = await screen.findAllByRole('button', { name: 'Add to favorites' });
    fireEvent.click(stars[0]);
    await screen.findByRole('button', { name: 'Remove from favorites' });
    fireEvent.click(screen.getByLabelText('Favorites only'));
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^Open/ })).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(async () => expect(await listHistory()).toHaveLength(1));
  });
});
