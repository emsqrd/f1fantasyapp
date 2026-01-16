import { describe, expect, it, vi } from 'vitest';

import { avatarEvents } from './avatarEvents';

describe('AvatarEventEmitter', () => {
  it('should call subscribed listeners when avatar URL is emitted', () => {
    const mockListener = vi.fn();
    const avatarUrl = 'https://example.com/avatar.jpg';

    avatarEvents.subscribe(mockListener);
    avatarEvents.emit(avatarUrl);

    expect(mockListener).toHaveBeenCalledTimes(1);
    expect(mockListener).toHaveBeenCalledWith(avatarUrl);
  });

  it('should call multiple subscribed listeners when avatar URL is emitted', () => {
    const mockListener1 = vi.fn();
    const mockListener2 = vi.fn();
    const mockListener3 = vi.fn();
    const avatarUrl = 'https://example.com/new-avatar.png';

    avatarEvents.subscribe(mockListener1);
    avatarEvents.subscribe(mockListener2);
    avatarEvents.subscribe(mockListener3);

    avatarEvents.emit(avatarUrl);

    expect(mockListener1).toHaveBeenCalledTimes(1);
    expect(mockListener1).toHaveBeenCalledWith(avatarUrl);
    expect(mockListener2).toHaveBeenCalledTimes(1);
    expect(mockListener2).toHaveBeenCalledWith(avatarUrl);
    expect(mockListener3).toHaveBeenCalledTimes(1);
    expect(mockListener3).toHaveBeenCalledWith(avatarUrl);
  });

  it('should not call unsubscribed listeners when avatar URL is emitted', () => {
    const mockListener = vi.fn();
    const avatarUrl = 'https://example.com/avatar.jpg';

    const unsubscribe = avatarEvents.subscribe(mockListener);
    unsubscribe();
    avatarEvents.emit(avatarUrl);

    expect(mockListener).not.toHaveBeenCalled();
  });

  it('should only call remaining listeners after one is unsubscribed', () => {
    const mockListener1 = vi.fn();
    const mockListener2 = vi.fn();
    const mockListener3 = vi.fn();
    const avatarUrl = 'https://example.com/avatar.jpg';

    avatarEvents.subscribe(mockListener1);
    const unsubscribe2 = avatarEvents.subscribe(mockListener2);
    avatarEvents.subscribe(mockListener3);

    unsubscribe2();
    avatarEvents.emit(avatarUrl);

    expect(mockListener1).toHaveBeenCalledTimes(1);
    expect(mockListener1).toHaveBeenCalledWith(avatarUrl);
    expect(mockListener2).not.toHaveBeenCalled();
    expect(mockListener3).toHaveBeenCalledTimes(1);
    expect(mockListener3).toHaveBeenCalledWith(avatarUrl);
  });

  it('should handle multiple emissions to the same listeners', () => {
    const mockListener = vi.fn();
    const avatarUrl1 = 'https://example.com/avatar1.jpg';
    const avatarUrl2 = 'https://example.com/avatar2.png';

    avatarEvents.subscribe(mockListener);

    avatarEvents.emit(avatarUrl1);
    avatarEvents.emit(avatarUrl2);

    expect(mockListener).toHaveBeenCalledTimes(2);
    expect(mockListener).toHaveBeenNthCalledWith(1, avatarUrl1);
    expect(mockListener).toHaveBeenNthCalledWith(2, avatarUrl2);
  });

  it('should handle unsubscribing the same listener multiple times safely', () => {
    const mockListener = vi.fn();
    const avatarUrl = 'https://example.com/avatar.jpg';

    const unsubscribe = avatarEvents.subscribe(mockListener);

    unsubscribe();
    unsubscribe(); // Second call should not throw error

    avatarEvents.emit(avatarUrl);

    expect(mockListener).not.toHaveBeenCalled();
  });

  it('should handle emitting with no subscribed listeners', () => {
    const avatarUrl = 'https://example.com/avatar.jpg';

    // Should not throw an error
    expect(() => {
      avatarEvents.emit(avatarUrl);
    }).not.toThrow();
  });

  it('should handle empty string avatar URLs', () => {
    const mockListener = vi.fn();
    const emptyUrl = '';

    avatarEvents.subscribe(mockListener);
    avatarEvents.emit(emptyUrl);

    expect(mockListener).toHaveBeenCalledTimes(1);
    expect(mockListener).toHaveBeenCalledWith(emptyUrl);
  });

  it('should maintain correct listener order when unsubscribing middle listener', () => {
    const callOrder: number[] = [];
    const listener1 = vi.fn(() => callOrder.push(1));
    const listener2 = vi.fn(() => callOrder.push(2));
    const listener3 = vi.fn(() => callOrder.push(3));
    const avatarUrl = 'https://example.com/avatar.jpg';

    avatarEvents.subscribe(listener1);
    const unsubscribe2 = avatarEvents.subscribe(listener2);
    avatarEvents.subscribe(listener3);

    unsubscribe2();
    avatarEvents.emit(avatarUrl);

    expect(callOrder).toEqual([1, 3]);
    expect(listener1).toHaveBeenCalledWith(avatarUrl);
    expect(listener2).not.toHaveBeenCalled();
    expect(listener3).toHaveBeenCalledWith(avatarUrl);
  });

  it('should handle subscribing and immediately unsubscribing', () => {
    const mockListener = vi.fn();
    const avatarUrl = 'https://example.com/avatar.jpg';

    const unsubscribe = avatarEvents.subscribe(mockListener);
    unsubscribe();

    avatarEvents.emit(avatarUrl);

    expect(mockListener).not.toHaveBeenCalled();
  });

  it('should handle subscribing the same function multiple times', () => {
    const mockListener = vi.fn();
    const avatarUrl = 'https://example.com/avatar.jpg';

    // Subscribe the same function twice
    avatarEvents.subscribe(mockListener);
    avatarEvents.subscribe(mockListener);

    avatarEvents.emit(avatarUrl);

    // Should be called twice since it was subscribed twice
    expect(mockListener).toHaveBeenCalledTimes(2);
    expect(mockListener).toHaveBeenCalledWith(avatarUrl);
  });

  it('should return working unsubscribe function for each subscription', () => {
    const mockListener = vi.fn();
    const avatarUrl = 'https://example.com/avatar.jpg';

    const unsubscribe1 = avatarEvents.subscribe(mockListener);
    const unsubscribe2 = avatarEvents.subscribe(mockListener);

    // Unsubscribe first instance
    unsubscribe1();
    avatarEvents.emit(avatarUrl);

    // Should still be called once (second subscription still active)
    expect(mockListener).toHaveBeenCalledTimes(1);

    mockListener.mockClear();

    // Unsubscribe second instance
    unsubscribe2();
    avatarEvents.emit(avatarUrl);

    // Should not be called anymore
    expect(mockListener).not.toHaveBeenCalled();
  });
});
