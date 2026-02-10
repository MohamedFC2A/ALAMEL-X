import { Bot, Pause, Play, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AiOrchestratorState, Player } from '../types';
import { GameButton } from './GameButton';
import { StatusBanner } from './StatusBanner';

interface AiDeskModalProps {
  open: boolean;
  onClose: () => void;
  aiPlayers: Player[];
  orchestratorState: AiOrchestratorState;
  runtimeEnabled: boolean;
  onToggleRuntime: () => void;
  error: string;
  onClearError: () => void;
}

function statusLabel(status: AiOrchestratorState['status'], t: (key: string) => string): string {
  if (status === 'listening') return t('aiOrchestratorListening');
  if (status === 'processing') return t('aiOrchestratorProcessing');
  if (status === 'speaking') return t('aiOrchestratorSpeaking');
  if (status === 'waiting_answer') return t('aiOrchestratorWaitingAnswer');
  return t('aiOrchestratorIdle');
}

export function AiDeskModal({
  open,
  onClose,
  aiPlayers,
  orchestratorState,
  runtimeEnabled,
  onToggleRuntime,
  error,
  onClearError,
}: AiDeskModalProps) {
  const { t } = useTranslation();

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal glass-card section-card cinematic-panel ai-desk-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="ai-desk-header">
          <div className="ai-desk-title">
            <Bot size={18} aria-hidden />
            <h2>{t('aiMonitorTitle')}</h2>
          </div>
          <button type="button" className="ai-desk-close" onClick={onClose} aria-label={t('close')}>
            <X size={18} aria-hidden />
          </button>
        </div>

        <p className="subtle">{t('aiMonitorHint')}</p>
        <StatusBanner tone={runtimeEnabled ? 'success' : 'warning'}>
          {runtimeEnabled ? t('aiOrchestratorRuntimeOn') : t('aiOrchestratorRuntimeOff')}
        </StatusBanner>

        <section className="ai-monitor-grid">
          <div className="ai-monitor-row">
            <span>{t('aiOrchestratorStatus')}</span>
            <strong>{statusLabel(orchestratorState.status, t)}</strong>
          </div>
          <div className="ai-monitor-row">
            <span>{t('aiMonitorActiveAgent')}</span>
            <strong>{orchestratorState.activeAiName || aiPlayers[0]?.name || '-'}</strong>
          </div>
          <div className="ai-monitor-row">
            <span>{t('aiOrchestratorPendingTarget', { name: orchestratorState.pendingTargetName || '---' })}</span>
            <strong>{orchestratorState.pendingTargetName || t('aiOrchestratorNoPending')}</strong>
          </div>
          <div className="ai-monitor-row">
            <span>{t('aiMonitorLastSpeaker')}</span>
            <strong>{orchestratorState.lastSpeakerName || '-'}</strong>
          </div>
          <div className="ai-monitor-row">
            <span>{t('aiMonitorSilence')}</span>
            <strong>
              {Math.round(orchestratorState.silenceMs / 1000)} {t('seconds')}
            </strong>
          </div>
        </section>

        {orchestratorState.lastTranscript ? (
          <section className="glass-card section-card ai-monitor-text">
            <span className="subtle">{t('aiMonitorLastTranscript')}</span>
            <p>{orchestratorState.lastTranscript}</p>
          </section>
        ) : null}

        {orchestratorState.lastIntervention ? (
          <section className="glass-card section-card ai-monitor-text">
            <span className="subtle">{t('aiMonitorLastIntervention')}</span>
            <p>{orchestratorState.lastIntervention}</p>
          </section>
        ) : null}

        {error ? (
          <StatusBanner tone="danger">
            {error}{' '}
            <button type="button" className="link-like-btn" onClick={onClearError}>
              {t('close')}
            </button>
          </StatusBanner>
        ) : null}

        <div className="ai-voice-cta">
          <GameButton
            variant={runtimeEnabled ? 'danger' : 'cta'}
            size="md"
            icon={runtimeEnabled ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}
            onClick={onToggleRuntime}
          >
            {runtimeEnabled ? t('aiOrchestratorPause') : t('aiOrchestratorResume')}
          </GameButton>
        </div>
      </div>
    </div>
  );
}
