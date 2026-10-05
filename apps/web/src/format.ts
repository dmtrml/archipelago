import type { Sector } from '@arch/engine';
import { getI18n, marketLine as localizedMarketLine, sectorName, weeks as localizedWeeks, weeksAcc as localizedWeeksAcc } from './i18n';

export const fmt = (n: number) => getI18n().fmt(n);
export const signed = (n: number) => getI18n().signed(n);
export function plural(n: number, [one, few, many]: [string, string, string]) {
  return getI18n().plural(n, { one, few, many, other: many });
}
export const weeks = localizedWeeks;
export const weeksAcc = localizedWeeksAcc;
export const sectorLabel = (sector: Sector) => sectorName(sector);
export const marketLine = localizedMarketLine;
