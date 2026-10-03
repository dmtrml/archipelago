// «Запекание» статичной части модели: дети рендерятся один раз скрыто, затем сливаются
// в 1–3 меша (по одному на вид материала, цвет — в вершинах). Результат кэшируется по id,
// так что две одинаковые хижины делят одну геометрию. Анимированные части держим снаружи.
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import {
  BufferAttribute, type BufferGeometry, Color, type Group, type InstancedMesh, Matrix4, type Mesh,
  MeshStandardMaterial,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

interface Part { geo: BufferGeometry; mat: MeshStandardMaterial; glow: boolean }

const CACHE = new Map<string, Part[]>();
if (import.meta.hot) import.meta.hot.on('vite:beforeUpdate', () => CACHE.clear());

const vcMats = new Map<string, MeshStandardMaterial>();
function vertexMat(src: MeshStandardMaterial) {
  const glow = src.emissiveIntensity > 0 && src.emissive.getHex() !== 0;
  const key = `${src.roughness}|${src.metalness}|${glow ? src.emissive.getHex() + ':' + src.emissiveIntensity : ''}`;
  let m = vcMats.get(key);
  if (!m) {
    m = new MeshStandardMaterial({
      vertexColors: true, flatShading: true, roughness: src.roughness, metalness: src.metalness,
      ...(glow ? { emissive: src.emissive.getHex(), emissiveIntensity: src.emissiveIntensity } : {}),
    });
    vcMats.set(key, m);
  }
  return { m, key, glow };
}

const inv = new Matrix4(), rel = new Matrix4();
const col = new Color();

function bakeByMaterial(root: Group): Part[] {
  root.updateMatrixWorld(true);
  inv.copy(root.matrixWorld).invert();
  const groups = new Map<string, { mat: MeshStandardMaterial; glow: boolean; geos: BufferGeometry[] }>();
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh || (mesh as InstancedMesh).isInstancedMesh) return;
    const src = mesh.material as MeshStandardMaterial;
    if (!src?.isMeshStandardMaterial) return;
    const { m, key, glow } = vertexMat(src);
    const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    g.applyMatrix4(rel.multiplyMatrices(inv, mesh.matrixWorld));
    const n = g.attributes.position.count;
    const c = new Float32Array(n * 3);
    col.copy(src.color);
    for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
    g.setAttribute('color', new BufferAttribute(c, 3));
    let grp = groups.get(key);
    if (!grp) { grp = { mat: m, glow, geos: [] }; groups.set(key, grp); }
    grp.geos.push(g);
  });
  const parts: Part[] = [];
  for (const { mat, glow, geos } of groups.values()) {
    const geo = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    geo.computeBoundingSphere();
    parts.push({ geo, mat, glow });
  }
  return parts;
}

/** Статичная часть модели одним-двумя мешами. id должен однозначно описывать содержимое. */
export function Baked({ id, children, shadow = true }: { id: string; children: ReactNode; shadow?: boolean }) {
  const src = useRef<Group>(null);
  const [, force] = useState(0);
  const parts = CACHE.get(id);

  useLayoutEffect(() => {
    if (parts) return;
    if (!CACHE.has(id) && src.current) CACHE.set(id, bakeByMaterial(src.current));
    force((x) => x + 1);
  });

  if (!parts) return <group ref={src} visible={false}>{children}</group>;
  return (
    <>
      {parts.map((p, i) => (
        <mesh key={`${id}:${i}`} geometry={p.geo} material={p.mat} castShadow={shadow && !p.glow} receiveShadow={shadow} />
      ))}
    </>
  );
}
