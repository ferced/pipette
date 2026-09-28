/** Pipette mark: a Pasteur pipette releasing one drop. The drop is the brand accent. */
export function Mark({ size = 26, title }: { size?: number; title?: string }) {
  return (
    <svg width={(size * 30) / 32} height={size} viewBox="0 0 30 32" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <g transform="translate(1 -2) rotate(28 12 24)">
        <rect x="7.5" y="0.8" width="9" height="9.6" rx="4.5" fill="currentColor" />
        <rect x="9.6" y="9.2" width="4.8" height="1.8" rx="0.6" fill="currentColor" opacity="0.55" />
        <path d="M10 11.4h4v8.2l-1.35 4.4h-1.3L10 19.6z" fill="currentColor" />
      </g>
      <path d="M13 24.6c0 0-2.55 2.75-2.55 4.35a2.55 2.55 0 0 0 5.1 0c0-1.6-2.55-4.35-2.55-4.35z" fill="var(--indicator)" />
    </svg>
  );
}

export function Drop({ size = 14 }: { size?: number }) {
  return (
    <svg width={size * 0.72} height={size} viewBox="0 0 10 14" aria-hidden="true">
      <path d="M5 0.6C5 0.6 0.9 5.2 0.9 8.7a4.1 4.1 0 0 0 8.2 0C9.1 5.2 5 0.6 5 0.6z" fill="currentColor" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <>
      <Mark />
      <span className="brand-word">pipette</span>
    </>
  );
}
