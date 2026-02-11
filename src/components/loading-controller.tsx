import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/* ═══════════ Types ═══════════ */
export type LoadingIntent = 'boot' | 'route' | 'task';

interface LoadingState {
    visible: boolean;
    intent: LoadingIntent;
    message?: string;
    blocking: boolean;
}

interface LoadingAPI {
    state: LoadingState | null;
    showLoading: (intent: LoadingIntent, message?: string) => void;
    hideLoading: (intent?: LoadingIntent) => void;
    runWithLoading: <T>(
        intent: LoadingIntent,
        fn: () => Promise<T>,
        options?: { message?: string; delayMs?: number; minVisibleMs?: number },
    ) => Promise<T>;
}

const DEFAULTS = {
    showDelay: 250,
    minVisible: 220,
} as const;

const LoadingContext = createContext<LoadingAPI | null>(null);

/* ═══════════ Provider ═══════════ */
export function LoadingProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<LoadingState | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const showLoading = useCallback(
        (intent: LoadingIntent, message?: string) => {
            clearTimer();
            setState({ visible: true, intent, message, blocking: intent === 'task' });
        },
        [clearTimer],
    );

    const hideLoading = useCallback(
        (intent?: LoadingIntent) => {
            clearTimer();
            setState((prev) => {
                if (!prev) return null;
                if (intent && prev.intent !== intent) return prev;
                return null;
            });
        },
        [clearTimer],
    );

    const runWithLoading = useCallback(
        async <T,>(
            intent: LoadingIntent,
            fn: () => Promise<T>,
            options?: { message?: string; delayMs?: number; minVisibleMs?: number },
        ): Promise<T> => {
            const delayMs = options?.delayMs ?? DEFAULTS.showDelay;
            const minVisibleMs = options?.minVisibleMs ?? DEFAULTS.minVisible;

            let shownAt: number | null = null;
            clearTimer();

            const delayTimer = setTimeout(() => {
                shownAt = Date.now();
                setState({ visible: true, intent, message: options?.message, blocking: true });
            }, delayMs);

            try {
                const result = await fn();
                clearTimeout(delayTimer);

                if (shownAt !== null) {
                    const elapsed = Date.now() - shownAt;
                    if (elapsed < minVisibleMs) {
                        await new Promise((r) => setTimeout(r, minVisibleMs - elapsed));
                    }
                }

                setState(null);
                return result;
            } catch (err) {
                clearTimeout(delayTimer);
                setState(null);
                throw err;
            }
        },
        [clearTimer],
    );

    const api = useMemo(
        () => ({ state, showLoading, hideLoading, runWithLoading }),
        [state, showLoading, hideLoading, runWithLoading],
    );

    return <LoadingContext.Provider value={api}>{children}</LoadingContext.Provider>;
}

/* ═══════════ Hook ═══════════ */
export function useLoading(): LoadingAPI {
    const ctx = useContext(LoadingContext);
    if (!ctx) throw new Error('useLoading must be inside LoadingProvider');
    return ctx;
}
