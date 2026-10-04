// Новости недели для ленты: что сделали соседи и кто достиг свободы.
import { DEAL_ACCUSATIVE, UPGRADE_NAMES } from './content';
import { coins, weekOrdinal } from './text';
import type { PlayerState, WeekReport } from './types';

export type NewsItem = WeekReport['news'][number];

/** Род известен только у ботов; для человека подбираем безличные формулировки. */
const FEMALE_BOT_IDS: readonly string[] = ['bot-mia'];

function past(player: PlayerState, masculine: string, feminine: string): string {
  return FEMALE_BOT_IDS.includes(player.id) ? feminine : masculine;
}

/** Винительный падеж с учётом уровня: «рыбацкую лодку», «баркас», «траулер». */
function accusative(defId: string, level: number): string {
  return (level > 1 ? UPGRADE_NAMES[defId]?.[level - 2]?.accusative : undefined) ?? DEAL_ACCUSATIVE[defId];
}

export function boughtNews(player: PlayerState, defId: string): NewsItem {
  return { playerId: player.id, text: `${player.name} ${past(player, 'купил', 'купила')} ${DEAL_ACCUSATIVE[defId]}` };
}

export function soldNews(player: PlayerState, defId: string, level = 1): NewsItem {
  return { playerId: player.id, text: `${player.name} ${past(player, 'продал', 'продала')} ${accusative(defId, level)}` };
}

/** «Мия улучшила рыбацкую лодку — теперь это баркас». `fromLevel` — уровень до улучшения. */
export function upgradedNews(player: PlayerState, defId: string, fromLevel: number): NewsItem {
  const now = UPGRADE_NAMES[defId]?.[fromLevel - 1]?.nominative;
  const what = `${player.name} ${past(player, 'улучшил', 'улучшила')} ${accusative(defId, fromLevel)}`;
  return { playerId: player.id, text: now ? `${what} — теперь это ${now}` : what };
}

export function loanNews(player: PlayerState, amount: number): NewsItem {
  return { playerId: player.id, text: `${player.name} ${past(player, 'взял', 'взяла')} кредит: ${coins(amount)}` };
}

export function repayNews(player: PlayerState, amount: number): NewsItem {
  return { playerId: player.id, text: `${player.name} ${past(player, 'вернул', 'вернула')} долг: ${coins(amount)}` };
}

export function emergencyNews(player: PlayerState, amount: number): NewsItem {
  return { playerId: player.id, text: `${player.name} ${past(player, 'занял', 'заняла')} у ростовщика ${coins(amount)}` };
}

export function scamNews(player: PlayerState): NewsItem {
  return { playerId: player.id, text: `${player.name}: «жемчужная ферма» исчезла вместе с деньгами — это была пирамида` };
}

export function freedomNews(player: PlayerState, week: number): NewsItem {
  const text = player.isBot
    ? `${player.name} ${past(player, 'достиг', 'достигла')} свободы на ${weekOrdinal(week)} неделе!`
    : `${player.name}: финансовая свобода на ${weekOrdinal(week)} неделе!`;
  return { playerId: player.id, text };
}

export function dreamNews(player: PlayerState): NewsItem {
  return { playerId: player.id, text: `${player.name}: шхуна готова и уходит в кругосветку!` };
}
