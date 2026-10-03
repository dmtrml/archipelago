// /?sandbox — витрина 3D-сцены для визуальной проверки моделей, поломок, шторма и подписей.
import { useState, type CSSProperties, type ReactNode } from 'react';
import type { ModelId, SlotType } from '@arch/engine';
import { IslandScene } from '../scene/IslandScene';
import type { FloatLabel, PlacedItem, Weather } from '../scene/contract';

// Вместимость — как SLOT_CAPACITY в packages/engine/src/slots.ts
const CAP: Record<SlotType, number> = { pier: 4, plot: 6, beach: 3, plaza: 2, sea: 2, finance: 99 };
const MODEL_SLOT: Record<ModelId, SlotType> = {
  boat: 'pier', smokehouse: 'plot', cottage: 'plot', garden: 'plot',
  bungalow: 'beach', cafe: 'beach', fountain: 'plaza', statue: 'plaza',
  yacht: 'sea', pearlFarm: 'sea', bank: 'finance',
};
const MODELS = Object.keys(MODEL_SLOT) as ModelId[];
const SLOT_MODELS: Record<SlotType, ModelId[]> = {
  pier: ['boat'], plot: ['smokehouse', 'cottage', 'garden'], beach: ['bungalow', 'cafe'],
  plaza: ['fountain', 'statue'], sea: ['yacht', 'pearlFarm'], finance: ['bank'],
};

let uidSeq = 1;
let floatSeq = 1;

function freeIndex(items: PlacedItem[], slot: SlotType): number {
  const used = new Set(items.filter((i) => i.slot === slot).map((i) => i.slotIndex));
  for (let i = 0; i < CAP[slot]; i++) if (!used.has(i)) return i;
  return -1;
}

const panel: CSSProperties = {
  position: 'fixed', top: 12, left: 12, zIndex: 10, width: 300, maxHeight: 'calc(100vh - 24px)', overflow: 'auto',
  background: 'rgba(255,251,243,.92)', borderRadius: 14, padding: 12, font: '600 12px Manrope, system-ui, sans-serif',
  color: '#1F2A44', boxShadow: '0 10px 30px rgba(31,42,68,.16)',
};
const btn: CSSProperties = {
  font: '700 11px Manrope, system-ui, sans-serif', border: 0, borderRadius: 8, padding: '5px 8px', margin: 2,
  background: 'rgba(31,42,68,.08)', color: '#1F2A44', cursor: 'pointer',
};
const gold: CSSProperties = { ...btn, background: '#F5B83D', color: '#3A2600' };

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: '#5B6680', marginBottom: 2 }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>{children}</div>
    </div>
  );
}

