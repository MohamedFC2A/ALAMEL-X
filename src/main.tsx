import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { setupI18n } from './lib/i18n';

function stringifyReason(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Error) {
    return `${value.message}\n${value.stack ?? ''}`.trim();
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isExternalExtensionNoise(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('chrome-extension://');
}

function installRuntimeErrorNoiseFilter() {
  if (typeof window === 'undefined') {
    return;
  }

  window.addEventListener(
    'error',
    (event) => {
      const filename = event.filename || '';
      const message = event.message || '';
      const stack = stringifyReason(event.error);
      if (isExternalExtensionNoise(`${filename}\n${message}\n${stack}`)) {
        event.preventDefault();
      }
    },
    true,
  );

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      const reason = stringifyReason(event.reason);
      if (isExternalExtensionNoise(reason)) {
        event.preventDefault();
      }
    },
    true,
  );
}

async function bootstrap() {
  await setupI18n('ar');
  installRuntimeErrorNoiseFilter();

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
