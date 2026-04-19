import ReactDOM from 'react-dom/client';

import { App } from '@/app/App';
import '@/styles.css';

function registerServiceWorker(): void {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.error('Service worker registration failed', error);
      });
    });
  }
}

registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
