// ГПСЧ mulberry32. Всё его состояние — одно 32-битное число (world.rng),
// поэтому мир можно сохранить в JSON и воспроизвести с точностью до монеты.

export class Rng {
  constructor(public state: number) {
    this.state = state >>> 0;
  }

  /** Равномерное число в [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    return mix(this.state);
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Целое число в [min, max] включительно. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Выбор ключа по весам. */
  weighted<K extends string>(weights: Readonly<Record<K, number>>): K {
    const keys = Object.keys(weights) as K[];
    const total = keys.reduce((sum, k) => sum + weights[k], 0);
    let roll = this.next() * total;
    for (const k of keys) {
      roll -= weights[k];
      if (roll < 0) return k;
    }
    return keys[keys.length - 1];
  }
}

function mix(a: number): number {
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Детерминированное «подглядывание» без сдвига состояния: число в [0, 1) из состояния и соли.
 * Нужно ботам — они не меняют мир иначе как через действия.
 */
export function peekRandom(state: number, salt: number): number {
  return mix((state ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0);
}

/** Строка → число для соли (стабильный хеш). */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
