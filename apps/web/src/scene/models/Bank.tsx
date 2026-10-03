// Банк: маленькое классическое здание — колонны, бирюзовый фронтон, золотая монета-эмблема.
import { PAL } from '../palette';
import { box, cyl, gableRoof } from '../materials';
import { DARK_SMOKE, M, Smoke, Win, Z } from './parts';
import type { ModelProps } from './types';
import { Baked } from './Baked';

const COLS = [-1.2, -0.4, 0.4, 1.2];
const BASE = 0.42;   // верх пола
const COL_H = 1.5;
const TOP = BASE + COL_H + 0.12; // низ архитрава

export function Bank({ damaged }: ModelProps) {
  return (
    <group>
      <Baked id={`bank:${+damaged}`}>
      {/* стилобат со ступенями */}
      <M g={box(3.6, 0.3, 3.0)} c={PAL.stone} p={[0, 0.15, 0]} />
      <M g={box(2.4, 0.15, 0.45)} c={PAL.stone} p={[0, 0.075, 1.7]} />
      <M g={box(3.2, 0.12, 2.6)} c={PAL.marble} p={[0, 0.36, 0]} />
      {/* целла с дверью и окнами */}
      <M g={box(2.6, COL_H + 0.12, 1.5)} c={PAL.wall} p={[0, BASE + (COL_H + 0.12) / 2, -0.45]} />
      <M g={box(0.62, 1.0, 0.06)} c={PAL.woodDark} p={[0, BASE + 0.5, 0.32]} />
      <M g={box(0.08, 0.08, 0.04)} c={PAL.gold} p={[0.2, BASE + 0.5, 0.36]} />
      <Win p={[-0.85, BASE + 0.85, 0.32]} w={0.4} h={0.55} />
      <Win p={[0.85, BASE + 0.85, 0.32]} w={0.4} h={0.55} />
      {/* колонны */}
      {COLS.map((x) => (
        <group key={x} position={[x, BASE, 0.95]}>
          <M g={box(0.38, 0.1, 0.38)} c={PAL.stone} p={[0, 0.05, 0]} />
          <M g={cyl(0.14, 0.16, COL_H - 0.1, 8)} c={PAL.marble} p={[0, 0.1 + (COL_H - 0.1) / 2, 0]} />
          <M g={box(0.42, 0.12, 0.42)} c={PAL.stone} p={[0, COL_H + 0.06, 0]} />
        </group>
      ))}
      {/* архитрав с золотой полосой */}
      <M g={box(3.2, 0.26, 2.6)} c={PAL.marble} p={[0, TOP + 0.13, 0]} />
      <M g={box(3.22, 0.07, 0.04)} c={PAL.gold} p={[0, TOP + 0.13, 1.31]} />
      {/* фронтон */}
      <group position={[0, TOP + 0.26 + (damaged ? 0.05 : 0), 0]} rotation={damaged ? [0.04, 0, -0.1] : Z}>
        <M g={gableRoof(3.2, 2.6, 0.8, 0.12)} c={PAL.roofTeal} />
        <M g={cyl(0.26, 0.26, 0.05, 14)} c={PAL.gold} p={[0, 0.3, 1.44]} r={[Math.PI / 2, 0, 0]} />
        <M g={cyl(0.17, 0.17, 0.05, 14)} c={PAL.goldDeep} p={[0, 0.3, 1.47]} r={[Math.PI / 2, 0, 0]} />
      </group>
      </Baked>
      {damaged && <Smoke origin={[0.6, TOP + 1.0, -0.3]} color={DARK_SMOKE} count={4} size={0.22} speed={0.2} rise={2} />}
    </group>
  );
}
