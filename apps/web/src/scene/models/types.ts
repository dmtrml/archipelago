export interface ModelProps {
  damaged: boolean;
  /** номер вариации (обычно slotIndex): цвет корпуса, фаза качки */
  variant: number;
  /** уровень улучшения 1..maxLevel (уже приведён к допустимому); неулучшаемые модели его не смотрят */
  level: number;
}
