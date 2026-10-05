// Случайные события: личные (для каждого игрока) и общие (для всего архипелага).
import { FREEDOM_LEVEL_TITLES } from './content';
import { assetTitle, getDef, happinessJoy } from './economy';
import type { Rng } from './rng';
import * as R from './rules';
import { coins, weeksText } from './text';
import type { DreamDef, GameEvent, PlayerState, PlayerWeekReport, WorldState } from './types';

/** Все id событий — чтобы UI мог подобрать иконки. */
export type EventId =
  | 'illness' | 'breakdown' | 'gift' | 'raise' | 'burnout'
  | 'storm' | 'stormDamage' | 'stormInsured' | 'fishShoal' | 'touristBoom' | 'crisis'
  | 'scamCollapse' | 'emergencyLoan' | 'freedom'
  | 'dreamStage' | 'dreamDone' | 'freedomLevel' | 'freedomThreat' | 'threatOver' | 'backToWork';

function event(id: EventId, title: string, text: string, tone: GameEvent['tone'], extra: Partial<GameEvent> = {}): GameEvent {
  return { id, title, text, tone, ...extra };
}

function roundTo5(n: number): number {
  return Math.round(n / 5) * 5;
}

function pickText(rng: Rng, variants: string[]): string {
  return variants[rng.int(0, variants.length - 1)];
}

// ───────────── Выгорание ─────────────

export function rollBurnout(player: PlayerState, rng: Rng): boolean {
  if (player.happiness >= R.BURNOUT_THRESHOLD) return false;
  const depth = (R.BURNOUT_THRESHOLD - player.happiness) / R.BURNOUT_THRESHOLD; // 0..1
  return rng.chance(R.BURNOUT_CHANCE_MIN + (R.BURNOUT_CHANCE_MAX - R.BURNOUT_CHANCE_MIN) * depth);
}

export function burnoutEvent(): GameEvent {
  return event('burnout', 'Выгорание',
    'Сил совсем нет — работа на этой неделе шла вполсилы, и зарплата вдвое меньше. Отдых и маленькие радости помогают не доводить до такого.',
    'bad');
}

// ───────────── Личные события ─────────────

/** Бросает личное событие; повышение сразу меняет зарплату и расходы игрока. */
export function rollPersonalEvent(player: PlayerState, rng: Rng): GameEvent | null {
  if (!rng.chance(R.PERSONAL_EVENT_CHANCE)) return null;
  const kind = rng.weighted(R.PERSONAL_EVENT_WEIGHTS);
  switch (kind) {
    case 'illness': {
      const cost = roundTo5(rng.range(...R.ILLNESS_COST));
      if (player.insured) {
        return event('illness', 'Простуда',
          'Пришлось идти к врачу, но страховка оплатила и приём, и лекарства — ни монетки из кармана.', 'neutral', { cashDelta: 0 });
      }
      return event('illness', 'Простуда',
        `Пришлось потратиться на врача и лекарства: ${coins(cost)}. Страховка покрыла бы это.`, 'bad', { cashDelta: -cost });
    }
    case 'breakdown': {
      const cost = roundTo5(rng.range(...R.BREAKDOWN_COST));
      const what = pickText(rng, [
        'Сломался холодильник — пришлось срочно покупать новый.',
        'Протекла крыша — позвали мастера с инструментами.',
        'Велосипед развалился прямо по дороге на работу.',
      ]);
      return event('breakdown', 'Поломка', what, 'bad', { cashDelta: -cost });
    }
    case 'gift': {
      const amount = roundTo5(rng.range(...R.GIFT_AMOUNT));
      const why = pickText(rng, [
        'Бабушка прислала монеты ко дню рождения.',
        'Сосед вернул старый долг — приятная неожиданность.',
        'На пляже нашлась бутылка с монетами внутри!',
      ]);
      return event('gift', 'Подарок', why, 'good', { cashDelta: amount });
    }
    case 'raise': {
      if (!player.employed) return null; // повышение бывает только на работе
      player.salary += R.RAISE_SALARY;
      player.living += R.RAISE_LIVING;
      return event('raise', 'Повышение!',
        `Зарплата выросла на ${R.RAISE_SALARY}, но и привычки подорожали: расходы на жизнь +${R.RAISE_LIVING}. Так расходы догоняют доходы.`,
        'good');
    }
  }
}

/**
 * Изменение счастья за неделю: будни (только пока работаешь) + радость от статусных вещей и мечты
 * + штраф за подработку.
 */
export function weeklyHappinessDelta(player: PlayerState): number {
  const drift = player.employed ? R.HAPPINESS_DRIFT : 0;
  return drift + happinessJoy(player) + (player.extraShift ? R.EXTRA_SHIFT_JOY : 0);
}

// ───────────── Общие события ─────────────

