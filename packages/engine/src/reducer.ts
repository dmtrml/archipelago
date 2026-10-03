// Единая точка изменения мира. Чистая функция: вход не меняется никогда.
import { applyPlayerAction } from './actions';
import { runBots } from './bots';
import type { Action, ActionResult, WorldState } from './types';
import { settleWeek } from './week';

export function applyAction(world: WorldState, action: Action): ActionResult {
  if (action.type === 'endWeek') {
    // 1. Боты ходят после человека, 2–8. итоги недели.
    const bots = runBots(world);
    const own = bots.world === world ? structuredClone(world) : bots.world;
    return { world: settleWeek(own, bots.news) };
  }
  return applyPlayerAction(world, action);
}
