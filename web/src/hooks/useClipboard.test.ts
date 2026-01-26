import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useClipboard } from './useClipboard';

describe('useClipboard', () => {
  const mockWriteText = vi.fn();
  let originalClipboard: Clipboard | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteText.mockResolvedValue(undefined);
    originalClipboard = navigator.clipboard;

    // Mock clipboard API
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
  });

  describe('successful copy operation', () => {
    it('copies text to clipboard and returns true', async () => {
      const { result } = renderHook(() => useClipboard());
      const textToCopy = 'https://example.com/invite/abc123';

      let success: boolean = false;
      await act(async () => {
        success = await result.current.copy(textToCopy);
      });

      expect(success).toBe(true);
      expect(mockWriteText).toHaveBeenCalledWith(textToCopy);
    });

    it('updates hasCopied to true after successful copy', async () => {
      const { result } = renderHook(() => useClipboard());

      expect(result.current.hasCopied).toBe(false);

      await act(async () => {
        await result.current.copy('test text');
      });

      expect(result.current.hasCopied).toBe(true);
    });

    it('allows copying different text multiple times', async () => {
      const { result } = renderHook(() => useClipboard());

      await act(async () => {
        await result.current.copy('first text');
      });
      expect(result.current.hasCopied).toBe(true);

      await act(async () => {
        await result.current.copy('second text');
      });
      expect(result.current.hasCopied).toBe(true);

      expect(mockWriteText).toHaveBeenCalledTimes(2);
    });
  });

  describe('reset functionality', () => {
    it('clears hasCopied state when user closes dialog', async () => {
      const { result } = renderHook(() => useClipboard());

      await act(async () => {
        await result.current.copy('test text');
      });
      expect(result.current.hasCopied).toBe(true);

      act(() => {
        result.current.reset();
      });

      expect(result.current.hasCopied).toBe(false);
    });

    it('allows copying again after reset', async () => {
      const { result } = renderHook(() => useClipboard());

      await act(async () => {
        await result.current.copy('first text');
      });

      act(() => {
        result.current.reset();
      });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.copy('second text');
      });

      expect(success).toBe(true);
      expect(result.current.hasCopied).toBe(true);
    });
  });

  describe('clipboard API not supported', () => {
    it('returns false when clipboard API is unavailable', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useClipboard());

      let success: boolean = true;
      await act(async () => {
        success = await result.current.copy('test text');
      });

      expect(success).toBe(false);
    });

    it('does not update hasCopied when clipboard API is unavailable', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useClipboard());

      await act(async () => {
        await result.current.copy('test text');
      });

      expect(result.current.hasCopied).toBe(false);
    });
  });

  describe('copy failure', () => {
    it('returns false when clipboard write fails', async () => {
      const error = new Error('Permission denied');
      mockWriteText.mockRejectedValue(error);

      const { result } = renderHook(() => useClipboard());

      let success: boolean = true;
      await act(async () => {
        success = await result.current.copy('test text');
      });

      expect(success).toBe(false);
    });

    it('sets hasCopied to false when copy fails', async () => {
      mockWriteText.mockRejectedValue(new Error('Permission denied'));

      const { result } = renderHook(() => useClipboard());

      await act(async () => {
        await result.current.copy('test text');
      });

      expect(result.current.hasCopied).toBe(false);
    });
  });
});
