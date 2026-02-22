import type { Driver } from '@/contracts/Role';
import { cn, formatMillions } from '@/lib/utils';
import { CirclePlus } from 'lucide-react';

import { Button } from '../ui/button';

interface DriverListItemProps {
  driver: Driver;
  onSelect: () => void;
  disabled?: boolean;
}

export function DriverListItem({ driver, onSelect, disabled = false }: DriverListItemProps) {
  return (
    <li className={cn('flex items-center gap-3 py-2.5', disabled && 'opacity-40')}>
      <div className="bg-secondary text-secondary-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold tracking-wide">
        {driver.abbreviation}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">
          {driver.firstName} {driver.lastName}
        </div>
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <span>{driver.countryAbbreviation}</span>
          <span aria-hidden="true">&middot;</span>
          <span>${formatMillions(driver.price)}M</span>
          <span aria-hidden="true">&middot;</span>
          <span>-- pts</span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Add Driver"
        onClick={disabled ? undefined : onSelect}
        disabled={disabled}
      >
        <CirclePlus />
      </Button>
    </li>
  );
}
