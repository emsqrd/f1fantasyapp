import type { Constructor } from '@/contracts/Role';

import { RoleCard } from '../RoleCard/RoleCard';

interface ConstructorCardProps {
  constructor: Constructor | null;
  onOpenSheet: () => void;
  onRemove: () => void;
}

export function ConstructorCard({ constructor, onOpenSheet, onRemove }: ConstructorCardProps) {
  if (!constructor) {
    return <RoleCard variant="empty" role="Constructor" onOpenSheet={onOpenSheet} />;
  }

  return <RoleCard variant="filled" name={constructor.name} onRemove={onRemove} />;
}
