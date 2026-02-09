interface PhaseIndicatorProps {
  current: number;
  labels: string[];
}

export function PhaseIndicator({ current, labels }: PhaseIndicatorProps) {
  return (
    <ol className="phase-indicator glass-card" aria-label="phase progress">
      {labels.map((label, idx) => {
        const step = idx + 1;
        const state = step === current ? 'current' : step < current ? 'done' : 'next';
        return (
          <li key={label} className={`phase-item ${state}`}>
            <span className="phase-dot" aria-hidden="true" />
            <span className="phase-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
