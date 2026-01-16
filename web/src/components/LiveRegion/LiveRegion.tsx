import { useEffect, useRef } from 'react';

interface Props {
  message: string;
  politeness?: 'polite' | 'assertive';
}

// Announces dynamic messages to screen readers via ARIA live region
export function LiveRegion({ message, politeness = 'polite' }: Props) {
  const previousMessage = useRef('');

  useEffect(() => {
    // Only update if message has changed to trigger announcement
    if (message && message !== previousMessage.current) {
      previousMessage.current = message;
    }
  }, [message]);

  // Don't render anything if there's no message
  if (!message) {
    return null;
  }

  return (
    <div role="status" aria-live={politeness} aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}
