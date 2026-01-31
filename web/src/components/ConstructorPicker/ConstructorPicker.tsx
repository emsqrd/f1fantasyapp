import type { Constructor } from '@/contracts/Role';
import { getActiveConstructors } from '@/services/constructorService';
import { addConstructorToTeam, removeConstructorFromTeam } from '@/services/teamService';
import type { ComponentType } from 'react';

import { ConstructorCard } from '../ConstructorCard/ConstructorCard';
import { ConstructorListItem } from '../ConstructorListItem/ConstructorListItem';
import type { LineupCardProps, LineupListItemProps } from '../LineupPicker/LineupPicker';
import { LineupPicker } from '../LineupPicker/LineupPicker';

// Adapter components to bridge between LineupPicker's generic props and Constructor-specific components
const ConstructorCardAdapter: ComponentType<LineupCardProps<Constructor>> = ({
  item,
  onClick,
  onRemove,
}) => <ConstructorCard constructor={item} onOpenPicker={onClick} onRemove={onRemove} />;

const ConstructorListItemAdapter: ComponentType<LineupListItemProps<Constructor>> = ({
  item,
  onSelect,
}) => <ConstructorListItem constructor={item} onSelect={onSelect} />;

interface ConstructorPickerProps {
  lineupSize?: number;
  currentConstructors?: (Constructor | null)[];
}

export function ConstructorPicker({ lineupSize = 2, currentConstructors }: ConstructorPickerProps) {
  return (
    <LineupPicker<Constructor>
      lineupSize={lineupSize}
      lineup={currentConstructors}
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
