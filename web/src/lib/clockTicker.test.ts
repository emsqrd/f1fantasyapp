import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { subscribe } from './clockTicker';

// jsdom never changes visibility on its own; shadow the prototype getter per
// test and remove the override in afterEach.
function setVisibilityState(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
}

describe('clockTicker', () => {
  beforeEach(() => {
    // Tick scheduling depends on time-of-day; unpinned fake timers start at
    // the real clock, making tick timing nondeterministic.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-07T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(document, 'visibilityState');
  });

  it('fans each tick out to every subscriber', () => {
    const a = vi.fn();
    const b = vi.fn();
    const unsubscribeA = subscribe(a);
    const unsubscribeB = subscribe(b);

    vi.advanceTimersByTime(1000);

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    unsubscribeA();
    unsubscribeB();
  });

  it('aligns ticks to wall-clock second boundaries', () => {
    vi.setSystemTime(new Date('2026-03-07T12:00:00.400Z'));
    const a = vi.fn();
    const unsubscribeA = subscribe(a);

    vi.advanceTimersByTime(599);
    expect(a).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(a).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(a).toHaveBeenCalledTimes(2);

    unsubscribeA();
  });

  it('keeps ticking for remaining subscribers when one unsubscribes', () => {
    const a = vi.fn();
    const b = vi.fn();
    const unsubscribeA = subscribe(a);
    const unsubscribeB = subscribe(b);

    unsubscribeA();
    vi.advanceTimersByTime(1000);

    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);

    unsubscribeB();
  });

  it('stops ticking when the last subscriber unsubscribes', () => {
    const a = vi.fn();
    const unsubscribeA = subscribe(a);

    unsubscribeA();
    vi.advanceTimersByTime(3000);

    expect(a).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('restarts after teardown when a new subscriber arrives', () => {
    const a = vi.fn();
    subscribe(a)();

    const b = vi.fn();
    const unsubscribeB = subscribe(b);
    vi.advanceTimersByTime(1000);

    expect(b).toHaveBeenCalledTimes(1);

    unsubscribeB();
  });

  it('notifies subscribers when the tab becomes visible', () => {
    const a = vi.fn();
    const unsubscribeA = subscribe(a);

    setVisibilityState('visible');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(a).toHaveBeenCalledTimes(1);

    unsubscribeA();
  });

  it('does not notify on visibility changes while the tab stays hidden', () => {
    const a = vi.fn();
    const unsubscribeA = subscribe(a);

    setVisibilityState('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(a).not.toHaveBeenCalled();

    unsubscribeA();
  });

  it('still notifies on refocus after a teardown and resubscribe cycle', () => {
    subscribe(vi.fn())();

    const b = vi.fn();
    const unsubscribeB = subscribe(b);
    setVisibilityState('visible');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(b).toHaveBeenCalledTimes(1);

    unsubscribeB();
  });
});
