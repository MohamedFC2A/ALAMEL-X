import { useRegisterSW } from 'virtual:pwa-register/react';

export function usePWAUpdate() {
  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      void registration?.update();
    },
  });

  return {
    needRefresh: needRefresh[0],
    updateServiceWorker,
  };
}
