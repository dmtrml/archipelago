// Миграция сохранений: старый мир (версии 1 или 2) превращается в текущий (версия 3) по цепочке 1 → 2 → 3.
// Вход — «сырой» JSON из localStorage, поэтому всё проверяем руками; непонятное — null.
import { DREAMS } from './content';
import type { WorldState } from './types';
import { newDreamState } from './world';

type Obj = Record<string, unknown>;

function isObj(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNum(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Минимум, без которого движок не сможет играть мир (поля, общие для версий 1 и 2). */
function isPlayerBase(value: unknown): value is Obj {
  return isObj(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.isBot === 'boolean'
    && isNum(value.cash) && isNum(value.salary) && isNum(value.living)
    && isNum(value.happiness) && isNum(value.knowledge)
    && Array.isArray(value.owned) && Array.isArray(value.loans)
    && (value.freedomWeek === null || isNum(value.freedomWeek));
}

function isDreamState(value: unknown): boolean {
  return isObj(value)
    && typeof value.id === 'string' && value.id in DREAMS
    && isNum(value.built) && typeof value.building === 'boolean' && isNum(value.progress)
    && (value.doneWeek === null || isNum(value.doneWeek));
}

/** Игрок версии 2: поля второго акта обязаны быть на месте. */
function isPlayerV2(value: unknown): value is Obj & { owned: unknown[] } {
  return isPlayerBase(value)
    && typeof value.employed === 'boolean'
    && isNum(value.threatWeeks) && isNum(value.bestLevel)
    && (value.dream === null || isDreamState(value.dream));
}

/** Уровень улучшения: целое число от 1. */
function isLevel(value: unknown): boolean {
  return isNum(value) && Number.isInteger(value) && value >= 1;
}

/** Игрок версии 3: у каждого объекта на острове есть уровень улучшения. */
function isPlayerV3(value: unknown): boolean {
  return isPlayerV2(value) && value.owned.every((a) => isObj(a) && isLevel(a.level));
}

/** 1 → 2: все остаются на работе, уже достигнутая свобода — первый уровень, мечта только у человека. */
function v1ToV2(players: Obj[]): void {
  players.forEach((p, i) => {
    p.employed = true;
    p.threatWeeks = 0;
    p.bestLevel = p.freedomWeek !== null ? 1 : 0;
    p.dream = i === 0 && p.isBot === false ? newDreamState() : null;
  });
}

/** 2 → 3: всё купленное раньше — первого уровня (улучшений тогда не было). false — непонятный объект. */
function v2ToV3(players: (Obj & { owned: unknown[] })[]): boolean {
  for (const p of players) {
    for (const a of p.owned) {
      if (!isObj(a)) return false;
      if (!isNum(a.level)) a.level = 1;
    }
  }
  return players.every(isPlayerV3);
}

function isWorldBase(raw: unknown): raw is Obj & { players: unknown[] } {
  return isObj(raw)
    && isNum(raw.seed) && isNum(raw.rng) && isNum(raw.nextUid) && isNum(raw.week)
    && isObj(raw.market)
    && isNum(raw.market.fish) && isNum(raw.market.tourism)
    && isNum(raw.market.fishShock) && isNum(raw.market.tourismShock)
    && Array.isArray(raw.offers)
    && (raw.lastReport === null || isObj(raw.lastReport))
    && Array.isArray(raw.players) && raw.players.length > 0;
}

/**
 * Принимает сохранённый мир версии 1, 2 или 3 и возвращает мир версии 3 (копию, вход не меняется).
 * Версия 1 сначала становится версией 2: игрок-человек (первый, не бот) получает чистую мечту,
 * все остаются на работе, уже достигнутая свобода считается первым уровнем.
 * Версия 2 становится версией 3: всё купленное — первого уровня. Всё непонятное — null.
 */
export function migrateWorld(raw: unknown): WorldState | null {
  if (!isWorldBase(raw)) return null;
  const version = raw.version;
  if (version !== 1 && version !== 2 && version !== 3) return null;

  let world: Obj;
  try {
    world = structuredClone(raw) as Obj;
  } catch {
    return null;
  }
  const players = world.players as unknown[];

  if (version === 3) {
    return players.every(isPlayerV3) ? (world as unknown as WorldState) : null;
  }

  if (version === 1) {
    if (!players.every(isPlayerBase)) return null;
    v1ToV2(players);
  }
  if (!players.every(isPlayerV2) || !v2ToV3(players)) return null;
  world.version = 3;
  return world as unknown as WorldState;
}
