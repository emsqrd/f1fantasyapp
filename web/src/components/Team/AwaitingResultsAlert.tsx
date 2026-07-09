import { Timer } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

interface AwaitingResultsAlertProps {
  nextRound: number | null;
}

export function AwaitingResultsAlert({ nextRound }: AwaitingResultsAlertProps) {
  return (
    <Alert className="mb-6">
      <Timer />
      <AlertTitle>Awaiting Results</AlertTitle>
      <AlertDescription>
        {nextRound != null
          ? `Your lineup reopens for Round ${nextRound} once results are in.`
          : 'Results are being scored.'}
      </AlertDescription>
    </Alert>
  );
}
