import { useCallback, useState } from 'react';

// Hook for managing screen reader announcements via LiveRegion
export function useLiveRegion() {
  const [message, setMessage] = useState('');

  const announce = useCallback((newMessage: string) => {
    setMessage(newMessage);
  }, []);

  const clear = useCallback(() => {
    setMessage('');
  }, []);

  return { message, announce, clear };
}
