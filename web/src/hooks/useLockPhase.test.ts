import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { computeLockPhase, useLockPhase } from './useLockPhase';

const DEADLINE = '2026-05-30T12:00:00Z';
const RACE_DATE = '2026-05-31T13:00:00Z';

const at = (iso: string) => Date.parse(iso);

describe('computeLockPhase', () => {
  it('is open before the lock deadline', () => {
    expect(computeLockPhase(DEADLINE, RACE_DATE, at('2026-05-30T11:59:59Z'))).toBe('open');
  });

  it('is locked at the lock deadline', () => {
    expect(computeLockPhase(DEADLINE, RACE_DATE, at(DEADLINE))).toBe('locked');
  });

  it('is locked between the lock deadline and the race date', () => {
    expect(computeLockPhase(DEADLINE, RACE_DATE, at('2026-05-31T12:00:00Z'))).toBe('locked');
  });

  it('is awaitingResults at the race date', () => {
    expect(computeLockPhase(DEADLINE, RACE_DATE, at(RACE_DATE))).toBe('awaitingResults');
  });

  it('is awaitingResults after the race date', () => {
    expect(computeLockPhase(DEADLINE, RACE_DATE, at('2026-06-01T00:00:00Z'))).toBe(
      'awaitingResults',
    );
  });

  it('is locked past the deadline when there is no race date', () => {
    expect(computeLockPhase(DEADLINE, null, at('2026-06-01T00:00:00Z'))).toBe('locked');
  });

  it('is awaitingResults past the race date when there is no deadline', () => {
    expect(computeLockPhase(null, RACE_DATE, at('2026-06-01T00:00:00Z'))).toBe('awaitingResults');
  });

  it('is open when there is no deadline and no race date', () => {
    expect(computeLockPhase(null, null, at('2026-06-01T00:00:00Z'))).toBe('open');
  });
});

describe('useLockPhase', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-30T11:59:30Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('flips open → locked → awaitingResults as the clock passes each boundary', () => {
    const { result } = renderHook(() => useLockPhase(DEADLINE, RACE_DATE));

    expect(result.current).toBe('open');

    act(() => {
      vi.setSystemTime(new Date('2026-05-30T12:00:01Z'));
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe('locked');

    act(() => {
      vi.setSystemTime(new Date('2026-05-31T13:00:01Z'));
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe('awaitingResults');
  });
});
