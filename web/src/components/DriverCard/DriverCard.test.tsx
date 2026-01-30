import type { Driver } from '@/contracts/Role';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RoleCardProps } from '../RoleCard/RoleCard';
import { DriverCard } from './DriverCard';

// Mock RoleCard to capture props
const mockRoleCard = vi.fn();
vi.mock('../RoleCard/RoleCard', () => ({
  RoleCard: (props: RoleCardProps) => {
    mockRoleCard(props);
    return <div data-testid="role-card">Mocked RoleCard</div>;
  },
}));

describe('DriverCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Filled Variant', () => {
    const driver: Driver = {
      id: 1,
      firstName: 'Carlos',
      lastName: 'Sainz',
      countryAbbreviation: 'SPA',
    };
    const onOpenSheet = vi.fn();
    const onRemove = vi.fn();

    beforeEach(() => {
      render(<DriverCard driver={driver} onOpenSheet={onOpenSheet} onRemove={onRemove} />);
    });

    it('should transform driver data correctly for RoleCard', () => {
      expect(mockRoleCard).toHaveBeenCalledTimes(1);
      expect(mockRoleCard).toHaveBeenCalledWith({
        variant: 'filled',
        name: 'Carlos Sainz',
        onRemove,
      });
    });
  });

  describe('Empty Variant', () => {
    const onOpenSheet = vi.fn();
    const onRemove = vi.fn();

    beforeEach(() => {
      render(<DriverCard driver={null} onOpenSheet={onOpenSheet} onRemove={onRemove} />);
    });

    it('should pass Driver role string when driver is null', () => {
      expect(mockRoleCard).toHaveBeenCalledTimes(1);
      expect(mockRoleCard).toHaveBeenCalledWith({
        variant: 'empty',
        role: 'Driver',
        onOpenSheet,
      });
    });
  });
});
