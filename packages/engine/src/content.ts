// Контент: все сделки архипелага. Числа — базовые, конкретное предложение отклоняется от них случайно.
import type { AssetDef, DealKind, DreamDef } from './types';

// Улучшения (`upgrades`) стоят дороже самой сделки и окупаются медленнее новой покупки: при рынке 1.0
// вторая ступень — за 20–24 недели, третья — за 28 (новые сделки — 13–22). Пока на острове есть место,
// выгоднее купить новое; когда места кончились — расти можно, вкладывая в то, что уже есть.
// У большого дела и расходы большие: содержание ступени — больше трети её дохода, а страховка считается
// от всей вложенной цены. Поэтому полностью улучшенный остров подходит к «Богатству» (200%), но не уходит
// далеко за него: дальше растут знания, доли в артели и (позже) соседние острова. Числа подобраны симулятором.

export const ASSET_DEFS: Record<string, AssetDef> = {
  boat: {
    id: 'boat', kind: 'asset',
    title: 'Рыбацкая лодка',
    description: 'Каждое утро выходит в море и привозит улов на продажу — только штормов боится.',
    price: 250, income: 20, upkeep: 4, sector: 'fish', joy: 0,
    slot: 'pier', model: 'boat', minKnowledge: 0, stormRisk: 0.35, resaleRate: 0.6,
    upgrades: [
      {
        title: 'Баркас',
        description: 'Лодка побольше, с мотором и крепкими сетями: уходит дальше в море, но и топлива ей нужно больше.',
        cost: 400, income: 32, upkeep: 12, minKnowledge: 0,
      },
      {
        title: 'Траулер',
        description: 'Настоящее рыболовное судно с трюмом-холодильником — улова хватает на весь рынок, только чинить его дорого.',
        cost: 700, income: 40, upkeep: 15, minKnowledge: 1,
      },
    ],
  },
  smokehouse: {
    id: 'smokehouse', kind: 'asset',
    title: 'Коптильня',
    description: 'Превращает свежую рыбу в ароматную копчёную, которую соседи раскупают к ужину.',
    price: 500, income: 35, upkeep: 6, sector: 'fish', joy: 0,
    slot: 'plot', model: 'smokehouse', minKnowledge: 0, stormRisk: 0.1, resaleRate: 0.6,
    upgrades: [
      {
        title: 'Рыбный цех',
        description: 'Рядом с коптильней появляются засолка и сушка — рыбу берут и к ужину, и в дальнюю дорогу.',
        cost: 600, income: 48, upkeep: 18, minKnowledge: 0,
      },
      {
        title: 'Консервный заводик',
        description: 'Рыба в жестяных баночках хранится годами и уплывает на соседние острова — тут надо хорошо знать дело.',
        cost: 900, income: 52, upkeep: 20, minKnowledge: 2,
      },
    ],
  },
  cottage: {
    id: 'cottage', kind: 'asset',
    title: 'Домик под сдачу',
    description: 'Уютный домик, за который жильцы платят каждую неделю — спокойно и надёжно.',
    price: 700, income: 38, upkeep: 6, sector: 'stable', joy: 0,
    slot: 'plot', model: 'cottage', minKnowledge: 0, stormRisk: 0.05, resaleRate: 0.85,
    upgrades: [
      {
        title: 'Гостевой дом',
        description: 'Второй этаж и ещё три комнаты — теперь здесь гостят сразу несколько семей.',
        cost: 800, income: 52, upkeep: 18, minKnowledge: 0,
      },
      {
        title: 'Мини-отель',
        description: 'Маленький отель с завтраками и цветами на подоконниках — гости возвращаются сюда каждый год.',
        cost: 1100, income: 63, upkeep: 24, minKnowledge: 1,
      },
    ],
  },
  bungalow: {
    id: 'bungalow', kind: 'asset',
    title: 'Бунгало для туристов',
    description: 'Туристы платят за ночь у моря: в сезон — много, в межсезонье — меньше.',
    price: 600, income: 42, upkeep: 8, sector: 'tourism', joy: 0,
    slot: 'beach', model: 'bungalow', minKnowledge: 0, stormRisk: 0.3, resaleRate: 0.65,
    upgrades: [
      {
        title: 'Бунгало с террасой',
        description: 'Широкая терраса над водой и гамаки — за такой вид туристы охотно платят больше.',
        cost: 700, income: 54, upkeep: 20, minKnowledge: 0,
      },
      {
        title: 'Пляжный клуб',
        description: 'Несколько домиков, бассейн и вечерние праздники у костра — сюда приезжают на весь отпуск.',
        cost: 1000, income: 58, upkeep: 22, minKnowledge: 1,
      },
    ],
  },
  cafe: {
    id: 'cafe', kind: 'asset',
    title: 'Пляжное кафе',
    description: 'Кормит отдыхающих мороженым и лимонадом — чтобы вести такое дело, нужно немного знаний.',
    price: 900, income: 64, upkeep: 12, sector: 'tourism', joy: 0,
    slot: 'beach', model: 'cafe', minKnowledge: 1, stormRisk: 0.15, resaleRate: 0.6,
    upgrades: [
      {
        title: 'Ресторан у моря',
        description: 'Вместо мороженого — рыба на гриле и столики под фонариками до самой ночи.',
        cost: 1000, income: 76, upkeep: 28, minKnowledge: 1,
      },
      {
        title: 'Ресторан на сваях',
        description: 'Зал прямо над лагуной, к которому подплывают на лодках, — самое известное место архипелага.',
        cost: 1400, income: 81, upkeep: 31, minKnowledge: 2,
      },
    ],
  },
  deposit: {
    id: 'deposit', kind: 'asset',
    title: 'Вклад в банк архипелага',
    description: 'Монеты лежат в банке и понемногу растут — медленно, зато без всякого риска.',
    price: 400, income: 10, upkeep: 0, sector: 'stable', joy: 0,
    slot: 'finance', model: 'bank', minKnowledge: 0, stormRisk: 0, resaleRate: 1,
  },
  shares: {
    id: 'shares', kind: 'asset',
    title: 'Доля в рыболовецкой артели',
    description: 'Вы совладелец большой артели: получаете часть улова, а цена доли гуляет вместе с рынком рыбы.',
    price: 500, income: 28, upkeep: 0, sector: 'fish', joy: 0,
    slot: 'finance', model: 'bank', minKnowledge: 2, stormRisk: 0, resaleRate: 0.9,
  },
  pearlFarm: {
    id: 'pearlFarm', kind: 'scam',
    title: 'Жемчужная ферма: +25% в неделю!',
    description: 'Улыбчивый незнакомец обещает огромный доход каждую неделю и просит не задавать лишних вопросов.',
    price: 800, income: 200, upkeep: 0, sector: 'stable', joy: 0,
    slot: 'sea', model: 'pearlFarm', minKnowledge: 0, stormRisk: 0, resaleRate: 0.2,
    collapseWeeks: [2, 5],
  },
  fountain: {
    id: 'fountain', kind: 'status',
    title: 'Мраморный фонтан',
    description: 'Красиво журчит на площади и радует глаз, но денег не приносит.',
    price: 500, income: 0, upkeep: 6, sector: 'stable', joy: 3,
    slot: 'plaza', model: 'fountain', minKnowledge: 0, stormRisk: 0, resaleRate: 0.4,
  },
  statue: {
    id: 'statue', kind: 'status',
    title: 'Золотая статуя хозяина',
    description: 'Сверкает на солнце и напоминает всем, кто тут главный, — а полировать её недёшево.',
    price: 900, income: 0, upkeep: 12, sector: 'stable', joy: 5,
    slot: 'plaza', model: 'statue', minKnowledge: 0, stormRisk: 0, resaleRate: 0.3,
  },
  yacht: {
    id: 'yacht', kind: 'status',
    title: 'Яхта',
    description: 'Белоснежная красавица для морских прогулок — радует, но содержать её дороже маленького острова.',
    price: 1400, income: 0, upkeep: 35, sector: 'stable', joy: 7,
    slot: 'sea', model: 'yacht', minKnowledge: 0, stormRisk: 0.2, resaleRate: 0.5,
  },
  garden: {
    id: 'garden', kind: 'status',
    title: 'Цветущий сад',
    description: 'Немного цветов и тени у дома — маленькая радость за небольшие деньги.',
    price: 140, income: 0, upkeep: 2, sector: 'stable', joy: 2,
    slot: 'plot', model: 'garden', minKnowledge: 0, stormRisk: 0, resaleRate: 0.3,
  },
};

