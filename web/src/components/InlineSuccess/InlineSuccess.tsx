import { CheckCircle } from 'lucide-react';

interface Props {
  message: string;
}

// Displays inline success messages for user actions
export function InlineSuccess({ message }: Props) {
  return (
    <div
      className="flex items-center gap-2 rounded-md bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400"
      role="status"
    >
      <CheckCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
