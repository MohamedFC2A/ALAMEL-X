import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { GlobalSettings } from '../../types';
import { GameButton } from '../../components/GameButton';
import { UiDebuggerPanel } from '../../components/UiDebuggerPanel';

type UpdateStatus = 'idle' | 'checking' | 'up-to-date';

interface SystemSettingsSectionProps {
  settings: GlobalSettings;
  needRefresh: boolean;
  updateStatus: UpdateStatus;
  onCheckForUpdates: () => void;
}

export function SystemSettingsSection({
  settings,
  needRefresh,
  updateStatus,
  onCheckForUpdates,
}: SystemSettingsSectionProps) {
  const { t } = useTranslation();

  return (
    <section className="stack-list settings-section">
      <div className="section-heading">
        <h2>{t('systemSettings')}</h2>
      </div>

      <div className="glass-card setting-card cinematic-panel section-card">
        <GameButton
          variant="primary"
          size="md"
          className={`update-check-btn ${needRefresh ? 'game-button--update-available' : ''}`}
          icon={<RefreshCw size={18} aria-hidden />}
          onClick={onCheckForUpdates}
          disabled={updateStatus === 'checking'}
        >
          {updateStatus === 'checking'
            ? t('checking')
            : needRefresh
              ? t('updateAvailable')
              : updateStatus === 'up-to-date'
                ? t('upToDate')
                : t('checkForUpdates')}
        </GameButton>
      </div>

      <div className="glass-card setting-card cinematic-panel section-card">
        <UiDebuggerPanel settings={settings} />
      </div>
    </section>
  );
}
