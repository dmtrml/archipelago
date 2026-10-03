// Остров: пляж, трава, холм под домом и пена прибоя вдоль берега.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, DoubleSide, Float32BufferAttribute, type Mesh, MeshBasicMaterial } from 'three';
import { PAL } from '../palette';
import { mat } from '../materials';
import { blobGeometry } from '../builders';
import { BEACH_R, BEACH_Y, GRASS_R, GRASS_Y, HILL_POS, shore } from '../layout';
import { useBus } from '../bus';

const noRay = () => null;

function Foam() {
  const bus = useBus();
  const ref = useRef<Mesh>(null!);
  const { geo, material } = useMemo(() => {
    const segs = 120, pos: number[] = [], idx: number[] = [];
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2, f = shore(a);
      for (const r of [BEACH_R * 1.015 * f, BEACH_R * 1.085 * f]) pos.push(Math.cos(a) * r, 0, Math.sin(a) * r);
      if (i < segs) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    const material = new MeshBasicMaterial({ color: PAL.foam, transparent: true, opacity: 0.75, side: DoubleSide, depthWrite: false });
    return { geo, material };
  }, []);
  useEffect(() => () => { geo.dispose(); material.dispose(); }, [geo, material]);

  useFrame(() => {
    const { waveTime: t, k } = bus.weather;
    material.opacity = 0.5 + 0.3 * Math.sin(t * 1.4) + 0.12 * k;
    ref.current.scale.setScalar(1 + (0.008 + 0.012 * k) * Math.sin(t * 1.4));
  });

  return <mesh ref={ref} geometry={geo} material={material} position={[0, 0.12, 0]} raycast={noRay} />;
}

export function Terrain() {
  const geos = useMemo(
    () => ({
      beach: blobGeometry(BEACH_R, BEACH_R * 1.08, 2.6, 1, 56),
      grass: blobGeometry(GRASS_R, GRASS_R * 1.04, 1.0, 1, 48),
      hill: blobGeometry(2.9, 5.0, 2.2, 0.6, 22, 2.0),
    }),
    [],
  );
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);

  return (
    <group>
      <mesh geometry={geos.beach} material={mat(PAL.sand)} position={[0, BEACH_Y - 1.3, 0]} castShadow receiveShadow raycast={noRay} />
      <mesh geometry={geos.grass} material={mat(PAL.grass)} position={[0, GRASS_Y - 0.5, 0]} castShadow receiveShadow raycast={noRay} />
      <mesh geometry={geos.hill} material={mat(PAL.grassDark)} position={[HILL_POS.x, GRASS_Y + 1.1, HILL_POS.z]} castShadow receiveShadow raycast={noRay} />
      <Foam />
    </group>
  );
}
