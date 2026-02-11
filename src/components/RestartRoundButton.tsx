import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { abandonActiveMatch } from '../lib/game-repository';
import { GameButton } from './GameButton';

interface RestartRoundButtonProps {
  className?: string;
}

export function RestartRoundButton({ className = '' }: RestartRoundButtonProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  async function handleRestart() {
    const confirmed = window.confirm(t('confirmRestartRound'));
    if (!confirmed) {
      return;
    }

    navigate('/play/setup', { replace: true });
    await abandonActiveMatch();
  }

  return (
    <GameButton variant="danger" size="md" className={className} onClick={() => void handleRestart()}>
      {t('restartRound')}
    </GameButton>
  );
}
