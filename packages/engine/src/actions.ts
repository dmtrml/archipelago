// Действия игрока внутри недели (всё, кроме endWeek). Каждое либо целиком применяется, либо отказ.
import {
  freeSlotIndex, getDef, getDream, loanLimit, repairCost, saleValue, studyCost,
} from './economy';
import { nextUid } from './offers';
import { Rng } from './rng';
import * as R from './rules';
import {
  ERRORS, SLOT_FULL_TEXT, loanOverLimit, needKnowledge, notEnoughCash,
} from './text';
import type { Action, ActionResult, OwnedAsset, PlayerState, WorldState } from './types';

export type PlayerAction = Exclude<Action, { type: 'endWeek' }>;

/** Обработчик меняет копию мира; строка — причина отказа (копия тогда выбрасывается). */
type Handler<A extends PlayerAction> = (world: WorldState, player: PlayerState, action: A) => string | null;

const buyOffer: Handler<Extract<PlayerAction, { type: 'buyOffer' }>> = (world, player, action) => {
  const offer = world.offers.find((o) => o.uid === action.offerUid);
  if (!offer) return ERRORS.offerGone;
  const def = getDef(offer.defId);
  if (player.knowledge < def.minKnowledge) return needKnowledge(def.minKnowledge);
  const slotIndex = freeSlotIndex(player, def.slot);
  if (slotIndex === null) return SLOT_FULL_TEXT[def.slot];
  if (player.cash < offer.price) return notEnoughCash(offer.price - player.cash);

  player.cash -= offer.price;
  const asset: OwnedAsset = {
    uid: nextUid(world, 'a'),
    defId: offer.defId,
    boughtWeek: world.week,
    price: offer.price,
    income: offer.income,
    upkeep: offer.upkeep,
    damaged: false,
    slotIndex,
  };
  if (def.collapseWeeks) {
    // «Живёт» 2–5 недель, считая неделю покупки; в неделю краха уже не платит.
    const rng = new Rng(world.rng);
    asset.collapseWeek = world.week + rng.int(def.collapseWeeks[0], def.collapseWeeks[1]) - 1;
    world.rng = rng.state;
  }
  player.owned.push(asset);
  world.offers = world.offers.filter((o) => o.uid !== offer.uid);
  return null;
};

const sellAsset: Handler<Extract<PlayerAction, { type: 'sellAsset' }>> = (world, player, action) => {
  const asset = player.owned.find((a) => a.uid === action.assetUid);
  if (!asset) return ERRORS.noSuchAsset;
  player.cash += saleValue(asset, world.market);
  player.owned = player.owned.filter((a) => a.uid !== asset.uid);
  return null;
};

const repairAsset: Handler<Extract<PlayerAction, { type: 'repairAsset' }>> = (_world, player, action) => {
  const asset = player.owned.find((a) => a.uid === action.assetUid);
  if (!asset) return ERRORS.noSuchAsset;
  if (!asset.damaged) return ERRORS.notDamaged;
  const cost = repairCost(asset);
  if (player.cash < cost) return notEnoughCash(cost - player.cash);
  player.cash -= cost;
  asset.damaged = false;
  return null;
};

function isPositiveAmount(amount: unknown): amount is number {
  return typeof amount === 'number' && Number.isInteger(amount) && amount > 0;
}

const takeLoan: Handler<Extract<PlayerAction, { type: 'takeLoan' }>> = (world, player, action) => {
  if (!isPositiveAmount(action.amount)) return ERRORS.badAmount;
  const limit = loanLimit(player, world.market);
  if (limit <= 0) return ERRORS.noCredit;
  if (action.amount > limit) return loanOverLimit(limit);
  addLoan(world, player, action.amount, false);
  player.cash += action.amount;
  return null;
};

/** Обычные кредиты и долги ростовщику копятся в одной записи каждого вида. */
export function addLoan(world: WorldState, player: PlayerState, amount: number, emergency: boolean): void {
  const existing = player.loans.find((l) => l.emergency === emergency);
  if (existing) {
    existing.principal += amount;
    return;
  }
  player.loans.push({
    uid: nextUid(world, 'l'),
    principal: amount,
    weeklyRate: emergency ? R.EMERGENCY_RATE : R.LOAN_RATE,
    emergency,
  });
}

