import type { Driver } from '@/contracts/Role';
import { CirclePlus } from 'lucide-react';

import { Button } from '../ui/button';

interface DriverListItemProps {
  driver: Driver;
  onSelect: () => void;
}

export function DriverListItem({ driver, onSelect }: DriverListItemProps) {
  return (
    <li key={driver.id} className="flex items-center justify-between pb-4">
      <span>
        {driver.firstName} {driver.lastName}
      </span>
      <Button variant="ghost" aria-label="Add Driver" onClick={onSelect}>
        <CirclePlus />
      </Button>
    </li>
  );
}
