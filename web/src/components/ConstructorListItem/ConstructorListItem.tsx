import type { Constructor } from '@/contracts/Role';
import { CirclePlus } from 'lucide-react';

import { Button } from '../ui/button';

export interface ConstructorListItemProps {
  constructor: Constructor;
  onSelect: () => void;
}

export function ConstructorListItem({ constructor, onSelect }: ConstructorListItemProps) {
  return (
    <li className="flex items-center justify-between pb-4">
      <span>{constructor.name}</span>
      <Button variant="ghost" aria-label="Add Constructor" onClick={onSelect}>
        <CirclePlus />
      </Button>
    </li>
  );
}
