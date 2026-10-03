// Палитра сцены — единственный источник цветов (docs/ART_DIRECTION.md, concept/index.html).
// Новые цвета не добавляем: нужен оттенок — смешиваем существующие через shade().
export const PAL = {
  seaDeep: 0x1e6f86, seaShallow: 0x55cbcb,
  sand: 0xf2d7a6, grass: 0x8cc56b, grassDark: 0x72b35c,
  rock: 0xa9a091, stone: 0xeadcc4,
  wood: 0xb07a4f, woodDark: 0x7e5236,
  roofCoral: 0xe8735a, roofTeal: 0x3e9a9a, roofGold: 0xf0a93b,
  wall: 0xfff4e2, leaf: 0x5fae4e, leafDark: 0x4a9442,
  skyTop: 0x7fbfe6, skyHorizon: 0xfbe3c8,
  window: 0xffd98a, white: 0xffffff, marble: 0xf6f2ea, night: 0x2e3a55,
  water: 0x7fd9de,
  // «Деньги» из UI-палитры: монеты, позолота статуи и банка
  gold: 0xf5b83d, goldDeep: 0xd9931c,
  // Оттенки, которые уже есть в утверждённом концепте
  smokeWall: 0xc98e5c, smokeRoof: 0x7a4b33, nut: 0x6e4a2c, sail: 0xfff8ec,
  puff: 0xf6f2ec, foam: 0xf4fffc, wing: 0xeef1f4, purple: 0xc77dcb,
  hemiSky: 0xcfeaf7, hemiGround: 0xf0d2a8, sun: 0xffe0b5,
} as const;

/** Цвета клумб и цветов на траве (как в концепте). */
export const FLOWER_COLORS = [PAL.roofCoral, PAL.roofGold, PAL.white, PAL.purple] as const;
