import type { LoadingIntent } from './loading-controller';

interface LoadingOverlayProps {
    intent: LoadingIntent;
    message?: string;
    blocking?: boolean;
    visible: boolean;
}

const INTENT_CLASSES: Record<LoadingIntent, string> = {
    boot: 'loading-overlay--boot',
    route: 'loading-overlay--route',
    task: 'loading-overlay--task',
    update: 'loading-overlay--update',
};

export function LoadingOverlay({ intent, message, blocking = true, visible }: LoadingOverlayProps) {
    if (!visible) return null;

    return (
        <div
            className={`loading-overlay ${INTENT_CLASSES[intent]} ${blocking ? 'loading-overlay--blocking' : ''}`}
            role="status"
            aria-live="polite"
            aria-label={message || 'جارٍ التحميل...'}
        >
            <div className="loading-overlay__grid" aria-hidden="true" />
            <div className="loading-overlay__sweep" aria-hidden="true" />
            <div className="loading-overlay__content">
                <div className="loading-overlay__insignia" aria-hidden="true">
                    <span className="loading-overlay__x">X</span>
                </div>
                {message ? (
                    <p className="loading-overlay__message">{message}</p>
                ) : (
                    <p className="loading-overlay__message">جارٍ التحميل...</p>
                )}
                <div className="loading-overlay__pulse" aria-hidden="true" />
            </div>
        </div>
    );
}
