// Балансовый симулятор: много сидов × много недель, статистика по стилям игры.
// Три таблицы: первый акт (путь к свободе), «Второй акт» (три стратегии после свободы: остаться на работе,
// уйти сразу, уйти при 150%) и «Улучшения» (разумный игрок с улучшениями и без них).
// Цели печатаются как OK/FAIL; при любом FAIL код выхода 1.
// Запуск: npm run sim -w @arch/engine [-- --seeds 500 --weeks 100]
import type { PlayerAction } from '../src/actions';
import { runBotTurn, type Policy } from '../src/bots';
import {
  getDef, getDream, isSlotFull, realFreedomRatio, realPassiveIncome, studyCost,
} from '../src/economy';
import { applyAction } from '../src/reducer';
import * as R from '../src/rules';
import { assetViews, dreamView, financeView, offerViews } from '../src/selectors';
import type { PlayerState, WorldState } from '../src/types';
import { createWorld, HUMAN_ID } from '../src/world';

// ───────────── Политики «человека» ─────────────

/** Улучшение, которое окупается дольше, разумный игрок не делает вовсе. */
const UPGRADE_MAX_PAYBACK = 30;
/** Окупается так быстро, что его стоит сделать, даже пока на острове есть место. */
const UPGRADE_GOOD_PAYBACK = 20;

interface SensibleOptions {
  /** Шаг между «хозяйством» и покупками: игроки второго акта пробуют мечту раньше, чем потратят деньги. */
  beforeBuying?: Policy;
  /** Сколько монет не трогать ради улучшений (сверх обычного запаса): так копят на мечту. */
  upgradeReserve?: (me: PlayerState) => number;
  /** false — разумный игрок, который никогда не улучшает своё (сравнительный прогон). */
  upgrades?: boolean;
}

/**
 * Улучшение своего: когда места этого типа кончились (иначе расти негде) или когда оно окупается не хуже
 * хорошей сделки. Самое быстрое по окупаемости — первым, с тем же запасом монет, что и при покупке.
 */
function sensibleUpgrade(world: WorldState, me: PlayerState, buffer: number): PlayerAction | null {
  const best = assetViews(world, me.id)
    .flatMap((v) => (v.upgrade?.canUpgrade && v.upgrade.paybackWeeks !== null
      ? [{ uid: v.asset.uid, slot: v.def.slot, cost: v.upgrade.cost, payback: v.upgrade.paybackWeeks }]
      : []))
    .filter((u) => me.cash - u.cost >= buffer && u.payback <= UPGRADE_MAX_PAYBACK)
    .filter((u) => isSlotFull(me, u.slot) || u.payback <= UPGRADE_GOOD_PAYBACK)
    .sort((a, b) => a.payback - b.payback)[0];
  return best ? { type: 'upgradeAsset', playerId: me.id, assetUid: best.uid } : null;
}

/**
 * Разумный игрок: окупаемые активы, учится один раз, страхуется, иногда отдыхает, одна недорогая радость;
 * когда места на острове кончаются — улучшает своё. Учится он только до знания 1, поэтому консервный
 * заводик и ресторан на сваях (знание 2) ему закрыты — как и доли в артели, которые изменили бы сравнение
 * «с улучшениями и без».
 */
