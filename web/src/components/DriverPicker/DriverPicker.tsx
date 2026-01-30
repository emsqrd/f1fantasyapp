import type { Driver } from '@/contracts/Role';
import { getActiveDrivers } from '@/services/driverService';
import { addDriverToTeam, removeDriverFromTeam } from '@/services/teamService';
import type { ComponentType } from 'react';

import { DriverCard } from '../DriverCard/DriverCard';
import { DriverListItem } from '../DriverListItem/DriverListItem';
import type { LineupCardProps, LineupListItemProps } from '../LineupPicker/LineupPicker';
import { LineupPicker } from '../LineupPicker/LineupPicker';

// Adapter components to bridge between LineupPicker's generic props and Driver-specific components
const DriverCardAdapter: ComponentType<LineupCardProps<Driver>> = ({ item, onClick, onRemove }) => (
  <DriverCard driver={item} onOpenPicker={onClick} onRemove={onRemove} />
);

const DriverListItemAdapter: ComponentType<LineupListItemProps<Driver>> = ({ item, onSelect }) => (
  <DriverListItem driver={item} onSelect={onSelect} />
);

interface DriverPickerProps {
  lineupSize?: number;
  currentDrivers?: (Driver | null)[];
}

export function DriverPicker({ lineupSize = 5, currentDrivers }: DriverPickerProps) {
  return (
    <LineupPicker<Driver>
      lineupSize={lineupSize}
      lineup={currentDrivers}
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
