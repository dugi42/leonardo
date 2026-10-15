import { randomDesign } from '../design/mutate';
import { clearHistory, deleteEntry, listHistory, saveDesign, setStarred } from './history';

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  await clearHistory();
});
afterEach(() => vi.useRealTimers());

describe('history', () => {
  it('lists saved designs newest first', async () => {
    vi.setSystemTime(1000);
    await saveDesign(randomDesign(1));
    vi.setSystemTime(2000);
    await saveDesign(randomDesign(2));
    const list = await listHistory();
    expect(list.map((e) => e.design.seed)).toEqual([2, 1]);
    expect(list[0].created).toBe(2000);
  });

  it('saving the same design again updates it instead of duplicating', async () => {
    vi.setSystemTime(1000);
    const first = await saveDesign(randomDesign(1));
    await setStarred(first.id, true);
    vi.setSystemTime(5000);
    await saveDesign(randomDesign(1), 'data:image/png;base64,xx');
    const list = await listHistory();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ starred: true, created: 5000, thumb: 'data:image/png;base64,xx' });
  });

  it('stars and deletes entries', async () => {
    const e = await saveDesign(randomDesign(3));
    await setStarred(e.id, true);
    expect((await listHistory())[0].starred).toBe(true);
    await deleteEntry(e.id);
    expect(await listHistory()).toEqual([]);
  });
});
