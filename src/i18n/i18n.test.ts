import { de } from './de';
import { en } from './en';
import { translate } from './index';

describe('i18n', () => {
  it('has the same keys in every language', () => {
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
  });

  it('has no empty strings', () => {
    for (const dict of [en, de]) for (const v of Object.values(dict)) expect(v.trim()).not.toBe('');
  });

  it('translates and interpolates', () => {
    expect(translate('de', 'mode.explore')).toBe(de['mode.explore']);
    expect(translate('en', 'print.capped', { height: 180 })).toContain('180');
  });
});
