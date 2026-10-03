// Пляжное кафе: домик с полосатым навесом, вывеска с чашкой на коньке, столики под зонтиками.
import { PAL } from '../palette';
import { box, cone, cyl, gableRoof, ico, torus } from '../materials';
import { DARK_SMOKE, M, Smoke, Win, Z } from './parts';
import type { ModelProps } from './types';
import { Baked } from './Baked';

const BW = 2.8, BD = 1.5, BH = 1.5; // корпус
const BZ = -0.75;                    // корпус сдвинут назад, впереди — терраса
const FLOOR = 0.16;
const STRIPES = 7;

function Table({ x, z, color }: { x: number; z: number; color: number }) {
  return (
    <group position={[x, FLOOR, z]}>
      <M g={cyl(0.04, 0.05, 0.55, 6)} c={PAL.woodDark} p={[0, 0.27, 0]} />
      <M g={cyl(0.34, 0.34, 0.06, 10)} c={PAL.white} p={[0, 0.57, 0]} />
      <M g={cyl(0.13, 0.13, 0.32, 8)} c={PAL.woodDark} p={[-0.52, 0.16, 0.1]} />
      <M g={cyl(0.13, 0.13, 0.32, 8)} c={PAL.woodDark} p={[0.52, 0.16, -0.05]} />
      <M g={cyl(0.03, 0.03, 1.55, 6)} c={PAL.white} p={[0, 0.78, 0]} />
      <M g={cone(0.62, 0.3, 8)} c={color} p={[0, 1.6, 0]} />
    </group>
  );
}

export function Cafe({ damaged }: ModelProps) {
  const sw = BW / STRIPES;
  const awningTilt = damaged ? 0.95 : 0.42;
  return (
    <group>
      <Baked id={`cafe:${+damaged}`}>
      {/* терраса на сваях: на узком пляже её край висит над водой */}
      <M g={box(4.0, FLOOR, 3.5)} c={PAL.wood} p={[0, FLOOR / 2, 0.15]} />
      {[-1.85, -0.6, 0.6, 1.85].map((x) => (
        <M key={x} g={cyl(0.07, 0.07, 1.3, 6)} c={PAL.woodDark} p={[x, -0.5, 1.75]} />
      ))}
      {/* корпус и крыша */}
      <M g={box(BW, BH, BD)} c={PAL.wall} p={[0, FLOOR + BH / 2, BZ]} />
      <M g={gableRoof(BW, BD, 0.75, 0.22)} c={PAL.roofTeal} p={[0, FLOOR + BH, BZ]} />
      <M g={box(0.5, 0.9, 0.06)} c={PAL.woodDark} p={[-0.95, FLOOR + 0.45, BZ + BD / 2 + 0.03]} />
      <Win w={1.3} h={0.5} p={[0.45, FLOOR + 0.95, BZ + BD / 2 + 0.03]} />
      {/* прилавок под окном */}
      <M g={box(1.4, 0.08, 0.3)} c={PAL.wood} p={[0.45, FLOOR + 0.66, BZ + BD / 2 + 0.15]} />
      {/* полосатый навес */}
      <group position={[0, FLOOR + 1.42, BZ + BD / 2]} rotation={[awningTilt, 0, 0]}>
        {Array.from({ length: STRIPES }, (_, i) => {
          const c = i % 2 ? PAL.white : PAL.roofCoral;
          const x = -BW / 2 + sw * (i + 0.5);
          return (
            <group key={i}>
              <M g={box(sw, 0.05, 0.95)} c={c} p={[x, 0, 0.47]} />
              <M g={box(sw, 0.16, 0.04)} c={c} p={[x, -0.08, 0.95]} r={[-awningTilt, 0, 0]} />
            </group>
          );
        })}
      </group>
      {/* вывеска на коньке: коралловая доска с белой чашкой */}
      <group position={[0, FLOOR + BH + 0.75, BZ]} rotation={damaged ? [0, 0, 0.32] : Z}>
        <M g={box(0.06, 0.45, 0.06)} c={PAL.woodDark} p={[-0.5, 0.2, 0]} />
        <M g={box(0.06, 0.45, 0.06)} c={PAL.woodDark} p={[0.5, 0.2, 0]} />
        <M g={box(1.5, 0.56, 0.08)} c={PAL.roofCoral} p={[0, 0.66, 0]} />
        <M g={box(1.58, 0.06, 0.1)} c={PAL.roofGold} p={[0, 0.96, 0]} />
        <M g={cyl(0.15, 0.11, 0.26, 8)} c={PAL.white} p={[-0.05, 0.64, 0.1]} />
        <M g={torus(0.08, 0.025, 4, 8)} c={PAL.white} p={[0.12, 0.66, 0.1]} />
        <M g={ico(0.05)} c={PAL.white} p={[-0.08, 0.86, 0.1]} />
        <M g={ico(0.04)} c={PAL.white} p={[0.0, 0.93, 0.1]} />
      </group>
      {/* столики */}
      <Table x={-1.15} z={1.3} color={PAL.roofGold} />
      <Table x={1.2} z={1.2} color={PAL.roofTeal} />
      </Baked>
      {damaged && <Smoke origin={[0.6, FLOOR + BH + 0.9, BZ - 0.2]} color={DARK_SMOKE} count={4} size={0.22} speed={0.2} rise={2} />}
    </group>
  );
}