function makeSensible({ beforeBuying, upgradeReserve, upgrades = true }: SensibleOptions = {}): Policy {
  return (world, me) => {
    const buffer = 80;
    const damaged = me.owned.find((a) => a.damaged && me.cash - Math.round(a.price * R.REPAIR_SHARE) >= buffer);
    if (damaged) return { type: 'repairAsset', playerId: me.id, assetUid: damaged.uid };
    const emergency = me.loans.find((l) => l.emergency);
    if (emergency && me.cash > buffer) {
      return { type: 'repayLoan', playerId: me.id, loanUid: emergency.uid, amount: Math.min(emergency.principal, me.cash - buffer) };
    }
    const cost = studyCost(me);
    if (me.knowledge === 0 && !me.studiedThisWeek && cost !== null && me.cash >= cost + 250) {
      return { type: 'study', playerId: me.id };
    }
    const stormProne = me.owned.some((a) => getDef(a.defId).stormRisk >= 0.2);
    if (stormProne && !me.insured) return { type: 'setInsurance', playerId: me.id, on: true };
    if (me.happiness < 35 && !me.restedThisWeek && me.cash >= R.REST_COST + buffer) return { type: 'rest', playerId: me.id };

    const extra = beforeBuying?.(world, me);
    if (extra) return extra;

    const views = offerViews(world, me.id);
    const best = views
      .filter((v) => !v.locked && !v.slotFull && !v.warning && v.def.kind !== 'status')
      .filter((v) => v.paybackWeeks !== null && v.paybackWeeks <= 35 && me.cash - v.offer.price >= buffer)
      .sort((a, b) => (a.paybackWeeks ?? 0) - (b.paybackWeeks ?? 0))[0];
    if (best) return { type: 'buyOffer', playerId: me.id, offerUid: best.offer.uid };

    const ownsStatus = me.owned.some((a) => getDef(a.defId).kind === 'status');
    const garden = views.find((v) => v.def.id === 'garden' && !v.slotFull && me.cash >= v.offer.price + 400);
    if (!ownsStatus && garden) return { type: 'buyOffer', playerId: me.id, offerUid: garden.offer.uid };

    return upgrades ? sensibleUpgrade(world, me, buffer + (upgradeReserve?.(me) ?? 0)) : null;
  };
}

const sensible: Policy = makeSensible();
/** Тот же разумный игрок, но никогда не улучшает своё: с ним сравниваем, что дают улучшения. */
const noUpgrades: Policy = makeSensible({ upgrades: false });

/** Ничего не делает. Свобода недостижима. */
const idle: Policy = () => null;

/** Трудоголик: покупает как разумный, но каждую неделю на подработке и никогда не отдыхает. */
const grinder: Policy = (world, me) => {
  if (!me.extraShift) return { type: 'setExtraShift', playerId: me.id, on: true };
  const action = sensible(world, { ...me, happiness: 100 });
  return action && action.type !== 'rest' ? action : null;
};

const HUMAN_POLICIES: Record<string, Policy> = { sensible, 'no-upgrades': noUpgrades, idle, grinder };

// ───────────── Политики второго акта ─────────────

/** Запас, который игрок оставляет после оплаты этапа мечты. */
const DREAM_RESERVE = 150;

/** Следующий этап мечты — как только его можно начать и после оплаты остаётся запас. */
const startDreamStage: Policy = (world, me) => {
  const dream = me.dream;
  if (me.freedomWeek === null || !dream || dream.building || dream.doneWeek !== null) return null;
  // Дешёвый отсев по деньгам: dreamView копирует игрока, а вызывается на каждый шаг каждой недели.
  const stageCost = getDream(dream.id).stages[dream.built]?.cost;
  if (stageCost === undefined || me.cash - stageCost < DREAM_RESERVE) return null;
  return dreamView(world, me.id)?.canStart ? { type: 'buildDream', playerId: me.id } : null;
};

/**
 * Пока мечта не готова, деньги на её следующий неоплаченный этап не идут на улучшения.
 * До свободы мечту строить нельзя, и копить на неё незачем — тогда запаса нет.
 */
const dreamSavings = (me: PlayerState): number => {
  const dream = me.dream;
  if (me.freedomWeek === null || !dream || dream.doneWeek !== null) return 0;
  const next = dream.building ? dream.built + 1 : dream.built;
  return getDream(dream.id).stages[next]?.cost ?? 0;
};

/**
 * Разумный игрок после свободы строит мечту; `quitRatio` — при какой настоящей доле свободы он уходит с работы
 * (null — не уходит). Уходит и заново после вынужденного возвращения, когда доля снова достаточна.
 */
function dreamer(quitRatio: number | null): Policy {
  const base = makeSensible({ beforeBuying: startDreamStage, upgradeReserve: dreamSavings });
  return (world, me) => {
    if (quitRatio !== null && me.employed && me.freedomWeek !== null && realFreedomRatio(me, world.market) >= quitRatio) {
      return { type: 'quitJob', playerId: me.id };
    }
    return base(world, me);
  };
}

const stayAtWork = dreamer(null);
const quitAtFreedom = dreamer(1);
const quitAt150 = dreamer(1.5);

