import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useLiveRegion } from './useLiveRegion';

describe('useLiveRegion', () => {
  it('initializes with empty message', () => {
    const { result } = renderHook(() => useLiveRegion());

    expect(result.current.message).toBe('');
  });

  it('announces messages correctly', () => {
    const { result } = renderHook(() => useLiveRegion());

    act(() => {
      result.current.announce('Form submitted successfully');
    });

    expect(result.current.message).toBe('Form submitted successfully');
  });

  it('updates message when announce is called multiple times', () => {
    const { result } = renderHook(() => useLiveRegion());

    act(() => {
      result.current.announce('First message');
    });

    expect(result.current.message).toBe('First message');

    act(() => {
      result.current.announce('Second message');
    });

    expect(result.current.message).toBe('Second message');
  });

  it('clears message when clear is called', () => {
    const { result } = renderHook(() => useLiveRegion());

    act(() => {
      result.current.announce('Test message');
    });

    expect(result.current.message).toBe('Test message');

    act(() => {
      result.current.clear();
    });

    expect(result.current.message).toBe('');
  });

  it('allows manual clearing after announcement', () => {
    const { result } = renderHook(() => useLiveRegion());

    act(() => {
      result.current.announce('Error occurred');
      result.current.clear();
    });

    expect(result.current.message).toBe('');
  });

  it('maintains stable function references', () => {
    const { result, rerender } = renderHook(() => useLiveRegion());

    const initialAnnounce = result.current.announce;
    const initialClear = result.current.clear;

    rerender();

    expect(result.current.announce).toBe(initialAnnounce);
    expect(result.current.clear).toBe(initialClear);
  });
});
