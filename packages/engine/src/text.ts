// Русские тексты-помощники: склонения, порядковые, сообщения об ошибках.
import type { SlotType } from './types';

function pluralForm(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

/** «1 монета», «3 монеты», «120 монет». */
export function coins(n: number): string {
  return `${n} ${pluralForm(n, 'монета', 'монеты', 'монет')}`;
}

/** Родительный падеж: «не хватает 1 монеты», «не хватает 120 монет». */
export function coinsGenitive(n: number): string {
  return `${n} ${pluralForm(n, 'монеты', 'монет', 'монет')}`;
}

/** «на 34-й неделе». */
export function weekOrdinal(n: number): string {
  return `${n}-й`;
}

export function notEnoughCash(missing: number): string {
  return `Не хватает ${coinsGenitive(missing)}`;
}

export const SLOT_FULL_TEXT: Record<SlotType, string> = {
  pier: 'На пирсе нет места',
  plot: 'На участках нет места',
  beach: 'На пляже нет места',
  plaza: 'На площади нет места',
  sea: 'В бухте нет места',
  finance: 'В банке нет места',
};

/** Все сообщения об отказе — в одном месте, чтобы UI и тесты могли на них опираться. */
export const ERRORS = {
  unknownPlayer: 'Такого игрока нет',
  unknownAction: 'Непонятное действие',
  offerGone: 'Это предложение уже ушло с доски',
  noSuchAsset: 'Такого объекта у тебя нет',
  notDamaged: 'Этот объект не повреждён',
  badAmount: 'Укажи сумму больше нуля',
  noCredit: 'Банк больше не даёт в долг',
  noSuchLoan: 'Такого кредита нет',
  studiedThisWeek: 'Учиться можно раз в неделю',
  maxKnowledge: 'Ты уже знаешь всё, чему здесь учат',
  restedThisWeek: 'Отдыхать можно раз в неделю',
  restDuringShift: 'В неделю подработки отдохнуть не выйдет',
  shiftAfterRest: 'Эта неделя — для отдыха, подработку уже не взять',
} as const;

export function needKnowledge(level: number): string {
  return `Нужно знание ${level}`;
}

export function loanOverLimit(limit: number): string {
  return `Банк даёт не больше ${coinsGenitive(limit)}`;
}
