import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { type ReactNode, createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useLineupPicker } from './useLineupPicker';

// Mock Sentry
vi.mock('@sentry/react', () => ({
  logger: {
    error: vi.fn(),
  },
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

const mockAddToTeam = vi.fn();
const mockRemoveFromTeam = vi.fn();

// useLineupPicker reaches the Query client through useMutation, so it needs a provider.
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

function renderPicker(
  options: {
    items?: TestItem[];
    lineup?: (TestItem | null)[];
    itemType?: 'driver' | 'constructor';
  } = {},
) {
  return renderHook(
    () =>
      useLineupPicker({
        items: options.items ?? mockItems,
        lineup: options.lineup ?? [null, null, null, null],
        itemType: options.itemType ?? 'driver',
        addToTeam: mockAddToTeam,
        removeFromTeam: mockRemoveFromTeam,
      }),
    { wrapper: createWrapper() },
  );
}

describe('useLineupPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddToTeam.mockResolvedValue(undefined);
    mockRemoveFromTeam.mockResolvedValue(undefined);
  });

  describe('pool', () => {
    it('returns all items when lineup is empty', () => {
      const { result } = renderPicker();

      expect(result.current.pool).toEqual(mockItems);
    });

    it('excludes items already in the lineup from the pool', () => {
      const { result } = renderPicker({ lineup: [mockItems[0], mockItems[2], null, null] });

      expect(result.current.pool).toEqual([mockItems[1], mockItems[3], mockItems[4]]);
    });

    it('returns empty pool when all items are in lineup', () => {
      const { result } = renderPicker({
        items: mockItems.slice(0, 4),
        lineup: mockItems.slice(0, 4),
      });

      expect(result.current.pool).toEqual([]);
    });
  });

  describe('openPicker', () => {
    it('clears previous errors when picker is opened', async () => {
      mockAddToTeam.mockRejectedValueOnce(new Error('API Error'));

      const { result } = renderPicker();

      act(() => {
        result.current.handleAdd(0, mockItems[0]);
      });
      await waitFor(() => expect(result.current.error).toBeTruthy());

      act(() => {
        result.current.openPicker(1);
      });

      expect(result.current.error).toBe(null);
    });

    it('does not open picker when operation is pending', async () => {
      let resolveAdd: () => void;
      mockAddToTeam.mockReturnValueOnce(
        new Promise<void>((resolve) => {
          resolveAdd = resolve;
        }),
      );

      const { result } = renderPicker();

      act(() => {
        result.current.handleAdd(0, mockItems[0]);
      });
      await waitFor(() => expect(result.current.isPending).toBe(true));

      act(() => {
        result.current.openPicker(1);
      });

      expect(result.current.selectedPosition).toBe(null);

      resolveAdd!();
      await waitFor(() => expect(result.current.isPending).toBe(false));
    });
  });

  describe('handleAdd', () => {
    it('calls addToTeam with correct parameters', async () => {
      const { result } = renderPicker();

      act(() => {
        result.current.handleAdd(1, mockItems[2]);
      });

      await waitFor(() => expect(mockAddToTeam).toHaveBeenCalledWith(mockItems[2].id, 1));
    });

    it('closes picker after successful add', async () => {
      const { result } = renderPicker();

      act(() => {
        result.current.openPicker(0);
      });
      expect(result.current.selectedPosition).toBe(0);

      act(() => {
        result.current.handleAdd(0, mockItems[0]);
      });

      await waitFor(() => expect(result.current.selectedPosition).toBe(null));
    });

    it('sets error message when add fails', async () => {
      mockAddToTeam.mockRejectedValueOnce(new Error('API Error'));

      const { result } = renderPicker();

      act(() => {
        result.current.openPicker(0);
      });

      act(() => {
        result.current.handleAdd(0, mockItems[0]);
      });

      await waitFor(() =>
        expect(result.current.error).toBe('Failed to add driver. Please try again.'),
      );
    });

    it('closes picker when add fails', async () => {
      mockAddToTeam.mockRejectedValueOnce(new Error('API Error'));

      const { result } = renderPicker();

      act(() => {
        result.current.openPicker(0);
      });

      act(() => {
        result.current.handleAdd(0, mockItems[0]);
      });

      await waitFor(() => expect(result.current.selectedPosition).toBe(null));
    });

    it('clears error before add operation', async () => {
      mockAddToTeam.mockRejectedValueOnce(new Error('First error'));

      const { result } = renderPicker();

      // First add fails
      act(() => {
        result.current.handleAdd(0, mockItems[0]);
      });
      await waitFor(() => expect(result.current.error).toBeTruthy());

      // Second add succeeds - error should clear
      act(() => {
        result.current.handleAdd(0, mockItems[0]);
      });
      await waitFor(() => expect(result.current.error).toBe(null));
    });
  });

  describe('handleRemove', () => {
    it('calls removeFromTeam with correct position', async () => {
      const { result } = renderPicker({ lineup: [mockItems[0], null, null, null] });

      act(() => {
        result.current.handleRemove(0);
      });

      await waitFor(() => expect(mockRemoveFromTeam).toHaveBeenCalledWith(0));
    });

    it('sets error message when remove fails', async () => {
      mockRemoveFromTeam.mockRejectedValueOnce(new Error('API Error'));

      const { result } = renderPicker({ lineup: [mockItems[0], null, null, null] });

      act(() => {
        result.current.handleRemove(0);
      });

      await waitFor(() =>
        expect(result.current.error).toBe('Failed to remove driver. Please try again.'),
      );
    });

    it('clears error before remove operation', async () => {
      mockRemoveFromTeam.mockRejectedValueOnce(new Error('First error'));

      const { result } = renderPicker({ lineup: [mockItems[0], null, null, null] });

      // First remove fails
      act(() => {
        result.current.handleRemove(0);
      });
      await waitFor(() => expect(result.current.error).toBeTruthy());

      // Second remove succeeds - error should clear
      act(() => {
        result.current.handleRemove(0);
      });
      await waitFor(() => expect(result.current.error).toBe(null));
    });
  });

  describe('itemType in error messages', () => {
    it('uses custom itemType in add error message', async () => {
      mockAddToTeam.mockRejectedValueOnce(new Error('API Error'));

      const { result } = renderPicker({ itemType: 'constructor' });

      act(() => {
        result.current.handleAdd(0, mockItems[0]);
      });

      await waitFor(() =>
        expect(result.current.error).toBe('Failed to add constructor. Please try again.'),
      );
    });

    it('uses custom itemType in remove error message', async () => {
      mockRemoveFromTeam.mockRejectedValueOnce(new Error('API Error'));

      const { result } = renderPicker({
        lineup: [mockItems[0], null, null, null],
        itemType: 'constructor',
      });

      act(() => {
        result.current.handleRemove(0);
      });

      await waitFor(() =>
        expect(result.current.error).toBe('Failed to remove constructor. Please try again.'),
      );
    });
  });
});
