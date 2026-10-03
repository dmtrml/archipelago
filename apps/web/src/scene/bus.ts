// Общая «шина» сцены: якоря для подписей, состояние погоды, DOM-слой подписей.
// Живёт в ref-объекте — изменения не вызывают ре-рендеров React.
import { type Context, createContext, useContext } from 'react';
import type { Object3D } from 'three';
import { createWeather, type WeatherState } from './weather';

export interface Anchor {
  obj: Object3D;
  /** высота подписи над точкой объекта */
  h: number;
}

export interface SceneBus {
  anchors: Map<string, Anchor>;
  weather: WeatherState;
  floatLayer: HTMLDivElement | null;
}

export const createBus = (storm: boolean): SceneBus => ({
  anchors: new Map(),
  weather: createWeather(storm),
  floatLayer: null,
});

// Контексты храним на globalThis, чтобы их identity переживала HMR (иначе провайдер и потребители расходятся)
const g = globalThis as { __islBus?: Context<SceneBus | null>; __islDamage?: Context<boolean> };
export const BusContext = (g.__islBus ??= createContext<SceneBus | null>(null));

export function useBus(): SceneBus {
  const bus = useContext(BusContext);
  if (!bus) throw new Error('useBus: нет BusContext');
  return bus;
}

/** Повреждён ли объект, внутри которого рисуется деталь (затемняет материалы). */
export const DamageContext = (g.__islDamage ??= createContext(false));
