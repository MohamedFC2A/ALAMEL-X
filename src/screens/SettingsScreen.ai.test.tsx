import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { setupI18n } from '../lib/i18n';
import { db, defaultSettings } from '../lib/db';
import { SettingsScreen } from './SettingsScreen';
const speakWithElevenMock = vi.hoisted(() => vi.fn());

vi.mock('../lib/ai/eleven-client', () => {
  class ElevenError extends Error {
    kind: string;
    status?: number;

    constructor(message: string, options: { kind: string; status?: number }) {
      super(message);
      this.name = 'ElevenError';
      this.kind = options.kind;
      this.status = options.status;
    }
  }

  return {
    ElevenError,
    speakWithEleven: speakWithElevenMock,
  };
});

async function resetState() {
  await db.players.clear();
  await db.activeMatch.clear();
  await db.matches.clear();
  await db.settings.clear();
  await db.wordUsage.clear();
  await db.teaser.clear();
  await db.settings.put(defaultSettings);
}

afterEach(() => {
  cleanup();
});

describe('settings screen AI section', () => {
  beforeAll(async () => {
    await setupI18n('ar');
  });

  beforeEach(async () => {
    speakWithElevenMock.mockReset();
    vi.stubGlobal('fetch', vi.fn());
    await resetState();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('persists AI toggles without exposing key input', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SettingsScreen />
      </MemoryRouter>,
    );

    const aiEnabled = await screen.findByRole('checkbox', { name: /تفعيل لاعب ai/i });
    expect(aiEnabled).toBeChecked();
    await user.click(aiEnabled);

    await waitFor(async () => {
      const settings = await db.settings.get('global');
      expect(settings?.aiEnabled).toBe(false);
    });

    const voiceOut = await screen.findByRole('checkbox', { name: /نطق ردود ai/i });
    await user.click(voiceOut);

    await waitFor(async () => {
      const settings = await db.settings.get('global');
      expect(settings?.aiVoiceOutputEnabled).toBe(false);
    });

    const autoFacilitator = await screen.findByRole('checkbox', { name: /يدير النقاش تلقائيًا/i });
    expect(autoFacilitator).toBeChecked();
    await user.click(autoFacilitator);

    await waitFor(async () => {
      const settings = await db.settings.get('global');
      expect(settings?.aiAutoFacilitatorEnabled).toBe(false);
    });

    const humanSimulation = await screen.findByRole('checkbox', { name: /محاكاة البشر للـai/i });
    expect(humanSimulation).toBeDisabled();
    expect(screen.getByText(/يتطلب وضع "بشري جدًا/i)).toBeInTheDocument();

    const humanMode = await screen.findByRole('combobox', { name: /نمط الذكاء/i });
    await user.selectOptions(humanMode, 'ultra');

    await waitFor(async () => {
      const updated = await db.settings.get('global');
      expect(updated?.aiHumanMode).toBe('ultra');
    });

    const enabledHumanSimulation = await screen.findByRole('checkbox', { name: /محاكاة البشر للـai/i });
    expect(enabledHumanSimulation).not.toBeDisabled();
    await user.click(enabledHumanSimulation);

    await waitFor(async () => {
      const updated = await db.settings.get('global');
      expect(updated?.aiHumanSimulationEnabled).toBe(true);
    });

    await user.selectOptions(humanMode, 'natural');
    await waitFor(async () => {
      const updated = await db.settings.get('global');
      expect(updated?.aiHumanMode).toBe('natural');
      expect(updated?.aiHumanSimulationEnabled).toBe(false);
    });

    const provider = await screen.findByRole('combobox', { name: /مزود الصوت/i });
    expect(provider).toBeDisabled();
    expect(screen.getByRole('option', { name: /elevenlabs/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /المتصفح/i })).not.toBeInTheDocument();
    expect(screen.getByText(/تم قفل مزود الصوت على ElevenLabs/i)).toBeInTheDocument();

    expect(screen.queryByPlaceholderText(/ضع المفتاح هنا/i)).not.toBeInTheDocument();
    expect(screen.getByText(/مفتاح deepseek غير ظاهر للمستخدم/i)).toBeInTheDocument();
  });

  it('runs elevenlabs connection and voice tests with detailed status', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        modelId: 'eleven_multilingual_v2',
        voicesCount: 2,
        selectedVoice: { id: 'voice_1', name: 'Nour' },
        voicesPreview: [
          { id: 'voice_1', name: 'Nour' },
          { id: 'voice_2', name: 'Karim' },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    speakWithElevenMock.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <SettingsScreen />
      </MemoryRouter>,
    );

    const connectionBtn = await screen.findByRole('button', { name: /اختبار اتصال elevenlabs/i });
    await user.click(connectionBtn);

    await waitFor(() => {
      expect(screen.getByText(/اتصال ElevenLabs شغال/i)).toBeInTheDocument();
    });

    const voiceBtn = await screen.findByRole('button', { name: /اختبار نطق عشوائي/i });
    await user.click(voiceBtn);

    await waitFor(() => {
      expect(speakWithElevenMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/اختبار النطق نجح/i)).toBeInTheDocument();
    });
  });
});
