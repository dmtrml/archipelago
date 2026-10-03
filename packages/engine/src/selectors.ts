// Производные данные для UI. Только чтение мира.
import {
  assetsValue, currentIncome, getDef, offerIncome, passiveIncome, repairCost, saleValue,
  slotUsage, totalDebt, weeklyExpenses, loanLimit as playerLoanLimit,
} from './economy';
import * as R from './rules';
import { SLOT_CAPACITY } from './slots';
import type {
  AssetView, FinanceView, LeaderboardRow, OfferView, PlayerState, WorldState,
} from './types';

export { insurancePremium, studyCost } from './economy';

export const SCAM_WARNING = 'Обещают слишком много — похоже на пирамиду';

/** Игрок по id. Неизвестный id — ошибка программиста, а не игрока. */
export function getPlayer(world: WorldState, playerId: string): PlayerState {
  const player = world.players.find((p) => p.id === playerId);
  if (!player) throw new Error(`Unknown player id: ${playerId}`);
  return player;
}

export function financeView(world: WorldState, playerId: string): FinanceView {
  const player = getPlayer(world, playerId);
  const salary = Math.round(player.salary * (player.extraShift ? 1 + R.EXTRA_SHIFT_BONUS : 1));
  const passive = passiveIncome(player, world.market);
  const expenses = weeklyExpenses(player);
  const debt = totalDebt(player);
  return {
    salary,
    passiveIncome: passive,
    expenses,
    net: salary + passive - expenses.total,
    freedomRatio: expenses.total > 0 ? passive / expenses.total : 0,
    netWorth: player.cash + assetsValue(player, world.market) - debt,
    debt,
  };
}

export function offerViews(world: WorldState, playerId: string): OfferView[] {
  const player = getPlayer(world, playerId);
  return world.offers.map((offer) => {
    const def = getDef(offer.defId);
    const expectedIncome = offerIncome(offer, world.market, player.knowledge);
    const net = expectedIncome - offer.upkeep;
    const view: OfferView = {
      offer,
      def,
      expectedIncome,
      upkeep: offer.upkeep,
      net,
      paybackWeeks: net > 0 ? Math.ceil(offer.price / net) : null,
      weeksLeft: offer.expiresWeek - world.week,
      locked: player.knowledge < def.minKnowledge,
      canAfford: player.cash >= offer.price,
      slotFull: slotUsage(player, def.slot) >= SLOT_CAPACITY[def.slot],
    };
    if (def.kind === 'scam' && player.knowledge >= R.SCAM_SIGHT_KNOWLEDGE) view.warning = SCAM_WARNING;
    return view;
  });
}

export function assetViews(world: WorldState, playerId: string): AssetView[] {
  const player = getPlayer(world, playerId);
  return player.owned.map((asset) => ({
    asset,
    def: getDef(asset.defId),
    currentIncome: currentIncome(asset, world.market, player.knowledge),
    upkeep: asset.upkeep,
    saleValue: saleValue(asset, world.market),
    repairCost: asset.damaged ? repairCost(asset) : 0,
  }));
}

export function leaderboard(world: WorldState): LeaderboardRow[] {
  const rows = world.players.map((player) => {
    const finance = financeView(world, player.id);
    const row: LeaderboardRow = {
      playerId: player.id,
      name: player.name,
      islandName: player.islandName,
      isBot: player.isBot,
      freedomRatio: finance.freedomRatio,
      netWorth: finance.netWorth,
      freedomWeek: player.freedomWeek,
    };
    if (player.botStyle) row.botStyle = player.botStyle;
    return row;
  });
  return rows.sort((a, b) => b.freedomRatio - a.freedomRatio || b.netWorth - a.netWorth);
}

/** Сколько ещё можно взять обычным кредитом (кратно 100). */
export function loanLimit(world: WorldState, playerId: string): number {
  return playerLoanLimit(getPlayer(world, playerId), world.market);
}
