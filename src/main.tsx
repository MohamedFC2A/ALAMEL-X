import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { setupI18n } from './lib/i18n';

async function bootstrap() {
  await setupI18n('ar');

  if (import.meta.env.DEV && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister());
    });
  } else {
    registerSW({ immediate: true });
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
