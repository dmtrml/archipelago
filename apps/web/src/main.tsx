import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import '@fontsource/unbounded/500.css';
import '@fontsource/unbounded/700.css';
import './styles.css';
import { Loader } from './Loader';

// Отдельные витрины грузятся только по запросу, без игровой логики.
const params = new URLSearchParams(location.search);
const Root = lazy(() => (
  params.has('director') ? import('./director/Director')
    : params.has('sound') ? import('./audio/SoundShowcase')
      : params.has('sandbox') ? import('./sandbox/Sandbox') : import('./App')
));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<Loader />}>
      <Root />
    </Suspense>
  </StrictMode>,
);
