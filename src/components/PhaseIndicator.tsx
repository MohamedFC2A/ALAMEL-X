interface PhaseIndicatorProps {
  current: number;
  labels: string[];
}

export function PhaseIndicator({ current, labels }: PhaseIndicatorProps) {
  const progress = ((current - 1) / (labels.length - 1)) * 100;

  return (
    <nav className="phase-bar" aria-label="phase progress">
      <div className="phase-bar__track">
        <div
          className="phase-bar__fill"
          style={{ width: `${progress}%` }}
        />
        {labels.map((label, idx) => {
          const step = idx + 1;
          const state = step === current ? 'current' : step < current ? 'done' : 'next';
          const position = labels.length > 1 ? (idx / (labels.length - 1)) * 100 : 50;
          return (
            <div
              key={label}
              className={`phase-bar__node ${state}`}
              style={{ insetInlineStart: `${position}%` }}
            >
              <span className="phase-bar__dot" aria-hidden="true">
                {step < current ? '✓' : step}
              </span>
              <span className="phase-bar__label">{label}</span>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
