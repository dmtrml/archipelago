// Домик для сдачи (порт дома с коралловой крышей) + белый заборчик и почтовый ящик.
import { PAL } from '../palette';
import { box } from '../materials';
import { DARK_SMOKE, House, M, Smoke, chimneyTop, Z } from './parts';
import type { ModelProps } from './types';
import { Baked } from './Baked';

const W = 2.4, D = 2.0, H = 1.6, RH = 1.1;
const FZ = D / 2 + 0.8; // линия забора перед фасадом

/** Секция забора от x0 до x1: столбики + две перекладины. */
function Fence({ x0, x1, broken = false }: { x0: number; x1: number; broken?: boolean }) {
  const n = Math.max(2, Math.round((x1 - x0) / 0.4) + 1);
  const len = x1 - x0, cx = (x0 + x1) / 2;
  return (
    <group rotation={broken ? [0.5, 0, 0] : Z} position={broken ? [0, 0, 0.05] : Z}>
      {Array.from({ length: n }, (_, i) => (
        <M key={i} g={box(0.08, 0.5, 0.08)} c={PAL.white} p={[x0 + (len * i) / (n - 1), 0.25, FZ]} />
      ))}
      <M g={box(len, 0.06, 0.04)} c={PAL.white} p={[cx, 0.17, FZ]} />
      <M g={box(len, 0.06, 0.04)} c={PAL.white} p={[cx, 0.38, FZ]} />
    </group>
  );
}

export function Cottage({ damaged }: ModelProps) {
  return (
    <group>
      <Baked id={`cottage:${+damaged}`}>
      <House w={W} d={D} h={H} roof={PAL.roofCoral} roofH={RH} crooked={damaged} />
      {/* заборчик с калиткой напротив двери */}
      <Fence x0={-1.45} x1={-0.85} />
      <Fence x0={-0.1} x1={1.45} broken={damaged} />
      {/* почтовый ящик у калитки */}
      <group position={[-1.15, 0, FZ + 0.4]}>
        <M g={box(0.08, 0.62, 0.08)} c={PAL.woodDark} p={[0, 0.31, 0]} />
        <M g={box(0.24, 0.2, 0.34)} c={PAL.roofTeal} p={[0, 0.7, 0]} />
        <M g={box(0.03, 0.2, 0.06)} c={PAL.roofCoral} p={[0.135, 0.82, -0.08]} r={damaged ? [0, 0, -1.2] : Z} />
      </group>
      </Baked>
      {damaged && <Smoke origin={chimneyTop(W, D, H, RH)} color={DARK_SMOKE} count={4} size={0.22} speed={0.2} rise={2} />}
    </group>
  );
}
