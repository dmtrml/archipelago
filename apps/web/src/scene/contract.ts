// Контракт между UI и 3D-сценой. UI знает только эти типы и компонент <IslandScene />.
import type { ModelId, SlotType } from '@arch/engine';

/** Объект, который стоит на острове (купленный актив или статусная вещь). */
export interface PlacedItem {
  uid: string;
  model: ModelId;
  slot: SlotType;
  slotIndex: number;
  damaged: boolean;
}

/** Всплывающая сумма над объектом. Живёт ~2 секунды с момента первого появления id. */
export interface FloatLabel {
  id: string;
  /** uid объекта из items или 'home' (дом игрока на холме). */
  anchor: string;
  text: string;
  tone: 'pos' | 'neg';
}

export type Weather = 'clear' | 'storm';

export interface IslandSceneProps {
  items: PlacedItem[];
  floats: FloatLabel[];
  weather: Weather;
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
  onItemClick?: (uid: string) => void;
}
