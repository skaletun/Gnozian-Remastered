import { createRoot } from 'react-dom/client';
import './index.css';
import './components/ui/remaster2d.css';
import './crashAssistantRenderer';
import App from './App';
createRoot(document.getElementById('root')!).render(<App />);
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
      .then(registration => registration.update())
      .catch(console.warn);
  });
}

// Installed Android PWAs can lock orientation; Safari falls back to the
// responsive landscape-only gate without hiding or unloading game state.
const standalone = window.matchMedia('(display-mode: standalone)').matches
  || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const lockableOrientation = screen.orientation as (ScreenOrientation & {
  lock?: (orientation: 'landscape') => Promise<void>;
}) | undefined;
if (standalone && typeof lockableOrientation?.lock === 'function') {
  window.addEventListener('pointerdown', () => {
    void lockableOrientation.lock?.('landscape').catch(() => {
      // Some platforms refuse programmatic locks; the CSS portrait gate remains active.
    });
  }, { once: true, capture: true });
}