const ACT_LABELS = {
  stay: 'остался на работе',
  quitNow: 'ушёл сразу',
  quit150: 'ушёл при 150%',
};

const SECOND_ACT_POLICIES: [label: string, policy: Policy][] = [
  [ACT_LABELS.stay, stayAtWork],
  [ACT_LABELS.quitNow, quitAtFreedom],
  [ACT_LABELS.quit150, quitAt150],
];

// ───────────── Прогон ─────────────

interface Outcome {
  freedomWeek: number | null;
  debt: number;
  burnouts: number;
  emergencyWeeks: number;
  netWorth: number;
  scamsLost: number;
  // Второй акт.
  dreamWeek: number | null;   // неделя, когда мечта готова
  forcedReturns: number;      // сколько раз пришлось вернуться на работу (событие backToWork)
  quitAfterFreedom: boolean;  // хоть раз был без работы после свободы
  joySum: number;             // сумма счастья по неделям после свободы
  joyWeeks: number;           // сколько было таких недель
  // Улучшения.
  bestLevel: number;          // высший уровень свободы за игру (0..3)
  passive: number;            // настоящий пассивный доход в неделю к концу игры
  upgrades: number;           // сколько раз человек улучшал своё
}

function hasNaN(value: unknown): boolean {
  if (typeof value === 'number') return !Number.isFinite(value);
  if (Array.isArray(value)) return value.some(hasNaN);
  if (value && typeof value === 'object') return Object.values(value).some(hasNaN);
  return false;
}

function runGame(seed: number, weeks: number, humanPolicy: Policy): Map<string, Outcome> {
  let world: WorldState = createWorld({ seed, playerName: 'Игрок', islandName: 'Тест' });
  const stats = new Map<string, Outcome>(world.players.map((p) => [p.id, {
    freedomWeek: null, debt: 0, burnouts: 0, emergencyWeeks: 0, netWorth: 0, scamsLost: 0,
    dreamWeek: null, forcedReturns: 0, quitAfterFreedom: false, joySum: 0, joyWeeks: 0,
    bestLevel: 0, passive: 0, upgrades: 0,
  }]));
  for (let w = 0; w < weeks; w++) {
    const turn = runBotTurn(world, HUMAN_ID, humanPolicy);
    if (turn.errors.length) throw new Error(`seed ${seed}: ${turn.errors.join('; ')}`);
    stats.get(HUMAN_ID)!.upgrades += turn.actions.filter((a) => a.type === 'upgradeAsset').length;
    const result = applyAction(turn.world, { type: 'endWeek' });
    if (result.error) throw new Error(result.error);
    world = result.world;
    for (const [id, report] of Object.entries(world.lastReport!.players)) {
      const s = stats.get(id)!;
      if (report.events.some((e) => e.id === 'burnout')) s.burnouts++;
      if (report.events.some((e) => e.id === 'emergencyLoan')) s.emergencyWeeks++;
      s.scamsLost += report.lostAssetUids.length;
      if (report.events.some((e) => e.id === 'backToWork')) s.forcedReturns++;
    }
    // Счастье «после свободы»: недели, следующие за той, в которую свобода достигнута.
    for (const p of world.players) {
      if (p.freedomWeek === null || world.lastReport!.week <= p.freedomWeek) continue;
      const s = stats.get(p.id)!;
      s.joySum += p.happiness;
      s.joyWeeks++;
      if (!p.employed) s.quitAfterFreedom = true;
    }
  }
  if (hasNaN(world)) throw new Error(`NaN in world, seed ${seed}`);
  for (const p of world.players) {
    const s = stats.get(p.id)!;
    s.freedomWeek = p.freedomWeek;
    s.dreamWeek = p.dream?.doneWeek ?? null;
    const f = financeView(world, p.id);
    s.debt = f.debt;
    s.netWorth = f.netWorth;
    s.bestLevel = p.bestLevel;
    s.passive = realPassiveIncome(p, world.market);
  }
  return stats;
}

function percentile(sorted: number[], q: number): number {
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[i];
}

interface Summary {
  median: number;
  p25: number;
  p75: number;
  freePct: number;
  debtPct: number;
  burnouts: number;
  scams: number;
  netWorth: number;
}

