import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

interface RaceCompleteBannerProps {
  raceName: string;
  nextRound: number | null;
}

export function RaceCompleteBanner({ raceName, nextRound }: RaceCompleteBannerProps) {
  return (
    <Alert className="mb-6">
      <svg viewBox="0 0 20 15" aria-hidden="true">
        <rect x="0" y="0" width="5" height="5" fill="currentColor" />
        <rect x="10" y="0" width="5" height="5" fill="currentColor" />
        <rect x="5" y="5" width="5" height="5" fill="currentColor" />
        <rect x="15" y="5" width="5" height="5" fill="currentColor" />
        <rect x="0" y="10" width="5" height="5" fill="currentColor" />
        <rect x="10" y="10" width="5" height="5" fill="currentColor" />
      </svg>
      <AlertTitle>{raceName} complete</AlertTitle>
      <AlertDescription>
        {nextRound != null
          ? `Your lineup reopens for Round ${nextRound} once results are in.`
          : 'Results are being scored.'}
      </AlertDescription>
    </Alert>
  );
}
