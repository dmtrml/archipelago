// Рыбацкая лодка (порт из концепта): качается у пирса; повреждённая — накренилась и осела.
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { ExtrudeGeometry, type Group, Shape } from 'three';
import { PAL } from '../palette';
import { box, cached, cyl, hullGeo } from '../materials';
import { useBus } from '../bus';
import { M, useDamageBlend, Z } from './parts';
import type { ModelProps } from './types';
import { Baked } from './Baked';

const HULLS = [PAL.roofCoral, PAL.roofTeal, PAL.roofGold, PAL.wood];

const sailGeo = () =>
  cached('boatSail', () => {
    const s = new Shape();
    s.moveTo(0, 0); s.lineTo(0, 2.0); s.lineTo(-1.25, 0.1); s.closePath();
    return new ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false });
  });

export function Boat({ damaged, variant }: ModelProps) {
  const bus = useBus();
  const ref = useRef<Group>(null!);
  const blend = useDamageBlend(damaged);
  const phase = variant * 1.7 + 0.4;

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const amp = 1 + 1.6 * bus.weather.k;
    const d = blend(dt);
    const g = ref.current;
    g.position.y = 0.12 - 0.34 * d + Math.sin(t * 1.3 + phase) * 0.08 * amp;
    g.rotation.x = Math.sin(t * 1.1 + phase) * 0.06 * amp + 0.38 * d;
    g.rotation.z = Math.cos(t * 0.9 + phase) * 0.03 * amp - 0.12 * d;
  });

  return (
    <group ref={ref}>
      <Baked id={`boat:${variant % HULLS.length}:${+damaged}`}>
      <M g={hullGeo(2.6, 0.7, 1.15, 'boat')} c={HULLS[variant % HULLS.length]} />
      <M g={box(1.9, 0.1, 1.17)} c={PAL.white} p={[-0.3, 0.2, 0]} />
      <M g={box(1.7, 0.08, 0.85)} c={PAL.wood} p={[-0.25, 0.3, 0]} />
      <group position={[0.1, 0.25, 0]} rotation={damaged ? [0.3, 0, 0.22] : Z}>
        <M g={cyl(0.06, 0.07, 2.4, 6)} c={PAL.woodDark} p={[0, 1.2, 0]} />
        <M g={sailGeo()} c={PAL.sail} p={[-0.06, 0.23, -0.02]} s={damaged ? [0.75, 0.5, 1] : 1} />
      </group>
      </Baked>
    </group>
  );
}