function summarize(outcomes: Outcome[]): Summary {
  // Не достигшие свободы считаются «бесконечностью»: медиана честно показывает «>100».
  const times = outcomes.map((o) => o.freedomWeek ?? Infinity).sort((a, b) => a - b);
  const share = (f: (o: Outcome) => boolean) => Math.round((100 * outcomes.filter(f).length) / outcomes.length);
  const avg = (f: (o: Outcome) => number) => outcomes.reduce((s, o) => s + f(o), 0) / outcomes.length;
  return {
    median: percentile(times, 0.5),
    p25: percentile(times, 0.25),
    p75: percentile(times, 0.75),
    freePct: share((o) => o.freedomWeek !== null),
    debtPct: share((o) => o.debt > 0),
    burnouts: Math.round(avg((o) => o.burnouts)),
    scams: Math.round(avg((o) => o.scamsLost) * 10) / 10,
    netWorth: Math.round(avg((o) => o.netWorth)),
  };
}

function formatRow(label: string, s: Summary, weeks: number): string {
  const w = (n: number) => (Number.isFinite(n) ? String(n) : `>${weeks}`);
  return [
    label.padEnd(20),
    w(s.median).padStart(6), w(s.p25).padStart(6), w(s.p75).padStart(6),
    `${s.freePct}%`.padStart(6), `${s.debtPct}%`.padStart(6),
    String(s.burnouts).padStart(8), String(s.scams).padStart(6), String(s.netWorth).padStart(9),
  ].join(' ');
}

// ───────────── Второй акт: сводка и таблица ─────────────

interface ActSummary {
  freedomMedian: number;  // неделя свободы (медиана)
  dreamMedian: number;    // неделя готовности мечты (медиана; нет мечты = бесконечность)
  gapMedian: number;      // недель от свободы до мечты (медиана среди достигших свободы)
  dreamPct: number;       // % игр, где мечта готова к последней неделе
  forcedAvg: number;      // вынужденных возвратов на игру
  forcedPct: number;      // % игр хотя бы с одним возвратом
  quitPct: number;        // % игр, где игрок хоть раз ушёл с работы (и значит, стратегия вообще сработала)
  happiness: number;      // среднее счастье по неделям после свободы
  netWorth: number;       // средний капитал в конце
}

function summarizeSecondAct(outcomes: Outcome[]): ActSummary {
  const pct = (n: number) => (100 * n) / outcomes.length;
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const sorted = (xs: number[]) => xs.sort((a, b) => a - b);
  const free = outcomes.filter((o) => o.freedomWeek !== null);
  const gaps = free.map((o) => (o.dreamWeek === null ? Infinity : o.dreamWeek - o.freedomWeek!));
  return {
    freedomMedian: percentile(sorted(outcomes.map((o) => o.freedomWeek ?? Infinity)), 0.5),
    dreamMedian: percentile(sorted(outcomes.map((o) => o.dreamWeek ?? Infinity)), 0.5),
    gapMedian: gaps.length ? percentile(sorted(gaps), 0.5) : Infinity,
    dreamPct: pct(outcomes.filter((o) => o.dreamWeek !== null).length),
    forcedAvg: avg(outcomes.map((o) => o.forcedReturns)),
    forcedPct: pct(outcomes.filter((o) => o.forcedReturns > 0).length),
    quitPct: pct(outcomes.filter((o) => o.quitAfterFreedom).length),
    happiness: avg(outcomes.filter((o) => o.joyWeeks > 0).map((o) => o.joySum / o.joyWeeks)),
    netWorth: avg(outcomes.map((o) => o.netWorth)),
  };
}

function formatActRow(label: string, s: ActSummary, weeks: number): string {
  const w = (n: number) => (Number.isFinite(n) ? String(n) : `>${weeks}`);
  return [
    label.padEnd(20),
    w(s.freedomMedian).padStart(7), w(s.dreamMedian).padStart(7), w(s.gapMedian).padStart(9),
    `${Math.round(s.dreamPct)}%`.padStart(7), `${Math.round(s.quitPct)}%`.padStart(6),
    s.forcedAvg.toFixed(2).padStart(8), `${Math.round(s.forcedPct)}%`.padStart(6),
    s.happiness.toFixed(1).padStart(8), String(Math.round(s.netWorth)).padStart(9),
  ].join(' ');
}

