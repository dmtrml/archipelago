// Сад: две клумбы с цветами, арка с вьюнком, скамейка, дорожка из камней.
// Повреждённый — цветы поникли, арка покосилась.
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, type InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { FLOWER_COLORS, PAL } from '../palette';
import { box, cone, cyl, damagedColor, ico, mat, torus } from '../materials';
import { M, noRay, Z } from './parts';
import type { ModelProps } from './types';
import { Baked } from './Baked';
import { makeRng } from '../layout';

const BEDS: [number, number][] = [[-0.95, 0.55], [0.95, 0.55]];
const PER_ROW = 5;

function useFlowerLayout() {
  return useMemo(() => {
    const { rr } = makeRng(515);
    const pts: { x: number; z: number; h: number }[] = [];
    for (const [bx, bz] of BEDS) for (const row of [-0.14, 0.14]) for (let i = 0; i < PER_ROW; i++) {
      pts.push({ x: bx - 0.48 + i * 0.24 + rr(-0.03, 0.03), z: bz + row + rr(-0.03, 0.03), h: rr(0.18, 0.3) });
    }
    return pts;
  }, []);
}

function Flowers({ damaged }: { damaged: boolean }) {
  const pts = useFlowerLayout();
  const heads = useRef<InstancedMesh>(null!);
  const stems = useRef<InstancedMesh>(null!);
  useLayoutEffect(() => {
    const m = new Matrix4(), q = new Quaternion(), s = new Vector3(), p = new Vector3(), c = new Color();
    pts.forEach((f, i) => {
      const h = damaged ? f.h * 0.55 : f.h;
      stems.current.setMatrixAt(i, m.compose(p.set(f.x, 0.26 + h / 2, f.z), q.identity(), s.set(1, h / 0.3, 1)));
      heads.current.setMatrixAt(i, m.compose(p.set(f.x, 0.26 + h, f.z), q.identity(), s.setScalar(damaged ? 0.65 : 1)));
      const col = FLOWER_COLORS[i % FLOWER_COLORS.length];
      heads.current.setColorAt(i, c.setHex(damaged ? damagedColor(col) : col));
    });
    for (const im of [stems.current, heads.current]) {
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
    }
    if (heads.current.instanceColor) heads.current.instanceColor.needsUpdate = true;
  }, [pts, damaged]);
  return (
    <>
      <instancedMesh ref={stems} args={[cone(0.07, 0.3, 4), mat(PAL.leafDark), pts.length]} castShadow raycast={noRay} />
      <instancedMesh ref={heads} args={[ico(0.11), mat(PAL.white), pts.length]} castShadow />
    </>
  );
}

export function Garden({ damaged }: ModelProps) {
  return (
    <group>
      <Flowers damaged={damaged} />
      <Baked id={`garden:${+damaged}`}>
      {/* клумбы */}
      {BEDS.map(([x, z]) => (
        <group key={x} position={[x, 0, z]}>
          <M g={box(1.35, 0.22, 0.66)} c={PAL.wood} p={[0, 0.11, 0]} />
          <M g={box(1.22, 0.06, 0.54)} c={PAL.woodDark} p={[0, 0.23, 0]} />
        </group>
      ))}
      {/* дорожка к скамейке */}
      {[[0.02, 1.45], [-0.06, 0.9], [0.04, 0.35], [-0.02, -0.2]].map(([x, z], i) => (
        <M key={i} g={cyl(0.22, 0.24, 0.06, 7)} c={PAL.stone} p={[x, 0.03, z]} r={[0, i, 0]} />
      ))}
      {/* арка с вьюнком */}
      <group position={[0, 0, -0.95]} rotation={damaged ? [0, 0, 0.16] : Z}>
        <M g={box(0.1, 1.5, 0.1)} c={PAL.white} p={[-0.8, 0.75, 0]} />
        <M g={box(0.1, 1.5, 0.1)} c={PAL.white} p={[0.8, 0.75, 0]} />
        <M g={torus(0.8, 0.06, 5, 12, Math.PI)} c={PAL.white} p={[0, 1.5, 0]} />
        {[0.25, 0.75, 1.3, 1.85, 2.4, 2.9].map((a, i) => (
          <M key={i} g={ico(0.15)} c={i % 2 ? PAL.leaf : PAL.leafDark} p={[Math.cos(a) * 0.8, 1.5 + Math.sin(a) * 0.8, 0.02]} />
        ))}
        {[0.5, 1.55, 2.65].map((a, i) => (
          <M key={i} g={ico(0.09)} c={i === 1 ? PAL.roofGold : PAL.roofCoral} p={[Math.cos(a) * 0.82, 1.5 + Math.sin(a) * 0.82, 0.12]} />
        ))}
        <M g={ico(0.14)} c={PAL.leafDark} p={[-0.8, 0.5, 0.05]} />
        <M g={ico(0.12)} c={PAL.leaf} p={[0.8, 0.9, 0.05]} />
      </group>
      {/* скамейка под аркой */}
      <group position={[0, 0, -0.85]}>
        <M g={box(1.0, 0.07, 0.36)} c={PAL.wood} p={[0, 0.4, 0]} />
        <M g={box(1.0, 0.3, 0.06)} c={PAL.wood} p={[0, 0.62, -0.17]} />
        <M g={box(0.07, 0.4, 0.3)} c={PAL.woodDark} p={[-0.42, 0.2, 0]} />
        <M g={box(0.07, 0.4, 0.3)} c={PAL.woodDark} p={[0.42, 0.2, 0]} />
      </group>
      {/* кусты по углам */}
      <M g={ico(0.38)} c={PAL.leafDark} p={[-1.45, 0.3, -0.8]} />
      <M g={ico(0.3)} c={PAL.leaf} p={[1.45, 0.25, -0.75]} />
      </Baked>
    </group>
  );
}
