import type { Driver } from '@/contracts/Role';
import { getActiveDrivers } from '@/services/driverService';
import { addDriverToTeam, removeDriverFromTeam } from '@/services/teamService';
import type { ComponentType } from 'react';

import { DriverCard } from '../DriverCard/DriverCard';
import { DriverListItem } from '../DriverListItem/DriverListItem';
import type { RoleCardProps, RoleListItemProps } from '../RolePicker/RolePicker';
import { RolePicker } from '../RolePicker/RolePicker';

// Adapter components to bridge between RolePicker's generic props and Driver-specific components
const DriverCardAdapter: ComponentType<RoleCardProps<Driver>> = ({ item, onClick, onRemove }) => (
  <DriverCard driver={item} onOpenSheet={onClick} onRemove={onRemove} />
);

const DriverListItemAdapter: ComponentType<RoleListItemProps<Driver>> = ({ item, onSelect }) => (
  <DriverListItem driver={item} onSelect={onSelect} />
);

interface DriverPickerProps {
  lineupSize?: number;
  initialDrivers?: (Driver | null)[];
}

export function DriverPicker({ lineupSize = 5, initialDrivers }: DriverPickerProps) {
  return (
    <RolePicker<Driver>
      lineupSize={lineupSize}
      initialItems={initialDrivers}
      fetchItems={getActiveDrivers}
      addToTeam={addDriverToTeam}
      removeFromTeam={removeDriverFromTeam}
      CardComponent={DriverCardAdapter}
      ListItemComponent={DriverListItemAdapter}
      sheetTitle="Select Driver"
      sheetDescription="Choose a driver from the list below to add to your team."
      loadingMessage="Loading Drivers..."
      errorPrefix="Failed to load active drivers"
    />
  );
}
