// Мраморный фонтан (порт) с каплями. Повреждённый — вода не бьёт, шар на верхушке съехал.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { type InstancedMesh, Object3D } from 'three';
import { PAL } from '../palette';
import { cyl, ico, mat, sphere, torus } from '../materials';
import { M, noRay } from './parts';
import type { ModelProps } from './types';
import { Baked } from './Baked';

const DROPS = 16;
const WATER = { roughness: 0.2 };

function Drops() {
  const ref = useRef<InstancedMesh>(null!);
  const tmp = useMemo(() => new Object3D(), []);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    for (let i = 0; i < DROPS; i++) {
      const k = (t * 0.7 + i / DROPS) % 1, a = i * 2.39;
      const r = 0.25 + k * 0.85;
      tmp.position.set(Math.cos(a) * r, 1.9 + 1.2 * k - 2.6 * k * k, Math.sin(a) * r);
      tmp.updateMatrix();
      ref.current.setMatrixAt(i, tmp.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[ico(0.07), mat(PAL.water, WATER), DROPS]} frustumCulled={false} raycast={noRay} />;
}

export function Fountain({ damaged }: ModelProps) {
  return (
    <group>
      <Baked id={`fountain:${+damaged}`}>
      <M g={cyl(1.45, 1.55, 0.45, 14)} c={PAL.marble} p={[0, 0.22, 0]} />
      <M g={cyl(1.25, 1.25, 0.05, 14)} c={PAL.water} o={WATER} p={[0, 0.43, 0]} />
      <M g={torus(1.5, 0.07, 6, 18)} c={PAL.roofGold} p={[0, 0.46, 0]} r={[Math.PI / 2, 0, 0]} />
      <M g={cyl(0.2, 0.3, 1.1, 8)} c={PAL.marble} p={[0, 0.95, 0]} />
      <M g={cyl(0.75, 0.3, 0.3, 12)} c={PAL.marble} p={[0, 1.55, 0]} />
      <M g={sphere(0.2, 8, 6)} c={PAL.roofGold} p={damaged ? [0.55, 1.78, 0.2] : [0, 1.85, 0]} />
      </Baked>
      {!damaged && <Drops />}
    </group>
  );
}
