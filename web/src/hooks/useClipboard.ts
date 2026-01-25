import * as Sentry from '@sentry/react';
import { useCallback, useState } from 'react';

interface UseClipboardReturn {
  copy: (text: string) => Promise<boolean>;
  reset: () => void;
  copiedValue: string | null;
  hasCopied: boolean;
}

/**
 * Custom hook for copying text to clipboard
 *
 * @returns Object with copy function, reset function, copiedValue, and hasCopied state
 *
 * @example
 * const { copy, reset, hasCopied } = useClipboard();
 *
 * // In dialog close handler
 * const handleDialogOpen = (open: boolean) => {
 *   setIsDialogOpen(open);
 *   if (!open) reset(); // Clear state when dialog closes
 * };
 *
 * return (
 *   <Button onClick={() => copy(inviteUrl)}>
 *     {hasCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
 *   </Button>
 * );
 */

export function useClipboard(): UseClipboardReturn {
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  const copy = useCallback(async (text: string): Promise<boolean> => {
    if (!navigator.clipboard) {
      Sentry.captureMessage('Clipboard API not supported', 'warning');
      return false;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopiedValue(text);
      setHasCopied(true);

      return true;
    } catch (error) {
      setHasCopied(false);
      setCopiedValue(null);

      Sentry.captureException(error, {
        tags: { feature: 'clipboard' },
        extra: { textLength: text.length },
      });

      return false;
    }
  }, []);

  const reset = useCallback(() => {
    setHasCopied(false);
    setCopiedValue(null);
  }, []);

  return { copy, reset, copiedValue, hasCopied };
}
