// Реестр моделей: компонент, высота подписи над объектом, размер круга при появлении — по уровням улучшения.
import type { ComponentType } from 'react';
import type { ModelId } from '@arch/engine';
import type { ModelProps } from './types';
import { Boat } from './Boat';
import { Smokehouse } from './Smokehouse';
import { Cottage } from './Cottage';
import { Bungalow } from './Bungalow';
import { Cafe } from './Cafe';
import { Bank } from './Bank';
import { PearlFarm } from './PearlFarm';
import { Fountain } from './Fountain';
import { Statue } from './Statue';
import { Yacht } from './Yacht';
import { Garden } from './Garden';

/** Значение для уровней 1, 2, 3. */
export type Levels = readonly [number, number, number];

export interface ModelInfo {
  C: ComponentType<ModelProps>;
  /** высота подписи (и значка ремонта) над основанием — для уровней 1..3 */
  h: Levels;
  /** радиус круга-волны при появлении и улучшении — для уровней 1..3 */
  ripple: Levels;
  /** до какого уровня модель умеет расти (1 — не улучшается) */
  maxLevel: 1 | 3;
}

const fixed = (C: ComponentType<ModelProps>, h: number, ripple: number): ModelInfo =>
  ({ C, h: [h, h, h], ripple: [ripple, ripple, ripple], maxLevel: 1 });

export const MODELS: Record<ModelId, ModelInfo> = {
  boat: { C: Boat, h: [3.1, 3.85, 3.95], ripple: [1.0, 1.15, 1.3], maxLevel: 3 },
  smokehouse: { C: Smokehouse, h: [3.2, 3.3, 4.3], ripple: [1.2, 1.4, 1.55], maxLevel: 3 },
  cottage: { C: Cottage, h: [3.5, 4.5, 5.9], ripple: [1.4, 1.5, 1.65], maxLevel: 3 },
  bungalow: { C: Bungalow, h: [4.0, 4.0, 4.1], ripple: [1.5, 1.65, 1.8], maxLevel: 3 },
  cafe: { C: Cafe, h: [3.9, 4.6, 4.6], ripple: [1.6, 1.7, 1.85], maxLevel: 3 },
  bank: fixed(Bank, 3.9, 1.5),
  pearlFarm: fixed(PearlFarm, 2.6, 1.6),
  fountain: fixed(Fountain, 2.9, 1.2),
  statue: fixed(Statue, 3.9, 0.9),
  yacht: fixed(Yacht, 2.9, 1.7),
  garden: fixed(Garden, 2.5, 1.4),
};

/** Уровень, который модель умеет показать: целое 1..maxLevel (мусор и отсутствие → 1). */
export const levelFor = (info: ModelInfo, level: number | undefined): number =>
  Math.min(info.maxLevel, Math.max(1, Math.round(level ?? 1) || 1));

export const heightAt = (info: ModelInfo, level: number) => info.h[levelFor(info, level) - 1];
export const rippleAt = (info: ModelInfo, level: number) => info.ripple[levelFor(info, level) - 1];

export type { ModelProps };
