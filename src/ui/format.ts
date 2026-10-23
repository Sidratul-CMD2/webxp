/** XP-style short date and time in the browser's locale, e.g. 10/23/2026 6:41 AM. */
export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatLongDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return `${n} ${n === 1 ? word : pluralWord}`;
}