/** Цели второго акта (docs/ROADMAP.md, «Этап 1»): ни одна стратегия не выигрывает по всем осям. */
function checkSecondActTargets(
  sum: Map<string, ActSummary>, outcomes: Map<string, Outcome[]>, sensibleFreedom: (number | null)[], weeks: number,
): [string, boolean][] {
  const stay = sum.get(ACT_LABELS.stay)!;
  const quitNow = sum.get(ACT_LABELS.quitNow)!;
  const quit150 = sum.get(ACT_LABELS.quit150)!;
  const all = [stay, quitNow, quit150];

  // Четыре оси: время до мечты, капитал, счастье, надёжность свободы. Лучший по всем сразу — это провал баланса.
  const axes: { value: (s: ActSummary) => number; best: 'min' | 'max' }[] = [
    { value: (s) => s.gapMedian, best: 'min' },
    { value: (s) => s.netWorth, best: 'max' },
    { value: (s) => s.happiness, best: 'max' },
    { value: (s) => s.forcedPct, best: 'min' },
  ];
  const isBest = (s: ActSummary, axis: (typeof axes)[number]) => {
    const values = all.map(axis.value);
    return axis.value(s) === (axis.best === 'min' ? Math.min(...values) : Math.max(...values));
  };
  const dominator = all.find((s) => axes.every((axis) => isBest(s, axis)));

  // До свободы все три играют как «разумный» — недели свободы должны совпадать по каждому сиду.
  const sameFreedom = Object.values(ACT_LABELS).every((label) =>
    outcomes.get(label)!.every((o, i) => o.freedomWeek === sensibleFreedom[i]));

  return [
    [`Остался: мечта готова к ${weeks}-й неделе в ≥ 90% игр`, stay.dreamPct >= 90],
    ['Остался: от свободы до мечты 12–30 недель (медиана)', stay.gapMedian >= 12 && stay.gapMedian <= 30],
    // Без этой проверки две цели про «ушёл при 150%» легко выполнить впустую: если до 150% никто не добирается,
    // стратегия — просто копия «остался». Порог 25% подобран по факту: сейчас до 150% доходит треть игр.
    ['Ушёл при 150%: уходит с работы хотя бы в 25% игр (иначе стратегия — копия «остался»)', quit150.quitPct >= 25],
    ['Ушёл при 150%: вынужденный возврат не чаще чем в 10% игр', quit150.forcedPct <= 10],
    ['Ушёл при 150%: счастья после свободы больше, чем у «остался»', quit150.happiness > stay.happiness],
    ['Ушёл сразу: вынужденный возврат в 15–70% игр', quitNow.forcedPct >= 15 && quitNow.forcedPct <= 70],
    ['Остался богаче обоих уходивших (капитал)', stay.netWorth > quitNow.netWorth && stay.netWorth > quit150.netWorth],
    ['Ушёл при 150%: мечта не позже чем на 15 недель после «остался» (медиана)', quit150.gapMedian - stay.gapMedian <= 15],
    ['Ни одна стратегия не лучшая по всем осям (мечта, капитал, счастье, надёжность)', dominator === undefined],
    ['До свободы второй акт не влияет: недели свободы совпадают с «разумным» по каждому сиду', sameFreedom],
  ];
}

// ───────────── Улучшения: сводка и таблица ─────────────

interface UpgradeSummary {
  level2Pct: number;      // % игр, где достигнута «Уверенность» (150%)
  level3Pct: number;      // % игр, где достигнуто «Богатство» (200%)
  passiveMedian: number;  // медиана настоящего пассивного дохода к концу
  netWorth: number;       // средний капитал в конце
  upgradesAvg: number;    // улучшений за игру
  freedomMedian: number;  // неделя первой свободы (медиана)
}