export default function Sandbox() {
  const [items, setItems] = useState<PlacedItem[]>([]);
  const [floats, setFloats] = useState<FloatLabel[]>([]);
  const [weather, setWeather] = useState<Weather>('clear');
  const [inset, setInset] = useState(0);
  const [clicked, setClicked] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const [sceneKey, setSceneKey] = useState(0);

  const add = (model: ModelId) => setItems((list) => {
    const slot = MODEL_SLOT[model];
    const idx = freeIndex(list, slot);
    if (idx < 0) return list;
    return [...list, { uid: `u${uidSeq++}`, model, slot, slotIndex: idx, damaged: false }];
  });

  const fillAll = () => setItems((list) => {
    const next = [...list];
    for (const slot of Object.keys(SLOT_MODELS) as SlotType[]) {
      const pool = SLOT_MODELS[slot];
      const limit = slot === 'finance' ? 3 : CAP[slot];
      let n = next.filter((i) => i.slot === slot).length;
      while (n < limit) {
        const idx = freeIndex(next, slot);
        if (idx < 0) break;
        next.push({ uid: `u${uidSeq++}`, model: pool[idx % pool.length], slot, slotIndex: idx, damaged: false });
        n++;
      }
    }
    return next;
  });

  const float = (anchor: string, tone: 'pos' | 'neg' = Math.random() < 0.7 ? 'pos' : 'neg') => {
    const amount = 5 + Math.floor(Math.random() * 40);
    const text = tone === 'pos' ? `+${amount} /нед` : `−${amount} /нед`;
    setFloats((f) => [...f.slice(-20), { id: `f${floatSeq++}`, anchor, text, tone }]);
  };
  const floatRandom = () => {
    if (!items.length) return float('home');
    float(items[Math.floor(Math.random() * items.length)].uid);
  };
  const floatAll = () => {
    const batch: FloatLabel[] = items.map((i) => ({ id: `f${floatSeq++}`, anchor: i.uid, text: `+${10 + Math.floor(Math.random() * 30)}`, tone: 'pos' }));
    batch.push({ id: `f${floatSeq++}`, anchor: 'home', text: '+120 зарплата', tone: 'pos' });
    batch.push({ id: `f${floatSeq++}`, anchor: 'home', text: '−80 жизнь', tone: 'neg' });
    setFloats((f) => [...f.slice(-20), ...batch]);
  };

  const toggleDamage = (uid: string) => setItems((l) => l.map((i) => (i.uid === uid ? { ...i, damaged: !i.damaged } : i)));
  const damageAll = (v: boolean) => setItems((l) => l.map((i) => ({ ...i, damaged: v })));
  const remove = (uid: string) => setItems((l) => l.filter((i) => i.uid !== uid));

  return (
    <>
      <IslandScene
        key={sceneKey}
        items={items}
        floats={floats}
        weather={weather}
        bottomInset={inset}
        onItemClick={(uid) => { setClicked(uid); float(uid, 'pos'); }}
      />
      <div style={panel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <b style={{ font: '700 13px Unbounded, sans-serif' }}>Сцена · sandbox</b>
          <button style={btn} onClick={() => setOpen(!open)}>{open ? 'свернуть' : 'развернуть'}</button>
        </div>
        {open && (
          <>
            <Row title="Добавить в свободный слот">
              {MODELS.map((m) => (
                <button key={m} style={btn} onClick={() => add(m)} disabled={freeIndex(items, MODEL_SLOT[m]) < 0}>+ {m}</button>
              ))}
            </Row>
            <Row title="Остров">
              <button style={gold} onClick={fillAll}>Заполнить всё</button>
              <button style={btn} onClick={() => setItems([])}>Очистить</button>
              <button style={btn} onClick={() => setItems((l) => l.slice(0, -1))}>Убрать последний</button>
              <button style={btn} onClick={() => damageAll(true)}>Сломать всё</button>
              <button style={btn} onClick={() => damageAll(false)}>Починить всё</button>
              <button style={btn} onClick={() => setSceneKey((k) => k + 1)}>Перезапуск сцены</button>
            </Row>
            <Row title="Погода и подписи">
              <button style={weather === 'storm' ? gold : btn} onClick={() => setWeather(weather === 'storm' ? 'clear' : 'storm')}>
                {weather === 'storm' ? 'Шторм → ясно' : 'Ясно → шторм'}
              </button>
              <button style={btn} onClick={floatRandom}>Сумма: случайный</button>
              <button style={btn} onClick={() => float('home')}>Сумма: дом</button>
              <button style={btn} onClick={floatAll}>Суммы: все</button>
              <button style={btn} onClick={() => float('nope')}>Несущ. якорь</button>
            </Row>
            <Row title={`bottomInset: ${inset.toFixed(2)}`}>
              <input type="range" min={0} max={0.6} step={0.01} value={inset} onChange={(e) => setInset(+e.target.value)} style={{ width: '100%' }} />
            </Row>
            {clicked && <div style={{ marginTop: 6 }}>Клик: <b>{clicked}</b></div>}
            <Row title={`Объекты (${items.length})`}>
              <div style={{ width: '100%' }}>
                {items.map((i) => (
                  <div key={i.uid} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0', background: i.uid === clicked ? 'rgba(245,184,61,.25)' : undefined }}>
                    <span style={{ flex: 1 }}>{i.uid} · {i.model} · {i.slot}[{i.slotIndex}]</span>
                    <button style={i.damaged ? gold : btn} onClick={() => toggleDamage(i.uid)}>{i.damaged ? 'слом.' : 'цел'}</button>
                    <button style={btn} onClick={() => float(i.uid)}>±</button>
                    <button style={btn} onClick={() => remove(i.uid)}>×</button>
                  </div>
                ))}
              </div>
            </Row>
          </>
        )}
      </div>
    </>
  );
}
