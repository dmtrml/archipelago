import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

// Отдельные витрины грузятся только по запросу, без игровой логики.
const params = new URLSearchParams(location.search);
const Root = lazy(() => (
  params.has('sound') ? import('./audio/SoundShowcase')
    : params.has('sandbox') ? import('./sandbox/Sandbox') : import('./App')
));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      <Root />
    </Suspense>
  </StrictMode>,
);
