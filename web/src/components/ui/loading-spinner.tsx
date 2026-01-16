import { Trophy } from 'lucide-react';

export function LoadingSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="relative">
          <Trophy className="text-primary mx-auto h-16 w-16 animate-pulse" />
          <div className="mt-4">
            <div className="bg-primary/20 mx-auto h-2 w-24 overflow-hidden rounded-full">
              <div className="bg-primary h-full animate-[loading_1.5s_ease-in-out_infinite] rounded-full"></div>
            </div>
          </div>
        </div>
        <p className="text-muted-foreground mt-4 text-sm">Loading F1 Fantasy Sports...</p>
      </div>
    </div>
  );
}
