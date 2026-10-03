// Всплывающие суммы над объектами: DOM-плашки, позиция проецируется из 3D каждый кадр (без React-состояния).
// Каждый id показывается один раз; подписи к несуществующим якорям игнорируются.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { FloatLabel, PlacedItem } from './contract';
import { useBus } from './bus';

const LIFE = 2000;      // мс, совпадает с CSS-анимацией isl-rise
const STACK_PX = 30;    // сдвиг для одновременных подписей над одним объектом
const SEEN_CAP = 2000;

interface Active {
  id: string;
  anchor: string;
  el: HTMLDivElement;
  born: number;
  stack: number;
  x: number;
  y: number;
}

const v = new Vector3();

export function FloatLabels({ floats, items }: { floats: FloatLabel[]; items: PlacedItem[] }) {
  const bus = useBus();
  const seen = useRef(new Set<string>());
  const pending = useRef<FloatLabel[]>([]);
  const active = useRef<Active[]>([]);
  const uids = useMemo(() => new Set(items.map((i) => i.uid)), [items]);

  useEffect(() => {
    for (const f of floats) {
      if (seen.current.has(f.id)) continue;
      seen.current.add(f.id);
      const ok = f.anchor === 'home' || uids.has(f.anchor) || bus.anchors.has(f.anchor);
      if (ok) pending.current.push(f);
    }
    if (seen.current.size > SEEN_CAP) {
      const keep = new Set(floats.map((f) => f.id));
      seen.current = new Set([...seen.current].filter((id) => keep.has(id)));
    }
  }, [floats, uids, bus]);

  // при размонтировании убираем плашки и «забываем» их, чтобы повторный монтаж (StrictMode) их показал
  useEffect(() => () => {
    for (const a of active.current) { a.el.remove(); seen.current.delete(a.id); }
    for (const f of pending.current) seen.current.delete(f.id);
    active.current = [];
    pending.current = [];
  }, []);

  useFrame((state) => {
    const layer = bus.floatLayer;
    if (!layer) return;
    const now = performance.now();
    const list = active.current;

    while (pending.current.length) {
      const f = pending.current.shift()!;
      const el = document.createElement('div');
      el.className = `isl-float ${f.tone === 'neg' ? 'neg' : 'pos'}`;
      const inner = document.createElement('div');
      inner.className = 'isl-float-inner';
      if (f.tone !== 'neg') {
        const coin = document.createElement('span');
        coin.className = 'isl-coin';
        inner.appendChild(coin);
      }
      inner.appendChild(document.createTextNode(f.text));
      el.appendChild(inner);
      el.style.display = 'none';
      layer.appendChild(el);
      let stack = 0;
      for (const a of list) if (a.anchor === f.anchor && now - a.born < 700) stack++;
      list.push({ id: f.id, anchor: f.anchor, el, born: now, stack, x: NaN, y: NaN });
    }

    const { width, height } = state.size;
    for (let i = list.length - 1; i >= 0; i--) {
      const a = list[i];
      if (now - a.born > LIFE) { a.el.remove(); list.splice(i, 1); continue; }
      const anchor = bus.anchors.get(a.anchor);
      if (anchor) {
        anchor.obj.getWorldPosition(v);
        v.y += anchor.h;
        v.project(state.camera);
        if (v.z > 1) { a.el.style.display = 'none'; continue; }
        a.x = (v.x * 0.5 + 0.5) * width;
        a.y = (-v.y * 0.5 + 0.5) * height - a.stack * STACK_PX;
      }
      // якорь исчез (объект продан) — плашка доживает на последнем месте
      if (Number.isNaN(a.x)) continue;
      a.el.style.display = '';
      a.el.style.transform = `translate(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px)`;
    }
  });

  return null;
}
