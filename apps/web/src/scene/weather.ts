// Погода: плавный переход «золотой час» ⇄ «шторм» (~1.5 с). Всё через мутируемые объекты, без React-состояния.
import { Color } from 'three';
import { PAL } from './palette';
import { shade } from './materials';

export interface WeatherState {
  /** 0 — ясно, 1 — шторм */
  target: number;
  /** линейный прогресс перехода */
  p: number;
  /** сглаженный коэффициент шторма 0..1 — его читают все слои сцены */
  k: number;
  /** «время волн»: в шторм течёт быстрее, без скачков фазы */
  waveTime: number;
  /** яркость вспышки молнии 0..1 */
  flash: number;
  flashT0: number;
  nextFlash: number;
}

export const createWeather = (storm: boolean): WeatherState => {
  const v = storm ? 1 : 0;
  return { target: v, p: v, k: v, waveTime: 0, flash: 0, flashT0: -10, nextFlash: 3 };
};

const TWEEN = 1.5;

export function stepWeather(w: WeatherState, dt: number, t: number) {
  const step = dt / TWEEN;
  if (w.p < w.target) w.p = Math.min(w.target, w.p + step);
  else if (w.p > w.target) w.p = Math.max(w.target, w.p - step);
  w.k = w.p * w.p * (3 - 2 * w.p);
  w.waveTime += dt * (1 + 0.6 * w.k);

  // Молния: двойная вспышка раз в 3–9 секунд, только в разгар шторма
  if (w.k > 0.75 && t > w.nextFlash) {
    w.flashT0 = t;
    w.nextFlash = t + 3 + Math.random() * 6;
  }
  if (w.k < 0.75 && w.nextFlash < t + 1) w.nextFlash = t + 1.5;
  const x = t - w.flashT0;
  w.flash = x < 0 ? 0 : x < 0.07 ? 1 : x < 0.15 ? 0.25 : x < 0.22 ? 0.85 : Math.max(0, 0.85 - (x - 0.22) * 2.5);
  w.flash *= w.k;
}

type Pair = readonly [Color, Color];
const pair = (clear: number, storm: number): Pair => [new Color(clear), new Color(storm)];

/** Пары цветов «ясно → шторм» (штормовые — смеси цветов палитры). */
export const WX = {
  skyTop: pair(PAL.skyTop, shade(PAL.night, PAL.skyTop, 0.32)),
  horizon: pair(PAL.skyHorizon, shade(PAL.rock, PAL.night, 0.32)),
  hemiSky: pair(PAL.hemiSky, shade(PAL.rock, PAL.white, 0.3)),
  hemiGround: pair(PAL.hemiGround, shade(PAL.rock, PAL.night, 0.35)),
  sun: pair(PAL.sun, shade(PAL.white, PAL.rock, 0.45)),
  shallow: pair(PAL.seaShallow, shade(PAL.seaShallow, PAL.night, 0.42)),
  deep: pair(PAL.seaDeep, shade(PAL.seaDeep, PAL.night, 0.5)),
  cloud: pair(PAL.white, shade(PAL.rock, PAL.night, 0.38)),
} as const;

export const mixWx = (out: Color, p: Pair, k: number) => out.lerpColors(p[0], p[1], k);
