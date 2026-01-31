import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useLineupPicker } from './useLineupPicker';

// Mock Sentry
vi.mock('@sentry/react', () => ({
  logger: {
    error: vi.fn(),
  },
}));

// Mock TanStack Router
const mockInvalidate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    invalidate: mockInvalidate,
  }),
}));

interface TestItem {
  id: number;
  name: string;
}

const mockItems: TestItem[] = [
  { id: 1, name: 'Item 1' },
  { id: 2, name: 'Item 2' },
  { id: 3, name: 'Item 3' },
  { id: 4, name: 'Item 4' },
  { id: 5, name: 'Item 5' },
];

describe('useLineupPicker', () => {
  const mockAddToTeam = vi.fn();
  const mockRemoveFromTeam = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockInvalidate.mockResolvedValue(undefined);
    mockAddToTeam.mockResolvedValue(undefined);
    mockRemoveFromTeam.mockResolvedValue(undefined);
  });

  describe('displayLineup', () => {
    it('pads lineup with nulls when lineup is shorter than lineupSize', () => {
      const { result } = renderHook(() =>
        useLineupPicker({
          items: mockItems,
          lineup: [mockItems[0], mockItems[1]],
          lineupSize: 4,
          itemType: 'driver',
          addToTeam: mockAddToTeam,
          removeFromTeam: mockRemoveFromTeam,
        }),
      );

      expect(result.current.displayLineup).toEqual([mockItems[0], mockItems[1], null, null]);
    });

    it('returns lineup as-is when it matches lineupSize', () => {
      const { result } = renderHook(() =>
        useLineupPicker({
          items: mockItems,
          lineup: [mockItems[0], mockItems[1], mockItems[2], mockItems[3]],
          lineupSize: 4,
          itemType: 'driver',
          addToTeam: mockAddToTeam,
          removeFromTeam: mockRemoveFromTeam,
        }),
      );

      expect(result.current.displayLineup).toEqual([
        mockItems[0],
        mockItems[1],
        mockItems[2],
        mockItems[3],
      ]);
    });

    it('handles empty lineup', () => {
      const { result } = renderHook(() =>
        useLineupPicker({
          items: mockItems,
          lineup: [],
          lineupSize: 4,
          itemType: 'driver',
          addToTeam: mockAddToTeam,
          removeFromTeam: mockRemoveFromTeam,
        }),
      );

      expect(result.current.displayLineup).toEqual([null, null, null, null]);
    });
  });

  describe('pool', () => {
    it('returns all items when lineup is empty', () => {
      const { result } = renderHook(() =>
        useLineupPicker({
          items: mockItems,
          lineup: [],
          lineupSize: 4,
          itemType: 'driver',
          addToTeam: mockAddToTeam,
          removeFromTeam: mockRemoveFromTeam,
        }),
      );

      expect(result.current.pool).toEqual(mockItems);
    });

    it('filters out items already in lineup', () => {
      const { result } = renderHook(() =>
        useLineupPicker({
          items: mockItems,
          lineup: [mockItems[0], mockItems[2]],
          lineupSize: 4,
          itemType: 'driver',
          addToTeam: mockAddToTeam,
          removeFromTeam: mockRemoveFromTeam,
        }),
      );

      expect(result.current.pool).toEqual([mockItems[1], mockItems[3], mockItems[4]]);
    });

    it('returns empty pool when all items are in lineup', () => {
      const { result } = renderHook(() =>
        useLineupPicker({
          items: mockItems.slice(0, 4),
          lineup: mockItems.slice(0, 4),
          lineupSize: 4,
          itemType: 'driver',
          addToTeam: mockAddToTeam,
          removeFromTeam: mockRemoveFromTeam,
        }),
      );

      expect(result.current.pool).toEqual([]);
    });
  });

  describe('openPicker', () => {
    it('clears previous errors when picker is opened', async () => {
      const { result } = renderHook(() =>
        useLineupPicker({
          items: mockItems,
          lineup: [],
          lineupSize: 4,
          itemType: 'driver',
          addToTeam: mockAddToTeam,
          removeFromTeam: mockRemoveFromTeam,
        }),
      );

      // Simulate an error state
      mockAddToTeam.mockRejectedValueOnce(new Error('API Error'));
      await act(async () => {
        await result.current.handleAdd(0, mockItems[0]);
      });

      // Wait for error to be set
      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      act(() => {
        result.current.openPicker(1);
      });

      expect(result.current.error).toBe(null);
    });

    it('does not open picker when operation is pending', async () => {
      // Make the mock take some time to resolve so we can test pending state
      let resolveAdd: () => void;
      const addPromise = new Promise<void>((resolve) => {
        resolveAdd = resolve;
      });
      mockAddToTeam.mockReturnValueOnce(addPromise);

      const { result } = renderHook(() =>
        useLineupPicker({
          items: mockItems,
          lineup: [],
          lineupSize: 4,
          itemType: 'driver',
          addToTeam: mockAddToTeam,
          removeFromTeam: mockRemoveFromTeam,
        }),
      );

      // Start an add operation (will be pending)
      act(() => {
        result.current.handleAdd(0, mockItems[0]);
      });

      // Try to open picker while pending
      act(() => {
        result.current.openPicker(1);
      });

      // selectedPosition should not change
      expect(result.current.selectedPosition).toBe(null);

      // Clean up - resolve the promise
      await act(async () => {
        resolveAdd!();
        await addPromise;
      });
    });
  });

  describe('handleAdd', () => {
    it('calls addToTeam with correct parameters', async () => {
      const { result } = renderHook(() =>
        useLineupPicker({
          items: mockItems,
          lineup: [],
          lineupSize: 4,
          itemType: 'driver',
          addToTeam: mockAddToTeam,
          removeFromTeam: mockRemoveFromTeam,
        }),
      );

      await act(async () => {
        await result.current.handleAdd(1, mockItems[2]);
      });

      expect(mockAddToTeam).toHaveBeenCalledWith(mockItems[2].id, 1);
    });

    it('invalidates router after successful add', async () => {
      const { result } = renderHook(() =>
        useLineupPicker({
          items: mockItems,
          lineup: [],
          lineupSize: 4,
          itemType: 'driver',
          addToTeam: mockAddToTeam,
          removeFromTeam: mockRemoveFromTeam,
        }),
      );

      await act(async () => {
        await result.current.handleAdd(0, mockItems[0]);
      });

      expect(mockInvalidate).toHaveBeenCalled();
    });

    it('closes picker after successful add', async () => {
      const { result } = renderHook(() =>
        useLineupPicker({
          items: mockItems,
          lineup: [],
          lineupSize: 4,
          itemType: 'driver',
          addToTeam: mockAddToTeam,
          removeFromTeam: mockRemoveFromTeam,
        }),
      );

      act(() => {
        result.current.openPicker(0);
      });
      expect(result.current.selectedPosition).toBe(0);

      await act(async () => {
        await result.current.handleAdd(0, mockItems[0]);
      });

      expect(result.current.selectedPosition).toBe(null);
    });

    it('sets isPending during add operation', async () => {
      // Create a promise we can control
      let resolveAdd: () => void;
      const addPromise = new Promise<void>((resolve) => {
        resolveAdd = resolve;
      });
      mockAddToTeam.mockReturnValueOnce(addPromise);

      const { result } = renderHook(() =>
        useLineupPicker({
          items: mockItems,
          lineup: [],
          lineupSize: 4,
          itemType: 'driver',
          addToTeam: mockAddToTeam,
          removeFromTeam: mockRemoveFromTeam,
        }),
      );

      expect(result.current.isPending).toBe(false);

      // Start the operation
      act(() => {
        result.current.handleAdd(0, mockItems[0]);
      });

      // Should be pending now
      expect(result.current.isPending).toBe(true);

      // Resolve the operation
      await act(async () => {
        resolveAdd!();
        await addPromise;
      });

      expect(result.current.isPending).toBe(false);
    });

    it('sets error message when add fails', async () => {
      mockAddToTeam.mockRejectedValueOnce(new Error('API Error'));

      const { result } = renderHook(() =>
        useLineupPicker({
          items: mockItems,
          lineup: [],
          lineupSize: 4,
          itemType: 'driver',
          addToTeam: mockAddToTeam,
          removeFromTeam: mockRemoveFromTeam,
        }),
      );

      act(() => {
        result.current.openPicker(0);
      });

      await act(async () => {
        await result.current.handleAdd(0, mockItems[0]);
      });

      expect(result.current.error).toBe('Failed to add driver. Please try again.');
    });

    it('keeps picker open when add fails', async () => {
      mockAddToTeam.mockRejectedValueOnce(new Error('API Error'));

      const { result } = renderHook(() =>
        useLineupPicker({
          items: mockItems,
          lineup: [],
          lineupSize: 4,
          itemType: 'driver',
          addToTeam: mockAddToTeam,
          removeFromTeam: mockRemoveFromTeam,
        }),
      );

      act(() => {
        result.current.openPicker(0);
      });

      await act(async () => {
        await result.current.handleAdd(0, mockItems[0]);
      });

      expect(result.current.selectedPosition).toBe(0);
    });

    it('clears error before add operation', async () => {
      mockAddToTeam.mockRejectedValueOnce(new Error('First error'));

      const { result } = renderHook(() =>
        useLineupPicker({
          items: mockItems,
          lineup: [],
          lineupSize: 4,
          itemType: 'driver',
          addToTeam: mockAddToTeam,
          removeFromTeam: mockRemoveFromTeam,
        }),
      );

      // First add fails
      await act(async () => {
        await result.current.handleAdd(0, mockItems[0]);
      });
      expect(result.current.error).toBeTruthy();

      // Second add succeeds - error should clear
      await act(async () => {
        await result.current.handleAdd(0, mockItems[0]);
      });
      expect(result.current.error).toBe(null);
    });
  });

  describe('handleRemove', () => {
    it('calls removeFromTeam with correct position', async () => {
      const { result } = renderHook(() =>
        useLineupPicker({
          items: mockItems,
          lineup: [mockItems[0]],
          lineupSize: 4,
          itemType: 'driver',
          addToTeam: mockAddToTeam,
          removeFromTeam: mockRemoveFromTeam,
        }),
      );

      await act(async () => {
        await result.current.handleRemove(0);
      });

      expect(mockRemoveFromTeam).toHaveBeenCalledWith(0);
    });

    it('invalidates router after successful remove', async () => {
      const { result } = renderHook(() =>
        useLineupPicker({
          items: mockItems,
          lineup: [mockItems[0]],
          lineupSize: 4,
          itemType: 'driver',
          addToTeam: mockAddToTeam,
          removeFromTeam: mockRemoveFromTeam,
        }),
      );

      await act(async () => {
        await result.current.handleRemove(0);
      });

      expect(mockInvalidate).toHaveBeenCalled();
    });

    it('sets isPending during remove operation', async () => {
      // Create a promise we can control
      let resolveRemove: () => void;
      const removePromise = new Promise<void>((resolve) => {
        resolveRemove = resolve;
      });
      mockRemoveFromTeam.mockReturnValueOnce(removePromise);

      const { result } = renderHook(() =>
        useLineupPicker({
          items: mockItems,
          lineup: [mockItems[0]],
          lineupSize: 4,
          itemType: 'driver',
          addToTeam: mockAddToTeam,
          removeFromTeam: mockRemoveFromTeam,
        }),
      );

      expect(result.current.isPending).toBe(false);

      // Start the operation
      act(() => {
        result.current.handleRemove(0);
      });

      // Should be pending now
      expect(result.current.isPending).toBe(true);

      // Resolve the operation
      await act(async () => {
        resolveRemove!();
        await removePromise;
      });

      expect(result.current.isPending).toBe(false);
    });

    it('sets error message when remove fails', async () => {
      mockRemoveFromTeam.mockRejectedValueOnce(new Error('API Error'));

      const { result } = renderHook(() =>
        useLineupPicker({
          items: mockItems,
          lineup: [mockItems[0]],
          lineupSize: 4,
          itemType: 'driver',
          addToTeam: mockAddToTeam,
          removeFromTeam: mockRemoveFromTeam,
        }),
      );

      await act(async () => {
        await result.current.handleRemove(0);
      });

      expect(result.current.error).toBe('Failed to remove driver. Please try again.');
    });

    it('clears error before remove operation', async () => {
      mockRemoveFromTeam.mockRejectedValueOnce(new Error('First error'));

      const { result } = renderHook(() =>
        useLineupPicker({
          items: mockItems,
          lineup: [mockItems[0]],
          lineupSize: 4,
          itemType: 'driver',
          addToTeam: mockAddToTeam,
          removeFromTeam: mockRemoveFromTeam,
        }),
      );

      // First remove fails
      await act(async () => {
        await result.current.handleRemove(0);
      });
      expect(result.current.error).toBeTruthy();

      // Second remove succeeds - error should clear
      await act(async () => {
        await result.current.handleRemove(0);
      });
      expect(result.current.error).toBe(null);
    });
  });

  describe('itemType in error messages', () => {
    it('uses custom itemType in add error message', async () => {
      mockAddToTeam.mockRejectedValueOnce(new Error('API Error'));

      const { result } = renderHook(() =>
        useLineupPicker({
          items: mockItems,
          lineup: [],
          lineupSize: 4,
          itemType: 'constructor',
          addToTeam: mockAddToTeam,
          removeFromTeam: mockRemoveFromTeam,
        }),
      );

      await act(async () => {
        await result.current.handleAdd(0, mockItems[0]);
      });

      expect(result.current.error).toBe('Failed to add constructor. Please try again.');
    });

    it('uses custom itemType in remove error message', async () => {
      mockRemoveFromTeam.mockRejectedValueOnce(new Error('API Error'));

      const { result } = renderHook(() =>
        useLineupPicker({
          items: mockItems,
          lineup: [mockItems[0]],
          lineupSize: 4,
          itemType: 'constructor',
          addToTeam: mockAddToTeam,
          removeFromTeam: mockRemoveFromTeam,
        }),
      );

      await act(async () => {
        await result.current.handleRemove(0);
      });

      expect(result.current.error).toBe('Failed to remove constructor. Please try again.');
    });
  });
});
