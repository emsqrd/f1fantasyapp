type Listener = () => void;

const listeners = new Set<Listener>();
let timeoutId: ReturnType<typeof setTimeout> | null = null;

function notifyAll(): void {
  for (const listener of listeners) {
    listener();
  }
}

function scheduleTickAtNextSecond(): void {
  timeoutId = setTimeout(tick, 1000 - (Date.now() % 1000));
}

function tick(): void {
  // Schedule before notifying so a throwing listener can't kill the chain.
  scheduleTickAtNextSecond();
  notifyAll();
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'visible') notifyAll();
}

/**
 * Read mechanism for render state only — side effects must not hang off ticks.
 * Background tabs throttle timers and burst on refocus; polling belongs to
 * TanStack Query's `refetchInterval`.
 */
export function subscribeClock(listener: Listener): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    scheduleTickAtNextSecond();
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timeoutId != null) {
      clearTimeout(timeoutId);
      timeoutId = null;
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
  };
}
