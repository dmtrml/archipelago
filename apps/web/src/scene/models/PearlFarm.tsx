// «Жемчужная ферма»: плавучая платформа с буйками и пирамидкой слишком блестящего жемчуга
// в раскрытой раковине. Красиво, но подозрительно: жемчуг пульсирует, вокруг искры, табличка «только вверх».
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { type Group, type InstancedMesh, Matrix4, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import { PAL } from '../palette';
import { box, cone, cyl, ico, mat, octa, shade, sphere } from '../materials';
import { useBus } from '../bus';
import { M, noRay, useDamageBlend } from './parts';
import type { ModelProps } from './types';
import { Baked } from './Baked';

const PEARL = shade(PAL.purple, PAL.roofCoral, 0.22);

// пирамида 3×3 + 2×2 + 1 — «пирамида» из жемчужин
const PEARLS: [number, number, number][] = [];
for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) PEARLS.push([(i - 1) * 0.27, 0, (j - 1) * 0.27]);
for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) PEARLS.push([(i - 0.5) * 0.27, 0.22, (j - 0.5) * 0.27]);
PEARLS.push([0, 0.44, 0]);

const BUOYS: [number, number][] = [[2.0, 1.7], [-1.9, 1.8], [-1.8, -1.9], [1.9, -1.8]];

export function PearlFarm({ damaged, variant }: ModelProps) {
  const bus = useBus();
  const raft = useRef<Group>(null!);
  const pearls = useRef<InstancedMesh>(null!);
  const sparks = useRef<InstancedMesh>(null!);
  const buoys = useRef<Group>(null!);
  const blend = useDamageBlend(damaged);
  const tmp = useMemo(() => new Object3D(), []);
  const phase = variant * 1.9;

  const pearlMat = useMemo(
    () => new MeshStandardMaterial({ color: PEARL, emissive: PEARL, emissiveIntensity: 0.5, roughness: 0.15, metalness: 0.3, flatShading: true }),
    [],
  );
  useEffect(() => () => pearlMat.dispose(), [pearlMat]);

  useLayoutEffect(() => {
    const m = new Matrix4(), v = new Vector3();
    PEARLS.forEach((p, i) => pearls.current.setMatrixAt(i, m.makeTranslation(v.set(p[0], p[1], p[2]))));
    pearls.current.instanceMatrix.needsUpdate = true;
    pearls.current.computeBoundingSphere();
  }, []);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const k = bus.weather.k;
    const d = blend(dt);
    const amp = 1 + 1.6 * k;
    raft.current.position.y = -0.28 * d + Math.sin(t * 1.2 + phase) * 0.06 * amp;
    raft.current.rotation.x = Math.sin(t * 0.9 + phase) * 0.04 * amp + 0.22 * d;
    raft.current.rotation.z = Math.cos(t * 1.1 + phase) * 0.04 * amp - 0.1 * d;
    // слишком блестящий жемчуг
    pearlMat.emissiveIntensity = (1 - d) * (0.45 + 0.4 * (0.5 + 0.5 * Math.sin(t * 2.6))) + 0.05;
    // искры вокруг пирамидки
    for (let i = 0; i < 4; i++) {
      const a = t * 0.9 + (i * Math.PI) / 2;
      tmp.position.set(Math.cos(a) * 0.62, 1.15 + Math.sin(t * 2 + i) * 0.18, Math.sin(a) * 0.62);
      tmp.rotation.set(t * 2, t * 3 + i, 0);
      tmp.scale.setScalar(Math.max(0.001, (1 - d) * Math.max(0, Math.sin(t * 4 + i * 1.7))));
      tmp.updateMatrix();
      sparks.current.setMatrixAt(i, tmp.matrix);
    }
    sparks.current.instanceMatrix.needsUpdate = true;
    // буйки качаются сами по себе
    buoys.current.children.forEach((b, i) => {
      b.position.y = Math.sin(t * 1.5 + i * 1.3) * 0.1 * amp;
      b.rotation.z = Math.sin(t * 1.2 + i) * 0.15 * amp;
    });
  });

  return (
    <group>
      <group ref={raft}>
        <Baked id={`pearlRaft:${+damaged}`}>
        {/* понтоны и настил */}
        <M g={cyl(0.26, 0.26, 2.8, 8)} c={PAL.white} p={[0, 0.12, 1.0]} r={[0, 0, Math.PI / 2]} />
        <M g={cyl(0.26, 0.26, 2.8, 8)} c={PAL.white} p={[0, 0.12, -1.0]} r={[0, 0, Math.PI / 2]} />
        <M g={box(2.6, 0.12, 2.6)} c={PAL.wood} p={[0, 0.42, 0]} />
        {[-0.9, -0.3, 0.3, 0.9].map((x) => (
          <M key={x} g={box(0.05, 0.13, 2.62)} c={PAL.woodDark} p={[x, 0.425, 0]} />
        ))}
        {/* раскрытая раковина */}
        <M g={cyl(0.66, 0.42, 0.2, 10)} c={PAL.stone} p={[0, 0.58, 0]} />
        <M g={cyl(0.66, 0.6, 0.08, 10)} c={PAL.stone} p={[0, 0.98, -0.62]} r={[-1.05, 0, 0]} />
        {/* табличка «только вверх» */}
        <group position={[1.0, 0.48, 0.95]} rotation={[0, -0.3, damaged ? 0.4 : 0]}>
          <M g={box(0.07, 1.0, 0.07)} c={PAL.woodDark} p={[0, 0.5, 0]} />
          <M g={box(0.62, 0.48, 0.06)} c={PAL.gold} p={[0, 1.1, 0]} />
          <M g={box(0.08, 0.24, 0.03)} c={PAL.roofCoral} p={[0, 1.04, 0.045]} />
          <M g={cone(0.13, 0.16, 3)} c={PAL.roofCoral} p={[0, 1.23, 0.045]} />
        </group>
        </Baked>
        {/* жемчужная пирамида */}
        <group position={[0, 0.82, 0]}>
          <instancedMesh ref={pearls} args={[ico(0.15, 1), pearlMat, PEARLS.length]} castShadow />
        </group>
        <instancedMesh ref={sparks} args={[octa(0.07), mat(PAL.white, { emissive: PAL.white, emissiveIntensity: 1 }), 4]} frustumCulled={false} raycast={noRay} />
      </group>
      {/* буйки по углам */}
      <group ref={buoys}>
        {BUOYS.map(([x, z], i) => (
          <group key={i} position={[x, 0, z]}>
            <M g={sphere(0.22, 8, 6)} c={i % 2 ? PAL.white : PAL.roofCoral} p={[0, 0.08, 0]} />
            <M g={cone(0.07, 0.3, 5)} c={PAL.night} p={[0, 0.36, 0]} />
          </group>
        ))}
      </group>
    </group>
  );
}
