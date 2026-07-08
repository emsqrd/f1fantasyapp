type Listener = () => void;

const listeners = new Set<Listener>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function notifyAll(): void {
  for (const listener of listeners) {
    listener();
  }
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'visible') notifyAll();
}

/**
 * Read mechanism for render state only — side effects must not hang off ticks.
 * Background tabs throttle timers and burst on refocus; polling belongs to
 * TanStack Query's `refetchInterval`.
 */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    intervalId = setInterval(notifyAll, 1000);
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalId != null) {
      clearInterval(intervalId);
      intervalId = null;
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
  };
}
