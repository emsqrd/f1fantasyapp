import type { Driver } from '@/contracts/Role';

import { RoleCard } from '../RoleCard/RoleCard';

interface DriverCardProps {
  driver: Driver | null;
  onOpenSheet: () => void;
  onRemove: () => void;
}

export function DriverCard({ driver, onOpenSheet, onRemove }: DriverCardProps) {
  if (!driver) {
    return <RoleCard variant="empty" role="Driver" onOpenSheet={onOpenSheet} />;
  }

  return (
    <RoleCard
      variant="filled"
      name={`${driver.firstName} ${driver.lastName}`}
      onRemove={onRemove}
    />
  );
}
