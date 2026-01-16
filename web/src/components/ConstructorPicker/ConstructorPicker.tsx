import type { Constructor } from '@/contracts/Role';
import { getActiveConstructors } from '@/services/constructorService';
import { addConstructorToTeam, removeConstructorFromTeam } from '@/services/teamService';
import type { ComponentType } from 'react';

import { ConstructorCard } from '../ConstructorCard/ConstructorCard';
import { ConstructorListItem } from '../ConstructorListItem/ConstructorListItem';
import type { RoleCardProps, RoleListItemProps } from '../RolePicker/RolePicker';
import { RolePicker } from '../RolePicker/RolePicker';

// Adapter components to bridge between RolePicker's generic props and Constructor-specific components
const ConstructorCardAdapter: ComponentType<RoleCardProps<Constructor>> = ({
  item,
  onClick,
  onRemove,
}) => <ConstructorCard constructor={item} onOpenSheet={onClick} onRemove={onRemove} />;

const ConstructorListItemAdapter: ComponentType<RoleListItemProps<Constructor>> = ({
  item,
  onSelect,
}) => <ConstructorListItem constructor={item} onSelect={onSelect} />;

interface ConstructorPickerProps {
  lineupSize?: number;
  initialConstructors?: (Constructor | null)[];
}

export function ConstructorPicker({ lineupSize = 2, initialConstructors }: ConstructorPickerProps) {
  return (
    <RolePicker<Constructor>
      lineupSize={lineupSize}
      initialItems={initialConstructors}
      fetchItems={getActiveConstructors}
      addToTeam={addConstructorToTeam}
      removeFromTeam={removeConstructorFromTeam}
      CardComponent={ConstructorCardAdapter}
      ListItemComponent={ConstructorListItemAdapter}
      sheetTitle="Select Constructor"
      sheetDescription="Choose a constructor from the list below to add to your team."
      loadingMessage="Loading Constructors..."
      errorPrefix="Failed to load active constructors"
      gridClassName="grid grid-cols-1 gap-4 lg:grid-cols-2"
    />
  );
}
