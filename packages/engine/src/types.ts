// Контракт движка «Архипелага». Этот файл — общий язык движка, UI и 3D-сцены.
// Менять поля можно только согласованно: на них опираются apps/web/src/ui и apps/web/src/scene.

// ───────────── Контент ─────────────

export type Sector = 'fish' | 'tourism' | 'stable';

/** Куда на острове ставится объект. Вместимость — в SLOT_CAPACITY (slots.ts). */
export type SlotType = 'pier' | 'plot' | 'beach' | 'plaza' | 'sea' | 'finance';

/** Какая 3D-модель рисует объект. */
export type ModelId =
  | 'boat' | 'smokehouse' | 'cottage' | 'bungalow' | 'cafe'
  | 'bank' | 'pearlFarm'
  | 'fountain' | 'statue' | 'yacht' | 'garden';

export type DealKind = 'asset' | 'status' | 'scam';

export interface AssetDef {
  id: string;
  kind: DealKind;
  title: string;
  description: string;
  /** Базовые значения; конкретное предложение отклоняется от них случайно. */
  price: number;
  income: number;            // в неделю, до умножения на индекс сектора; 0 у статусных вещей
  upkeep: number;            // содержание в неделю
  sector: Sector;
  joy: number;               // + к счастью каждую неделю, пока владеешь
  slot: SlotType;
  model: ModelId;
  minKnowledge: number;      // ниже — предложение видно, но купить нельзя
  stormRisk: number;         // 0..1 — шанс повреждения в шторм
  resaleRate: number;        // доля цены при продаже (до рыночной поправки)
  /** Только для афер: через сколько недель «ферма» исчезает. */
  collapseWeeks?: [number, number];
}

// ───────────── Состояние мира ─────────────

export type BotStyle = 'saver' | 'spender' | 'gambler';

export interface OwnedAsset {
  uid: string;
  defId: string;
  boughtWeek: number;
  price: number;             // фактически уплаченная цена
  income: number;            // базовый доход этого экземпляра (до индекса сектора)
  upkeep: number;
  damaged: boolean;          // повреждён штормом: доход 0, пока не починят
  slotIndex: number;         // номер места в слоте своего типа (0..capacity-1)
  /** Скрытая правда об афере. UI не должен показывать это поле игроку. */
  collapseWeek?: number;
}

export interface Loan {
  uid: string;
  principal: number;
  weeklyRate: number;        // например 0.015 = 1.5% в неделю
  emergency: boolean;        // заём у ростовщика (взят автоматически)
}

export interface PlayerState {
  id: string;
  name: string;              // имя игрока
  islandName: string;
  isBot: boolean;
  botStyle?: BotStyle;
  cash: number;
  salary: number;
  living: number;            // базовые расходы на жизнь в неделю
  happiness: number;         // 0..100
  knowledge: number;         // 0..3
  // флаги текущей недели (сбрасываются в endWeek)
  studiedThisWeek: boolean;
  restedThisWeek: boolean;
  extraShift: boolean;
  insured: boolean;          // постоянная настройка, премия списывается каждую неделю
  loans: Loan[];
  owned: OwnedAsset[];
  freedomWeek: number | null; // неделя, когда впервые достигнута свобода
}

export interface MarketState {
  fish: number;              // индекс ~0.6..1.5
  tourism: number;           // индекс ~0.5..1.6
  /** Временные эффекты событий (бум/кризис), затухают со временем. */
  tourismShock: number;
  fishShock: number;
}

export interface Offer {
  uid: string;
  defId: string;
  price: number;
  income: number;            // базовый доход экземпляра (до индекса сектора)
  upkeep: number;
  expiresWeek: number;       // последняя неделя, когда ещё можно купить
}

export type Tone = 'good' | 'bad' | 'neutral';

export interface GameEvent {
  id: string;                // тип события: 'storm' | 'illness' | 'gift' | ...
  title: string;
  text: string;
  tone: Tone;
  cashDelta?: number;
  affectedAssetUids?: string[];
}

export interface PlayerWeekReport {
  playerId: string;
  salary: number;
  assetIncome: { assetUid: string; amount: number }[];
  upkeep: { assetUid: string; amount: number }[];
  living: number;
  interest: number;
  insurance: number;
  eventsCash: number;
  net: number;
  cashAfter: number;
  happinessDelta: number;
  events: GameEvent[];
  /** Активы, исчезнувшие на этой неделе (аферы). */
  lostAssetUids: string[];
  freedomReached: boolean;   // true только в ту неделю, когда свобода достигнута впервые
}

export interface WeekReport {
  week: number;              // какая неделя закончилась
  worldEvents: GameEvent[];
  players: Record<string, PlayerWeekReport>;
  /** Человекочитаемые новости: «Мия купила бунгало». */
  news: { playerId: string; text: string }[];
}

export interface WorldState {
  version: 1;
  seed: number;
  rng: number;               // текущее состояние ГПСЧ — вся случайность только через него
  nextUid: number;
  week: number;              // текущая неделя (начинается с 1)
  market: MarketState;
  players: PlayerState[];    // players[0] — человек
  offers: Offer[];
  lastReport: WeekReport | null;
}

// ───────────── Действия ─────────────

export type Action =
  | { type: 'buyOffer'; playerId: string; offerUid: string }
  | { type: 'sellAsset'; playerId: string; assetUid: string }
  | { type: 'repairAsset'; playerId: string; assetUid: string }
  | { type: 'takeLoan'; playerId: string; amount: number }
  | { type: 'repayLoan'; playerId: string; loanUid: string; amount: number }
  | { type: 'setInsurance'; playerId: string; on: boolean }
  | { type: 'setExtraShift'; playerId: string; on: boolean }
  | { type: 'study'; playerId: string }
  | { type: 'rest'; playerId: string }
  | { type: 'endWeek' };

export interface ActionResult {
  world: WorldState;
  /** Понятная игроку причина отказа на русском; world при этом не меняется. */
  error?: string;
}

// ───────────── Производные данные для UI ─────────────

export interface FinanceView {
  salary: number;            // с учётом подработки на этой неделе
  passiveIncome: number;     // ожидаемый доход активов по текущим индексам
  expenses: {
    living: number;
    upkeep: number;
    interest: number;
    insurance: number;
    total: number;
  };
  net: number;               // salary + passiveIncome − expenses.total
  freedomRatio: number;      // passiveIncome / expenses.total
  netWorth: number;          // cash + стоимость активов − долги
  debt: number;
}

export interface OfferView {
  offer: Offer;
  def: AssetDef;
  expectedIncome: number;    // доход в неделю по текущему рынку (0 у статуса)
  upkeep: number;
  net: number;               // expectedIncome − upkeep
  /** Недель до окупаемости; null — никогда (net ≤ 0). */
  paybackWeeks: number | null;
  weeksLeft: number;         // сколько недель ещё висит на доске (0 = последняя)
  /** Предупреждение, видимое благодаря знаниям (например, об афере). */
  warning?: string;
  locked: boolean;           // не хватает знаний
  canAfford: boolean;
  slotFull: boolean;
}

export interface AssetView {
  asset: OwnedAsset;
  def: AssetDef;
  currentIncome: number;     // 0, если повреждён
  upkeep: number;
  saleValue: number;
  repairCost: number;        // 0, если не повреждён
}

export interface LeaderboardRow {
  playerId: string;
  name: string;
  islandName: string;
  isBot: boolean;
  botStyle?: BotStyle;
  freedomRatio: number;
  netWorth: number;
  freedomWeek: number | null;
}
