// Яхта: длинный белый корпус, тонированные окна, золотая полоса, вращающийся радар. Качается на якоре.
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { PAL } from '../palette';
import { box, cyl, hullGeo } from '../materials';
import { useBus } from '../bus';
import { DARK_SMOKE, M, Smoke, useDamageBlend } from './parts';
import type { ModelProps } from './types';
import { Baked } from './Baked';

const TINT = { roughness: 0.3 };

export function Yacht({ damaged, variant }: ModelProps) {
  const bus = useBus();
  const ref = useRef<Group>(null!);
  const radar = useRef<Group>(null!);
  const blend = useDamageBlend(damaged);
  const phase = variant * 2.3 + 1.1;

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const amp = 1 + 1.4 * bus.weather.k;
    const d = blend(dt);
    const g = ref.current;
    g.position.y = 0.16 - 0.38 * d + Math.sin(t * 1.0 + phase) * 0.06 * amp;
    g.rotation.x = Math.sin(t * 0.8 + phase) * 0.04 * amp + 0.3 * d;
    g.rotation.z = Math.cos(t * 0.7 + phase) * 0.02 * amp + 0.1 * d;
    if (!damaged) radar.current.rotation.y = t * 2.2;
  });

  return (
    <group ref={ref}>
      <Baked id={`yacht:${+damaged}`}>
      <M g={hullGeo(4.6, 0.8, 1.5, 'yacht')} c={PAL.white} />
      <M g={box(3.2, 0.12, 1.3)} c={PAL.night} p={[-0.6, -0.02, 0]} o={TINT} />
      <M g={box(3.25, 0.05, 1.5)} c={PAL.gold} p={[-0.62, 0.3, 0]} />
      <M g={box(3.4, 0.08, 1.2)} c={PAL.wood} p={[-0.45, 0.42, 0]} />
      <M g={box(0.45, 0.06, 1.1)} c={PAL.wood} p={[-2.42, 0.02, 0]} />
      {/* салон с тонированными окнами */}
      <M g={box(1.9, 0.55, 1.05)} c={PAL.white} p={[-0.35, 0.73, 0]} />
      <M g={box(1.92, 0.22, 1.07)} c={PAL.night} p={[-0.35, 0.8, 0]} o={TINT} />
      <M g={box(0.08, 0.42, 0.95)} c={PAL.night} p={[0.68, 0.75, 0]} r={[0, 0, 0.62]} o={TINT} />
      {/* флайбридж */}
      <M g={box(1.1, 0.3, 0.9)} c={PAL.white} p={[-0.6, 1.15, 0]} />
      <M g={box(1.12, 0.12, 0.92)} c={PAL.night} p={[-0.6, 1.19, 0]} o={TINT} />
      <M g={cyl(0.03, 0.04, 0.6, 6)} c={PAL.white} p={[-0.75, 1.6, 0]} />
      {/* флажок на корме */}
      <M g={cyl(0.02, 0.02, 0.7, 5)} c={PAL.white} p={[-2.15, 0.75, 0]} />
      <M g={box(0.32, 0.2, 0.02)} c={PAL.roofCoral} p={[-2.31, 1.0, 0]} />
      </Baked>
      <group ref={radar} position={[-0.75, 1.92, 0]}>
        <M g={box(0.08, 0.06, 0.5)} c={PAL.night} />
      </group>
      {damaged && <Smoke origin={[-0.4, 1.4, 0]} color={DARK_SMOKE} count={4} size={0.22} speed={0.2} rise={2} />}
    </group>
  );
}
