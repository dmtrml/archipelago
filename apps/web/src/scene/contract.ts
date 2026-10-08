// Контракт между UI и 3D-сценой. UI знает только эти типы и компонент <IslandScene />.
import type { ModelId, SlotType } from '@arch/engine';

/** Объект, который стоит на острове (купленный актив или статусная вещь). */
export interface PlacedItem {
  uid: string;
  model: ModelId;
  slot: SlotType;
  slotIndex: number;
  damaged: boolean;
  /** Уровень улучшения: 1 — как купили, 2–3 — модель крупнее и богаче. Смена уровня — праздничная анимация. */
  level: number;
}

/** Всплывающая сумма над объектом. Живёт ~2 секунды с момента первого появления id. */
export interface FloatLabel {
  id: string;
  /** uid объекта из items, 'home' (дом игрока на холме) или 'dream' (стапель / шхуна). */
  anchor: string;
  text: string;
  tone: 'pos' | 'neg';
}

export type Weather = 'clear' | 'storm';

export interface CameraPose {
  target: [number, number, number];
  az: number;
  el: number;
  d: number;
}

/** Мечта игрока (шхуна) на стапеле у берега. */
export interface DreamProgress {
  /** Сколько этапов готово: 0 — пусто, stages — шхуна на воде. */
  built: number;
  stages: number;
  /** Текущий этап оплачен и строится — рядом со стапелем видна стройка. */
  building: boolean;
}

export interface IslandSceneProps {
  items: PlacedItem[];
  floats: FloatLabel[];
  weather: Weather;
  /** null или отсутствует — мечты на острове пока нет (ничего не рисуется). */
  dream?: DreamProgress | null;
  /**
   * Доля высоты экрана, закрытая интерфейсом снизу (0..0.6).
   * На вертикальных экранах сцена сдвигает остров вверх, чтобы он был виден.
   */
  bottomInset?: number;
  /**
   * Доли ширины экрана, закрытые боковыми панелями [слева, справа].
   * Сцена центрирует остров в свободной полосе и немного отдаляет его.
   */
  sideInsets?: [number, number];
  cameraPose?: () => CameraPose;
  dpr?: number;
  onItemClick?: (uid: string) => void;
}
