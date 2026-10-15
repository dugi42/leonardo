import { de } from './de';
import { en, type MessageKey } from './en';

export type Lang = 'en' | 'de';
export type { MessageKey };

const DICTS: Record<Lang, Record<MessageKey, string>> = { en, de };

export function translate(lang: Lang, key: MessageKey, vars?: Record<string, string | number>): string {
  const text = DICTS[lang][key];
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}

export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('leonardo.lang');
    if (saved === 'en' || saved === 'de') return saved;
  } catch {
    // storage blocked: fall through to the browser language
  }
  return typeof navigator !== 'undefined' && navigator.language?.startsWith('de') ? 'de' : 'en';
}

export function persistLang(lang: Lang) {
  try {
    localStorage.setItem('leonardo.lang', lang);
  } catch {
    // storage blocked: the choice lasts for this visit only
  }
}
