import ReactDOM from 'react-dom/client';

import { App } from '@/app/App';
import { startHoldfastRuntime } from '@/app/runtime/service-worker';
import '@/styles.css';

void startHoldfastRuntime();

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
