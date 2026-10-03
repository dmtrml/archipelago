// Реестр моделей: компонент, высота подписи над объектом, размер круга при появлении.
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

export interface ModelInfo {
  C: ComponentType<ModelProps>;
  /** высота подписи (и значка ремонта) над основанием */
  h: number;
  /** радиус круга-волны при появлении */
  ripple: number;
}

export const MODELS: Record<ModelId, ModelInfo> = {
  boat: { C: Boat, h: 3.1, ripple: 1.0 },
  smokehouse: { C: Smokehouse, h: 3.2, ripple: 1.2 },
  cottage: { C: Cottage, h: 3.5, ripple: 1.4 },
  bungalow: { C: Bungalow, h: 4.0, ripple: 1.5 },
  cafe: { C: Cafe, h: 3.9, ripple: 1.6 },
  bank: { C: Bank, h: 3.9, ripple: 1.5 },
  pearlFarm: { C: PearlFarm, h: 2.6, ripple: 1.6 },
  fountain: { C: Fountain, h: 2.9, ripple: 1.2 },
  statue: { C: Statue, h: 3.9, ripple: 0.9 },
  yacht: { C: Yacht, h: 2.9, ripple: 1.7 },
  garden: { C: Garden, h: 2.5, ripple: 1.4 },
};

export type { ModelProps };
