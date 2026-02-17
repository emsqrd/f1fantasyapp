import type { Constructor } from '@/contracts/Role';
import { CirclePlus } from 'lucide-react';

import { Button } from '../ui/button';

export interface ConstructorListItemProps {
  constructor: Constructor;
  onSelect: () => void;
}

export function ConstructorListItem({ constructor, onSelect }: ConstructorListItemProps) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <div className="bg-secondary text-secondary-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold tracking-wide">
        {constructor.abbreviation}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">{constructor.name}</div>
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <span>{constructor.countryAbbreviation}</span>
          <span aria-hidden="true">&middot;</span>
          <span>$--.-M</span>
          <span aria-hidden="true">&middot;</span>
          <span>-- pts</span>
        </div>
      </div>
      <Button variant="ghost" aria-label="Add Constructor" onClick={onSelect}>
        <CirclePlus />
      </Button>
    </li>
  );
}
