// Небольшие текстовые помощники второго акта. Числа правил берём только из движка.
import { DREAM_WORK_EMPLOYED, DREAM_WORK_FREE, RETURN_SALARY_MUL } from '@arch/engine';
import { days, getI18n, levelTitle as localizedLevelTitle } from '../i18n';

export const percent = (ratio: number) => Math.round(ratio * 100);

export const daysText = days;

export const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Первое предложение описания — для компактных блоков. */
export function firstSentence(text: string): string {
  const i = text.search(/[.!?](\s|$)/);
  return i < 0 ? text : text.slice(0, i + 1);
}

/** «в 3 раза быстрее»: во сколько раз стройка без работы быстрее, чем на работе. */
export function speedUpText(): string {
  const k = Math.round(DREAM_WORK_FREE / DREAM_WORK_EMPLOYED);
  return getI18n().t.ui.speedUp(k);
}

/** Название уровня свободы; 0 — свобода уже была, но сейчас доход ниже расходов. */
export function levelTitle(level: number): string {
  return localizedLevelTitle(level);
}

/** Родительный падеж названий уровней: «Свобода» → «Свободы», «Уверенность» → «Уверенности», «Богатство» → «Богатства». */
/** Зарплата после возвращения на работу — то же округление, что в движке (кратно 5, не меньше 5). */
export const returnSalary = (salary: number) => Math.max(5, Math.round((salary * RETURN_SALARY_MUL) / 5) * 5);
