// Доска сделок: создание предложений, истечение и пополнение.
import { ASSET_DEFS, DEAL_WEIGHTS } from './content';
import type { Rng } from './rng';
import * as R from './rules';
import type { Offer, WorldState } from './types';

export function nextUid(world: WorldState, prefix: string): string {
  return `${prefix}${world.nextUid++}`;
}

function rollDefId(rng: Rng): string {
  const kind = rng.weighted(R.DEAL_KIND_WEIGHTS);
  return rng.weighted(DEAL_WEIGHTS[kind]);
}

function spread(rng: Rng, base: number, share: number): number {
  return base * rng.range(1 - share, 1 + share);
}

export function createOffer(world: WorldState, rng: Rng, defId: string = rollDefId(rng)): Offer {
  const def = ASSET_DEFS[defId];
  const price = Math.max(10, Math.round(spread(rng, def.price, R.OFFER_PRICE_SPREAD) / 10) * 10);
  const income = def.income > 0 ? Math.max(1, Math.round(spread(rng, def.income, R.OFFER_INCOME_SPREAD))) : 0;
  return {
    uid: nextUid(world, 'o'),
    defId,
    price,
    income,
    upkeep: def.upkeep,
    expiresWeek: world.week + R.OFFER_LIFETIME - 1,
  };
}

export function expireOffers(world: WorldState): void {
  world.offers = world.offers.filter((o) => o.expiresWeek >= world.week);
}

export function refillBoard(world: WorldState, rng: Rng): void {
  while (world.offers.length < R.BOARD_SIZE) world.offers.push(createOffer(world, rng));
}

/** Первая доска: гарантируем хотя бы один доступный новичку актив, чтобы было с чего начать. */
export function fillInitialBoard(world: WorldState, rng: Rng, startCash: number): void {
  refillBoard(world, rng);
  const hasStarter = world.offers.some((o) => {
    const def = ASSET_DEFS[o.defId];
    return def.kind === 'asset' && def.minKnowledge === 0 && o.price <= startCash;
  });
  if (!hasStarter) world.offers[0] = createOffer(world, rng, 'boat');
}
