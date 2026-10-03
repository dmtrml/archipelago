import type { Sector } from '@arch/engine';

export const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU');

/** «+120» / «−45» с типографским минусом. */
export const signed = (n: number) => (Math.round(n) >= 0 ? '+' : '−') + fmt(Math.abs(n));

export function plural(n: number, [one, few, many]: [string, string, string]) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

export const weeks = (n: number) => `${n} ${plural(n, ['неделя', 'недели', 'недель'])}`;

export const SECTOR_NAME: Record<Sector, string> = {
  fish: 'рыба',
  tourism: 'туризм',
  stable: 'стабильный доход',
};

/** Понятная строка про рынок для игрока. */
export function marketLine(index: number, sector: 'fish' | 'tourism') {
  if (sector === 'fish') {
    if (index > 1.12) return { text: 'Рыба дорожает', tone: 'pos' as const };
    if (index < 0.88) return { text: 'Рыба дешевеет', tone: 'neg' as const };
    return { text: 'Рыба в цене', tone: 'neutral' as const };
  }
  if (index > 1.12) return { text: 'Туристов много', tone: 'pos' as const };
  if (index < 0.88) return { text: 'Туристов мало', tone: 'neg' as const };
  return { text: 'Туристы как обычно', tone: 'neutral' as const };
}