function summarizeUpgrades(outcomes: Outcome[]): UpgradeSummary {
  const pct = (f: (o: Outcome) => boolean) => (100 * outcomes.filter(f).length) / outcomes.length;
  const sorted = (xs: number[]) => xs.sort((a, b) => a - b);
  return {
    level2Pct: pct((o) => o.bestLevel >= 2),
    level3Pct: pct((o) => o.bestLevel >= 3),
    passiveMedian: percentile(sorted(outcomes.map((o) => o.passive)), 0.5),
    netWorth: outcomes.reduce((s, o) => s + o.netWorth, 0) / outcomes.length,
    upgradesAvg: outcomes.reduce((s, o) => s + o.upgrades, 0) / outcomes.length,
    freedomMedian: percentile(sorted(outcomes.map((o) => o.freedomWeek ?? Infinity)), 0.5),
  };
}

function formatUpgradeRow(label: string, s: UpgradeSummary, weeks: number): string {
  const w = (n: number) => (Number.isFinite(n) ? String(n) : `>${weeks}`);
  return [
    label.padEnd(20),
    w(s.freedomMedian).padStart(7),
    `${Math.round(s.level2Pct)}%`.padStart(6), `${Math.round(s.level3Pct)}%`.padStart(6),
    String(Math.round(s.passiveMedian)).padStart(6), s.upgradesAvg.toFixed(1).padStart(9),
    String(Math.round(s.netWorth)).padStart(9),
  ].join(' ');
}

/** Цели улучшений (docs/ROADMAP.md, «Этап 5»): рост после того, как остров заполнен, а не быстрая первая свобода. */
function checkUpgradeTargets(withUp: UpgradeSummary, without: UpgradeSummary, weeks: number): [string, boolean][] {
  const passiveGain = without.passiveMedian > 0 ? withUp.passiveMedian / without.passiveMedian - 1 : 0;
  return [
    [`Разумный: «Уверенность» (150%) за ${weeks} недель — в ≥ 50% игр`, withUp.level2Pct >= 50],
    [`Разумный: «Богатство» (200%) за ${weeks} недель — в 15–50% игр`, withUp.level3Pct >= 15 && withUp.level3Pct <= 50],
    [`Разумный: пассивный доход к ${weeks}-й неделе (медиана) хотя бы на 20% выше, чем без улучшений`, passiveGain >= 0.2],
    ['Улучшения не ускоряют первую свободу больше чем на 3 недели (медиана)', withUp.freedomMedian >= without.freedomMedian - 3],
  ];
}

/** Цели из MVP_SPEC: «Баланс (цели симулятора)» + санитарные проверки. */
function checkTargets(sum: Map<string, Summary>): [string, boolean][] {
  const get = (label: string) => sum.get(label)!;
  const saver = get(LABELS.saver);
  const sensible = get(LABELS.sensible);
  const spender = get(LABELS.spender);
  const gambler = get(LABELS.gambler);
  return [
    ['Бережливая: медиана 30–40', saver.median >= 30 && saver.median <= 40],
    ['Разумный игрок: медиана 35–50', sensible.median >= 35 && sensible.median <= 50],
    ['Транжира: медиана > 70 (или никогда)', spender.median > 70],
    ['Рисковый: большой разброс (p75 − p25 ≥ 20, бывает и быстрее всех, и в долгах)',
      gambler.p75 - gambler.p25 >= 20 && gambler.p25 < saver.p25 && gambler.debtPct > 0],
    ['Бездельник никогда не свободен', get(LABELS.idle).freePct === 0],
    ['Трудоголик без отдыха выгорает и отстаёт от разумного',
      get(LABELS.grinder).burnouts > 0 && get(LABELS.grinder).median > sensible.median],
  ];
}

const LABELS = {
  sensible: 'human:sensible',
  noUpgrades: 'human:no-upgrades',
  idle: 'human:idle',
  grinder: 'human:grinder',
  saver: 'bot:saver (Мия)',
  spender: 'bot:spender (Тимур)',
  gambler: 'bot:gambler (Борис)',
};

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
}

