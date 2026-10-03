import { useEffect, useMemo, useState } from 'react';
import { IslandScene } from './scene/IslandScene';
import { placedItems, useGame } from './store';
import { TopBar } from './ui/TopBar';
import { DesktopLayout, MobileLayout, useMediaQuery } from './ui/Panels';
import { ToastView, WeekModal, WelcomeModal } from './ui/Modals';

/** Какую долю ширины экрана занимают боковые колонки интерфейса (только раскладка для компьютера). */
function useSideInsets(enabled: boolean): [number, number] {
  const measure = (): [number, number] => {
    if (!enabled) return [0, 0];
    const w = window.innerWidth;
    const l = document.querySelector('.col-left')?.getBoundingClientRect();
    const r = document.querySelector('.col-right')?.getBoundingClientRect();
    return [l ? +(l.right / w).toFixed(3) : 0, r ? +((w - r.left) / w).toFixed(3) : 0];
  };
  const [insets, setInsets] = useState<[number, number]>([0, 0]);
  useEffect(() => {
    const update = () => setInsets(measure());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [enabled]);
  return insets;
}

export default function App() {
  const world = useGame((s) => s.world);
  const floats = useGame((s) => s.floats);
  const weather = useGame((s) => s.weather);
  const sheetOpen = useGame((s) => s.sheetOpen);
  const focusItem = useGame((s) => s.focusItem);
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const items = useMemo(() => (world ? placedItems(world) : []), [world]);
  const sideInsets = useSideInsets(!isMobile && !!world);

  return (
    <>
      <IslandScene
        items={items}
        floats={floats}
        weather={weather}
        bottomInset={isMobile ? (sheetOpen ? 0.58 : 0.26) : 0}
        sideInsets={sideInsets}
        onItemClick={focusItem}
      />
      {world && (
        <div className={`hud ${isMobile ? 'mobile' : 'desktop'}`}>
          <TopBar />
          {isMobile ? <MobileLayout /> : <DesktopLayout />}
        </div>
      )}
      {!world && <WelcomeModal />}
      <WeekModal />
      <ToastView />
    </>
  );
}
