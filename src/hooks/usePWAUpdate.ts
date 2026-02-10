import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const CHECK_INTERVAL_MS = 30_000; // 30 seconds

export function usePWAUpdate() {
  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      void registration?.update();
    },
  });

  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(undefined);

  // Periodically check for new service worker updates
  useEffect(() => {
    if (needRefresh[0]) {
      return; // Already found an update, no need to keep polling
    }

    const poll = async () => {
      try {
        if (!registrationRef.current && 'serviceWorker' in navigator) {
          registrationRef.current = await navigator.serviceWorker.getRegistration();
        }
        await registrationRef.current?.update();
      } catch {
        // Silently ignore network errors during polling
      }
    };

    const id = setInterval(() => void poll(), CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [needRefresh]);

  return {
    needRefresh: needRefresh[0],
    updateServiceWorker,
  };
}
