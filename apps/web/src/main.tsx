import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

// /?sandbox — витрина 3D-сцены для проверки моделей без игровой логики
const isSandbox = new URLSearchParams(location.search).has('sandbox');
const Root = lazy(() => (isSandbox ? import('./sandbox/Sandbox') : import('./App')));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      <Root />
    </Suspense>
  </StrictMode>,
);
