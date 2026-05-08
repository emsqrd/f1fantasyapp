import { cn } from '@/lib/utils';

interface PositionDeltaProps {
  value: number | null;
  variant?: 'block' | 'inline';
  className?: string;
}

export function PositionDelta({ value, variant = 'block', className }: PositionDeltaProps) {
  const isFlat = value === 0 || value === null;
  const isUp = value !== null && value > 0;

  const ariaLabel = isFlat
    ? 'No position change'
    : isUp
      ? `Up ${Math.abs(value)} positions`
      : `Down ${Math.abs(value)} positions`;

  if (isFlat) {
    return (
      <span
        className={cn(
          'text-muted-foreground inline-flex items-center justify-center text-[14px] font-medium tabular-nums',
          className,
        )}
        aria-label={ariaLabel}
      >
        –
      </span>
    );
  }

  const glyph = isUp ? '↑' : '↓';
  const color = isUp ? 'text-[var(--delta-up-fg)]' : 'text-[var(--delta-down-fg)]';

  const baseClasses =
    variant === 'inline'
      ? 'inline-flex items-center gap-1 text-[12px] font-medium tabular-nums'
      : 'inline-flex items-center gap-1 text-[12px] font-semibold tabular-nums';

  return (
    <span className={cn(baseClasses, color, className)} aria-label={ariaLabel}>
      <span aria-hidden="true" className="text-[12px] leading-none">
        {glyph}
      </span>
      {Math.abs(value as number)}
    </span>
  );
}