const repayLoan: Handler<Extract<PlayerAction, { type: 'repayLoan' }>> = (_world, player, action) => {
  const loan = player.loans.find((l) => l.uid === action.loanUid);
  if (!loan) return ERRORS.noSuchLoan;
  if (!isPositiveAmount(action.amount)) return ERRORS.badAmount;
  const pay = Math.min(action.amount, loan.principal); // больше долга не берём
  if (player.cash < pay) return notEnoughCash(pay - player.cash);
  player.cash -= pay;
  loan.principal -= pay;
  if (loan.principal === 0) player.loans = player.loans.filter((l) => l.uid !== loan.uid);
  return null;
};

const setInsurance: Handler<Extract<PlayerAction, { type: 'setInsurance' }>> = (_world, player, action) => {
  player.insured = action.on;
  return null;
};

const setExtraShift: Handler<Extract<PlayerAction, { type: 'setExtraShift' }>> = (_world, player, action) => {
  if (action.on && !player.employed) return ERRORS.shiftUnemployed;
  if (action.on && player.restedThisWeek) return ERRORS.shiftAfterRest;
  player.extraShift = action.on;
  return null;
};

const study: Handler<Extract<PlayerAction, { type: 'study' }>> = (_world, player) => {
  const cost = studyCost(player);
  if (cost === null) return ERRORS.maxKnowledge;
  if (player.studiedThisWeek) return ERRORS.studiedThisWeek;
  if (player.cash < cost) return notEnoughCash(cost - player.cash);
  player.cash -= cost;
  player.knowledge += 1;
  player.studiedThisWeek = true;
  return null;
};

const rest: Handler<Extract<PlayerAction, { type: 'rest' }>> = (_world, player) => {
  if (player.restedThisWeek) return ERRORS.restedThisWeek;
  if (player.extraShift) return ERRORS.restDuringShift;
  if (player.cash < R.REST_COST) return notEnoughCash(R.REST_COST - player.cash);
  player.cash -= R.REST_COST;
  player.happiness = Math.min(100, player.happiness + R.REST_JOY);
  player.restedThisWeek = true;
  return null;
};

// ───────────── Второй акт ─────────────

/** Возвращение на работу — своей волей или по угрозе свободе: зарплата ниже прежней, кратно 5. */
export function returnToJob(player: PlayerState): void {
  player.employed = true;
  player.threatWeeks = 0;
  player.salary = Math.max(5, Math.round((player.salary * R.RETURN_SALARY_MUL) / 5) * 5);
}

const quitJob: Handler<Extract<PlayerAction, { type: 'quitJob' }>> = (_world, player) => {
  if (player.freedomWeek === null) return ERRORS.quitBeforeFreedom;
  if (!player.employed) return ERRORS.alreadyQuit;
  player.employed = false;
  player.extraShift = false;
  player.threatWeeks = 0;
  return null;
};

const returnToWork: Handler<Extract<PlayerAction, { type: 'returnToWork' }>> = (_world, player) => {
  if (player.employed) return ERRORS.alreadyEmployed;
  returnToJob(player);
  return null;
};

const buildDream: Handler<Extract<PlayerAction, { type: 'buildDream' }>> = (_world, player) => {
  const dream = player.dream;
  if (!dream) return ERRORS.noDream;
  if (player.freedomWeek === null) return ERRORS.dreamBeforeFreedom;
  if (dream.doneWeek !== null) return ERRORS.dreamDone;
  if (dream.building) return ERRORS.dreamBusy;
  const stage = getDream(dream.id).stages[dream.built];
  if (player.cash < stage.cost) return notEnoughCash(stage.cost - player.cash);
  player.cash -= stage.cost;
  dream.building = true;
  dream.progress = 0;
  return null;
};

const HANDLERS: { [T in PlayerAction['type']]: Handler<Extract<PlayerAction, { type: T }>> } = {
  buyOffer, sellAsset, repairAsset, takeLoan, repayLoan, setInsurance, setExtraShift, study, rest,
  quitJob, returnToWork, buildDream,
};

export function applyPlayerAction(input: WorldState, action: PlayerAction): ActionResult {
  const handler = HANDLERS[action.type] as Handler<PlayerAction> | undefined;
  if (!handler) return { world: input, error: ERRORS.unknownAction };
  const world = structuredClone(input);
  const player = world.players.find((p) => p.id === action.playerId);
  if (!player) return { world: input, error: ERRORS.unknownPlayer };
  const error = handler(world, player, action);
  return error ? { world: input, error } : { world };
}