function applyStorm(world: WorldState, rng: Rng, reports: Record<string, PlayerWeekReport>): GameEvent {
  const damagedAll: string[] = [];
  for (const player of world.players) {
    const hit = player.owned.filter((a) => {
      const risk = getDef(a.defId).stormRisk;
      return !a.damaged && risk > 0 && rng.chance(risk);
    });
    if (hit.length === 0) continue;
    const names = hit.map(assetTitle).join(', ');
    const uids = hit.map((a) => a.uid);
    if (player.insured) {
      reports[player.id].events.push(event('stormInsured', 'Страховка выручила',
        `Шторм потрепал: ${names}. Страховка бесплатно оплатила ремонт — всё снова работает.`, 'good',
        { affectedAssetUids: uids }));
      continue;
    }
    for (const a of hit) a.damaged = true;
    damagedAll.push(...uids);
    reports[player.id].events.push(event('stormDamage', 'Шторм повредил имущество',
        `Пострадали: ${names}. Пока не почините (30% цены), они не приносят дохода.`, 'bad',
      { affectedAssetUids: uids }));
  }
  return event('storm', 'Шторм',
    'Над архипелагом пронёсся шторм. Лодкам и бунгало досталось сильнее всего.', 'bad',
    { affectedAssetUids: damagedAll });
}

/** Бросает общее событие недели (не больше одного). Мутирует рынок и имущество копии мира. */
export function rollWorldEvent(world: WorldState, rng: Rng, reports: Record<string, PlayerWeekReport>): GameEvent[] {
  if (!rng.chance(R.WORLD_EVENT_CHANCE)) return [];
  const kind = rng.weighted(R.WORLD_EVENT_WEIGHTS);
  const market = world.market;
  switch (kind) {
    case 'storm':
      return [applyStorm(world, rng, reports)];
    case 'fishShoal':
      market.fishShock += R.SHOAL_FISH_SHOCK;
      return [event('fishShoal', 'Рыбный косяк',
        'К архипелагу подошёл огромный косяк рыбы — лодки, коптильни и доли в артели заработают больше.', 'good')];
    case 'touristBoom':
      market.tourismShock += R.BOOM_TOURISM_SHOCK;
      return [event('touristBoom', 'Туристический бум',
        'На острова хлынули туристы — бунгало и кафе ждут хорошие недели.', 'good')];
    case 'crisis':
      market.tourismShock += R.CRISIS_TOURISM_SHOCK;
      market.fishShock += R.CRISIS_FISH_SHOCK;
      return [event('crisis', 'Кризис',
        'Туристы сидят дома, рыба дешевеет: доходы падают, и продать имущество дорого сейчас не выйдет.', 'bad')];
  }
}

// ───────────── Аферы, долги, свобода ─────────────

export function scamCollapseEvent(assetUid: string): GameEvent {
  return event('scamCollapse', 'Ферма исчезла',
    '«Жемчужная ферма» пропала вместе с деньгами. Это была пирамида: прежним вкладчикам платили из денег новых, а когда новые кончились — всё рухнуло.',
    'bad', { affectedAssetUids: [assetUid] });
}

export function emergencyLoanEvent(amount: number): GameEvent {
  return event('emergencyLoan', 'Заём у ростовщика',
    `Монеты кончились, и пришлось занять у ростовщика ${coins(amount)} под ${Math.round(R.EMERGENCY_RATE * 100)}% в неделю. Такой долг лучше вернуть поскорее.`,
    'bad');
}

export function freedomEvent(): GameEvent {
  return event('freedom', 'Финансовая свобода!',
    'Пассивный доход покрывает все расходы. Теперь можно работать, потому что хочется, а не потому что надо.',
    'good');
}

// ───────────── Второй акт ─────────────

export function dreamStageEvent(dream: DreamDef, finishedStage: number): GameEvent {
  const done = dream.stages[finishedStage];
  const next = dream.stages[finishedStage + 1];
  const tail = next ? `Впереди — «${next.title}».` : '';
  return event('dreamStage', `Готово: ${done.title}`,
    `Ещё один этап мечты позади — «${dream.title}» стала ближе. ${tail}`.trim(), 'good');
}

export function dreamDoneEvent(dream: DreamDef): GameEvent {
  return event('dreamDone', 'Шхуна готова!',
    `Шхуна сошла на воду и уходит в кругосветку! Теперь на её содержание уходит ${coins(dream.upkeep)} в неделю, зато она радует каждый день.`,
    'good');
}

/** Уровень 1 («Свобода») празднует freedomEvent; здесь — запас прочности: 2 и выше. */
export function freedomLevelEvent(level: number): GameEvent {
  const title = FREEDOM_LEVEL_TITLES[level - 1];
  const text = level >= 3
    ? 'Пассивный доход вдвое больше расходов. Это уже богатство: даже плохой сезон не отнимет свободу.'
    : 'Пассивный доход в полтора раза больше расходов — теперь у свободы есть запас прочности.';
  return event('freedomLevel', title, text, 'good');
}

export function freedomThreatEvent(weeksLeft: number): GameEvent {
  return event('freedomThreat', 'Свобода под угрозой',
    `Без работы пассивного дохода не хватает на расходы. До возвращения на работу: ${weeksText(weeksLeft)}. Добавьте доходных активов или уберите лишние траты.`,
    'bad');
}

export function threatOverEvent(): GameEvent {
  return event('threatOver', 'Угроза миновала',
    'Пассивный доход снова покрывает расходы — свобода на месте. Запас прочности делает её надёжнее.',
    'good');
}

export function backToWorkEvent(salary: number): GameEvent {
  return event('backToWork', 'Пришлось вернуться на работу',
    `Свобода не удержалась: без работы доходов не хватало слишком долго. Новая зарплата — ${coins(salary)} в неделю, чуть меньше прежней. Копите запас, и свобода вернётся.`,
    'bad');
}