/** Относительные веса появления на доске внутри своего типа сделки. */
export const DEAL_WEIGHTS: Record<DealKind, Record<string, number>> = {
  asset: { boat: 22, smokehouse: 16, cottage: 16, bungalow: 16, cafe: 12, deposit: 10, shares: 8 },
  status: { garden: 35, fountain: 30, statue: 20, yacht: 15 },
  scam: { pearlFarm: 1 },
};

/** Названия в винительном падеже — для новостей («Тимур купил яхту»). */
export const DEAL_ACCUSATIVE: Record<string, string> = {
  boat: 'рыбацкую лодку',
  smokehouse: 'коптильню',
  cottage: 'домик под сдачу',
  bungalow: 'бунгало',
  cafe: 'пляжное кафе',
  deposit: 'вклад в банке',
  shares: 'долю в артели',
  pearlFarm: '«жемчужную ферму»',
  fountain: 'мраморный фонтан',
  statue: 'золотую статую',
  yacht: 'яхту',
  garden: 'цветущий сад',
};

/**
 * Названия ступеней улучшения для новостей — по порядку, как в `upgrades`:
 * винительный падеж («Борис улучшил баркас») и именительный («— теперь это траулер»).
 */
export const UPGRADE_NAMES: Record<string, { accusative: string; nominative: string }[]> = {
  boat: [
    { accusative: 'баркас', nominative: 'баркас' },
    { accusative: 'траулер', nominative: 'траулер' },
  ],
  smokehouse: [
    { accusative: 'рыбный цех', nominative: 'рыбный цех' },
    { accusative: 'консервный заводик', nominative: 'консервный заводик' },
  ],
  cottage: [
    { accusative: 'гостевой дом', nominative: 'гостевой дом' },
    { accusative: 'мини-отель', nominative: 'мини-отель' },
  ],
  bungalow: [
    { accusative: 'бунгало с террасой', nominative: 'бунгало с террасой' },
    { accusative: 'пляжный клуб', nominative: 'пляжный клуб' },
  ],
  cafe: [
    { accusative: 'ресторан у моря', nominative: 'ресторан у моря' },
    { accusative: 'ресторан на сваях', nominative: 'ресторан на сваях' },
  ],
};

/** Мечты. Пока одна — шхуна; выбор мечты на старте появится вместе с профессиями. */
export const DREAMS: Record<string, DreamDef> = {
  schooner: {
    id: 'schooner',
    title: 'Шхуна для кругосветки',
    description: 'Своя шхуна, на которой можно обойти весь мир. Её строят на стапеле у берега — этап за этапом.',
    stages: [
      { title: 'Стапель и киль', description: 'Наклонные рельсы к воде и дубовый киль — хребет будущей шхуны.', cost: 400, work: 4 },
      { title: 'Корпус', description: 'Рёбра-шпангоуты обшивают досками, конопатят и смолят.', cost: 700, work: 5 },
      { title: 'Мачты и паруса', description: 'Две мачты, снасти и белые паруса — и шхуна сходит на воду.', cost: 900, work: 6 },
    ],
    upkeep: 20,
    joy: 4,
  },
};

/** Названия уровней свободы (пороги — FREEDOM_LEVEL_RATIOS в rules.ts). */
export const FREEDOM_LEVEL_TITLES = ['Свобода', 'Уверенность', 'Богатство'] as const;
