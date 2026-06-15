import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import App from './App';
import { ThemeProvider } from './lib/theme';
import i18n from './lib/i18n';
import './index.css';

// ── Fetch API key on startup and wrap window.fetch ──
let apiKeyResolve: (key: string) => void;
const apiKeyReady = new Promise<string>(resolve => { apiKeyResolve = resolve; });

fetch('/api/config')
  .then(r => r.json())
  .then(data => apiKeyResolve(data.apiKey || ''))
  .catch(() => apiKeyResolve(''));

const originalFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();
  // Only add API key to our own API calls
  if (url.startsWith('/api/') && url !== '/api/config') {
    const key = await apiKeyReady;
    if (key) {
      init = init || {};
      init.headers = init.headers || {};
      if (init.headers instanceof Headers) {
        init.headers.set('x-api-key', key);
      } else if (Array.isArray(init.headers)) {
        init.headers.push(['x-api-key', key]);
      } else {
        (init.headers as Record<string, string>)['x-api-key'] = key;
      }
    }
  }
  return originalFetch(input, init);
};
// ── End fetch wrapper ──

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </I18nextProvider>
    </BrowserRouter>
  </React.StrictMode>
);
