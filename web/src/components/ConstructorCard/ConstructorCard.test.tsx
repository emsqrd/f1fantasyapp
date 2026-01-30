import type { Constructor } from '@/contracts/Role';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RoleCardProps } from '../RoleCard/RoleCard';
import { ConstructorCard } from './ConstructorCard';

// Mock RoleCard to capture props
const mockRoleCard = vi.fn();
vi.mock('../RoleCard/RoleCard', () => ({
  RoleCard: (props: RoleCardProps) => {
    mockRoleCard(props);
    return <div data-testid="role-card">Mocked RoleCard</div>;
  },
}));

describe('ConstructorCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Filled Variant', () => {
    const constructor: Constructor = {
      id: 1,
      name: 'Ferrari',
      fullName: 'Scuderia Ferrari',
      countryAbbreviation: 'ITA',
    };
    const onOpenSheet = vi.fn();
    const onRemove = vi.fn();

    beforeEach(() => {
      render(
        <ConstructorCard constructor={constructor} onOpenSheet={onOpenSheet} onRemove={onRemove} />,
      );
    });

    it('should forward correct props to RoleCard', () => {
      expect(mockRoleCard).toBeCalledTimes(1);
      expect(mockRoleCard).toBeCalledWith({
        variant: 'filled',
        name: 'Ferrari',
        onRemove,
      });
    });
  });

  describe('Empty Variant', () => {
    const onOpenSheet = vi.fn();
    const onRemove = vi.fn();

    beforeEach(() => {
      render(<ConstructorCard constructor={null} onOpenSheet={onOpenSheet} onRemove={onRemove} />);
    });

    it('should pass Constructor role string when driver is null', () => {
      expect(mockRoleCard).toHaveBeenCalledTimes(1);
      expect(mockRoleCard).toHaveBeenCalledWith({
        variant: 'empty',
        role: 'Constructor',
        onOpenSheet,
      });
    });
  });
});
