import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useLockCountdown } from './useLockCountdown';

const START = new Date('2026-05-24T12:00:00Z');

describe('useLockCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns sane defaults when no deadline is provided', () => {
    const { result } = renderHook(() => useLockCountdown(null));

    expect(result.current.lockingImminently).toBe(false);
    expect(result.current.remaining).toBeNull();
  });

  it('transitions from countdown to imminent as the deadline approaches', () => {
    const deadline = new Date(START.getTime() + 2 * 60 * 1000);

    const { result } = renderHook(() => useLockCountdown(deadline.toISOString()));

    expect(result.current.lockingImminently).toBe(false);
    expect(result.current.remaining).toEqual({ days: 0, hours: 0, minutes: 2 });

    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(result.current.lockingImminently).toBe(true);
    expect(result.current.remaining).toEqual({ days: 0, hours: 0, minutes: 0 });
  });

  it('breaks remaining time into days, hours, and minutes for a multi-day deadline', () => {
    const deadlineMs = START.getTime() + (3 * 24 * 60 + 5 * 60 + 12) * 60 * 1000;

    const { result } = renderHook(() => useLockCountdown(new Date(deadlineMs).toISOString()));

    expect(result.current.remaining).toEqual({ days: 3, hours: 5, minutes: 12 });
  });

  it('reports zero days when the deadline is under 24 hours away', () => {
    const deadlineMs = START.getTime() + (5 * 60 + 12) * 60 * 1000;

    const { result } = renderHook(() => useLockCountdown(new Date(deadlineMs).toISOString()));

    expect(result.current.remaining).toEqual({ days: 0, hours: 5, minutes: 12 });
  });

  it('reports zero days and hours when the deadline is under an hour away', () => {
    const deadlineMs = START.getTime() + 12 * 60 * 1000;

    const { result } = renderHook(() => useLockCountdown(new Date(deadlineMs).toISOString()));

    expect(result.current.remaining).toEqual({ days: 0, hours: 0, minutes: 12 });
  });
});
