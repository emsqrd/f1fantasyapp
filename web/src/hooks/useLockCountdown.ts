import { useEffect, useState } from 'react';

export interface LockCountdown {
  isLocked: boolean;
  lockingImminently: boolean;
  lockDeadline: Date | null;
  remaining: { days: number; hours: number; minutes: number } | null;
}

export function useLockCountdown(lockDeadlineStr: string | null): LockCountdown {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (!lockDeadlineStr) return;
    const deadline = new Date(lockDeadlineStr);

    const tick = () => {
      const n = new Date();
      setNow(n);
      if (n >= deadline) clearInterval(intervalId);
    };

    const intervalId = setInterval(tick, 1000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [lockDeadlineStr]);

  const lockDeadline = lockDeadlineStr ? new Date(lockDeadlineStr) : null;
  const isLocked = lockDeadline != null && now >= lockDeadline;
  const msRemaining = lockDeadline && !isLocked ? lockDeadline.getTime() - now.getTime() : 0;
  const lockingImminently = msRemaining > 0 && msRemaining < 60_000;

  const totalMins = Math.floor(msRemaining / 60_000);
  const remaining =
    lockDeadline && !isLocked
      ? {
          days: Math.floor(totalMins / 1440),
          hours: Math.floor((totalMins % 1440) / 60),
          minutes: totalMins % 60,
        }
      : null;

  return { isLocked, lockingImminently, lockDeadline, remaining };
}
