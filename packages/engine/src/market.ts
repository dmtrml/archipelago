// Рынок: рыба — блуждание с возвратом к 1.0, туризм — сезонная волна, плюс затухающие всплески.
import { clamp, round3 } from './economy';
import type { Rng } from './rng';
import * as R from './rules';
import type { MarketState } from './types';

export function seasonalTourism(week: number, shock: number): number {
  const wave = 1 + R.TOURISM_AMPLITUDE * Math.sin((2 * Math.PI * week) / R.TOURISM_PERIOD);
  return round3(clamp(wave + shock, R.TOURISM_MIN, R.TOURISM_MAX));
}

export function initialMarket(week: number): MarketState {
  return { fish: 1, tourism: seasonalTourism(week, 0), tourismShock: 0, fishShock: 0 };
}

/** Снимок рынка в начале обработки недели — нужен, чтобы отличить старые всплески от новых. */
export interface MarketSnapshot {
  fishBase: number;
  fishShock: number;
  tourismShock: number;
}

export function snapshotMarket(market: MarketState): MarketSnapshot {
  return {
    fishBase: market.fish - market.fishShock,
    fishShock: market.fishShock,
    tourismShock: market.tourismShock,
  };
}

/** Старый всплеск затухает, новый (добавленный событием на этой неделе) действует в полную силу. */
function settleShock(current: number, old: number): number {
  const value = round3(current - old * (1 - R.SHOCK_DECAY));
  return Math.abs(value) < 0.01 ? 0 : value;
}

/** Сдвиг рынка на новую неделю `week`. Мутирует market (вызывается на копии мира). */
export function advanceMarket(market: MarketState, snap: MarketSnapshot, week: number, rng: Rng): void {
  const drift = R.FISH_REVERT * (1 - snap.fishBase) + rng.range(-R.FISH_NOISE, R.FISH_NOISE);
  const fishBase = clamp(snap.fishBase + drift, R.FISH_MIN, R.FISH_MAX);
  market.fishShock = settleShock(market.fishShock, snap.fishShock);
  market.tourismShock = settleShock(market.tourismShock, snap.tourismShock);
  market.fish = round3(clamp(fishBase + market.fishShock, R.FISH_MIN, R.FISH_MAX));
  market.tourism = seasonalTourism(week, market.tourismShock);
}
