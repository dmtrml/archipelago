import { getDef } from '../src/economy';
import { freeSlotIndex } from '../src/economy';
import type { Offer, OwnedAsset, PlayerState, WorldState } from '../src/types';
import { createWorld } from '../src/world';

export function newWorld(seed = 42): WorldState {
  return createWorld({ seed, playerName: 'Аня', islandName: 'Чайка' });
}

export function player(world: WorldState, id = 'p1'): PlayerState {
  const p = world.players.find((x) => x.id === id);
  if (!p) throw new Error(`no player ${id}`);
  return p;
}

/** Мир только с человеком — без ботов, чтобы проверять механику в изоляции. */
export function soloWorld(seed = 42): WorldState {
  const world = newWorld(seed);
  world.players = [world.players[0]];
  return world;
}

/** Кладёт на доску конкретное предложение (по базовым числам сделки). */
export function putOffer(world: WorldState, defId: string, overrides: Partial<Offer> = {}): Offer {
  const def = getDef(defId);
  const offer: Offer = {
    uid: `test-o${world.nextUid++}`,
    defId,
    price: def.price,
    income: def.income,
    upkeep: def.upkeep,
    expiresWeek: world.week + 2,
    ...overrides,
  };
  world.offers.push(offer);
  return offer;
}

/** Выдаёт игроку объект напрямую (минуя покупку). */
export function giveAsset(world: WorldState, playerId: string, defId: string, overrides: Partial<OwnedAsset> = {}): OwnedAsset {
  const def = getDef(defId);
  const p = player(world, playerId);
  const asset: OwnedAsset = {
    uid: `test-a${world.nextUid++}`,
    defId,
    boughtWeek: world.week,
    price: def.price,
    income: def.income,
    upkeep: def.upkeep,
    level: 1,
    damaged: false,
    slotIndex: freeSlotIndex(p, def.slot) ?? 0,
    ...overrides,
  };
  p.owned.push(asset);
  return asset;
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

/** Все числа внутри значения — для поиска NaN/Infinity. */
export function badNumbers(value: unknown, path = '$'): string[] {
  if (typeof value === 'number') return Number.isFinite(value) ? [] : [path];
  if (Array.isArray(value)) return value.flatMap((v, i) => badNumbers(v, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => badNumbers(v, `${path}.${k}`));
  }
  return [];
}
