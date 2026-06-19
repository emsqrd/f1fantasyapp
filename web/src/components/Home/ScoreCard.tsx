interface ScoreCardProps {
  eyebrow: string;
  title: string;
  score: number | null;
}

const EM_DASH = '—';

export function ScoreCard({ eyebrow, title, score }: ScoreCardProps) {
  return (
    <div className="bg-card rounded-[0.65rem] border p-4">
      <p className="text-muted-foreground text-xs font-semibold tracking-[0.12em] uppercase">
        {eyebrow}
      </p>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <p className="text-foreground min-w-0 truncate text-base font-bold tracking-tight md:text-lg">
          {title}
        </p>
        <div className="text-foreground shrink-0 font-mono text-2xl font-bold tabular-nums md:text-2xl">
          {score != null ? score.toLocaleString() : EM_DASH}
          {score != null && (
            <span className="text-muted-foreground ml-1 text-xs font-semibold md:text-sm">pts</span>
          )}
        </div>
      </div>
    </div>
  );
}