function main(): void {
  const seeds = arg('seeds', 500);
  const weeks = arg('weeks', 100);
  const started = Date.now();

  const byLabel = new Map<string, Outcome[]>();
  const add = (label: string, o: Outcome) => {
    if (!byLabel.has(label)) byLabel.set(label, []);
    byLabel.get(label)!.push(o);
  };
  for (const [name, policy] of Object.entries(HUMAN_POLICIES)) {
    for (let seed = 1; seed <= seeds; seed++) {
      const stats = runGame(seed, weeks, policy);
      add(`human:${name}`, stats.get(HUMAN_ID)!);
      // Ботов меряем в мирах с разумным человеком — это основной сценарий игры.
      if (name === 'sensible') {
        add(LABELS.saver, stats.get('bot-mia')!);
        add(LABELS.spender, stats.get('bot-timur')!);
        add(LABELS.gambler, stats.get('bot-boris')!);
      }
    }
  }
  const summaries = new Map([...byLabel].map(([label, outcomes]) => [label, summarize(outcomes)]));

  // Второй акт: те же сиды, человек играет одну из трёх стратегий.
  const actOutcomes = new Map<string, Outcome[]>();
  for (const [label, policy] of SECOND_ACT_POLICIES) {
    const outcomes: Outcome[] = [];
    for (let seed = 1; seed <= seeds; seed++) outcomes.push(runGame(seed, weeks, policy).get(HUMAN_ID)!);
    actOutcomes.set(label, outcomes);
  }
  const actSummaries = new Map([...actOutcomes].map(([label, outcomes]) => [label, summarizeSecondAct(outcomes)]));

  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\n«Архипелаг» — баланс: ${seeds} сидов × ${weeks} недель (${secs} c)\n`);
  console.log(['policy'.padEnd(20), 'median', '   p25', '   p75', '  free', '  debt', 'burnouts', ' scams', ' netWorth'].join(' '));
  for (const [label, s] of summaries) console.log(formatRow(label, s, weeks));
  console.log('\nmedian/p25/p75 — недели до свободы (не достигшие = бесконечность); free — % достигших;');
  console.log('debt — % с долгом в конце; burnouts/scams — в среднем за игру; netWorth — средний капитал в конце.\n');

  console.log('Второй акт — три стратегии после свободы (те же сиды)\n');
  console.log(['policy'.padEnd(20), 'свобода', ' мечта', 'свобода→м', 'мечта %', 'ушёл %', 'возвраты', ' ≥1 в.', 'счастье', ' капитал'].join(' '));
  for (const [label, s] of actSummaries) console.log(formatActRow(label, s, weeks));
  console.log('\nсвобода/мечта — медианная неделя (не достигшие = бесконечность); свобода→м — недель от свободы до готовой мечты;');
  console.log(`мечта % — игры, где шхуна готова к ${weeks}-й неделе; возвраты — вынужденных возвратов на работу на игру, ≥1 в. — % игр с возвратом;`);
  console.log('ушёл % — игры, где игрок хоть раз остался без работы после свободы (показывает, как часто стратегия вообще срабатывает);');
  console.log('счастье — среднее по неделям после свободы; капитал — средний чистый капитал в конце (шхуна в него не входит).\n');

  const withUp = summarizeUpgrades(byLabel.get(LABELS.sensible)!);
  const without = summarizeUpgrades(byLabel.get(LABELS.noUpgrades)!);
  console.log('Улучшения — разумный игрок с ними и без них (те же сиды)\n');
  console.log(['policy'.padEnd(20), 'свобода', '  150%', '  200%', ' доход', 'улучшений', ' капитал'].join(' '));
  console.log(formatUpgradeRow('с улучшениями', withUp, weeks));
  console.log(formatUpgradeRow('без улучшений', without, weeks));
  console.log(`\n150%/200% — игры, где за ${weeks} недель достигнуты «Уверенность»/«Богатство»; доход — медиана настоящего`);
  console.log('пассивного дохода в неделю к концу; улучшений — в среднем за игру; капитал — средний чистый капитал в конце.\n');

  const sensibleFreedom = byLabel.get(LABELS.sensible)!.map((o) => o.freedomWeek);
  const checks = [
    ...checkTargets(summaries),
    ...checkSecondActTargets(actSummaries, actOutcomes, sensibleFreedom, weeks),
    ...checkUpgradeTargets(withUp, without, weeks),
  ];
  for (const [name, passed] of checks) console.log(`${passed ? 'OK  ' : 'FAIL'} ${name}`);
  if (checks.some(([, passed]) => !passed)) process.exitCode = 1;
}

main();
