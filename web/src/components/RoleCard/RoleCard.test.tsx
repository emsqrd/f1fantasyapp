import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { InfoRoleCardContentProps } from '../InfoRoleCardContent/InfoRoleCardContent';
import { RoleCard } from './RoleCard';

const mockAddRoleCardContent = vi.fn();
vi.mock('../AddRoleCardContent/AddRoleCardContent', () => ({
  AddRoleCardContent: ({ onOpenSheet, role }: { onOpenSheet: () => void; role: string }) => {
    mockAddRoleCardContent({ onOpenSheet, role });
    return <div data-testid="add-role-card-content">Mocked AddRoleCardContent</div>;
  },
}));

const mockInfoRoleCardContent = vi.fn();
vi.mock('../InfoRoleCardContent/InfoRoleCardContent', () => ({
  InfoRoleCardContent: (props: InfoRoleCardContentProps) => {
    mockInfoRoleCardContent(props);
    return <div data-testid="info-role-card-content">Mock InfoRoleCardContent</div>;
  },
}));

describe('RoleCard', () => {
  const removeButtonSelector = { role: 'button', name: 'Remove role' } as const;
  const getRemoveButton = () =>
    screen.getByRole(removeButtonSelector.role, { name: removeButtonSelector.name });
  const queryRemoveButton = () =>
    screen.queryByRole(removeButtonSelector.role, { name: removeButtonSelector.name });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty Variant', () => {
    const onOpenSheet = vi.fn();

    beforeEach(() => {
      render(<RoleCard variant="empty" role="Driver" onOpenSheet={onOpenSheet} />);
    });

    it('should only render AddRoleCardComponent component', () => {
      expect(screen.getByTestId('add-role-card-content')).toBeInTheDocument();
      expect(screen.queryByTestId('info-role-card-content')).not.toBeInTheDocument();
    });

    it('should forward correct props to AddRoleCardContent component', () => {
      expect(mockAddRoleCardContent).toBeCalledWith({
        role: 'Driver',
        onOpenSheet: onOpenSheet,
      });
    });

    it('should not render remove button', () => {
      expect(queryRemoveButton()).not.toBeInTheDocument();
    });
  });

  describe('Filled Variant', () => {
    const name = 'Carlos Sainz';
    const onRemove = vi.fn();

    beforeEach(() => {
      render(<RoleCard variant="filled" name={name} onRemove={onRemove} />);
    });

    it('should only render InfoRoleCardContent component', () => {
      expect(screen.getByTestId('info-role-card-content')).toBeInTheDocument();
      expect(screen.queryByTestId('add-role-card-content')).not.toBeInTheDocument();
    });

    it('should forward correct props to InfoRoleCardContent component', () => {
      expect(mockInfoRoleCardContent).toBeCalledWith({
        name: name,
      });
    });

    it('should render remove button', () => {
      expect(getRemoveButton()).toBeInTheDocument();
    });

    it('should call onRemove when remove button is clicked', async () => {
      const user = userEvent.setup();

      await user.click(getRemoveButton());

      expect(onRemove).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty name', () => {
      render(<RoleCard variant="filled" name="" onRemove={vi.fn()} />);

      expect(mockInfoRoleCardContent).toBeCalledWith({
        name: '',
      });
    });
  });
});
