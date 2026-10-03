// Бунгало для туристов (порт): домик на сваях, зонтик и шезлонг на песке.
import { PAL } from '../palette';
import { box, cone, cyl } from '../materials';
import { DARK_SMOKE, House, M, Smoke, Z } from './parts';
import type { ModelProps } from './types';
import { Baked } from './Baked';

export function Bungalow({ damaged }: ModelProps) {
  return (
    <group>
      <Baked id={`bungalow:${+damaged}`}>
      {[-1, 1].flatMap((x) =>
        [-0.8, 0.8].map((z) => (
          <M key={`${x}${z}`} g={cyl(0.09, 0.09, 1.0, 6)} c={PAL.woodDark} p={[x, 0.5, z]} />
        )),
      )}
      {/* настил с домиком; повреждённый — перекошен на сломанной свае */}
      <group rotation={damaged ? [0.05, 0, 0.08] : Z}>
        <M g={box(2.8, 0.14, 2.4)} c={PAL.wood} p={[0, 1.0, 0]} />
        <group position={[-0.2, 1.07, -0.2]}>
          <House w={2.0} d={1.6} h={1.25} roof={PAL.roofGold} roofH={1.1} chimney={false} crooked={damaged} />
        </group>
      </group>
      {/* зонтик: у повреждённого лежит на песке */}
      <group position={[2.2, 0, 0.65]} rotation={damaged ? [0.15, 0, -0.55] : Z}>
        <M g={cyl(0.04, 0.04, 1.8, 6)} c={PAL.white} p={[0, 0.9, 0]} />
        <M g={cone(1.0, 0.45, 8)} c={PAL.roofCoral} p={[0, 1.85, 0]} />
      </group>
      <M g={box(1.2, 0.16, 0.5)} c={PAL.white} p={[2.05, 0.2, -0.25]} r={[0, 0.4, 0]} />
      </Baked>
      {damaged && <Smoke origin={[-0.2, 3.6, -0.2]} color={DARK_SMOKE} count={4} size={0.22} speed={0.2} rise={2} />}
    </group>
  );
}
