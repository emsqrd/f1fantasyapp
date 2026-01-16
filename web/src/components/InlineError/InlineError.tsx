import { AlertCircle } from 'lucide-react';

interface Props {
  message: string;
}

// Displays inline error messages for form validation
export function InlineError({ message }: Props) {
  return (
    <div
      className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-md p-3 text-sm"
      role="alert"
    >
      <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
