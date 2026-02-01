import type { Constructor } from '@/contracts/Role';
import { CirclePlus, X } from 'lucide-react';

import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

interface ConstructorCardProps {
  constructor: Constructor | null;
  onOpenPicker: () => void;
  onRemove: () => void;
}

export function ConstructorCard({ constructor, onOpenPicker, onRemove }: ConstructorCardProps) {
  return (
    <Card className="bg-secondary relative py-4">
      <CardContent className="group flex h-full items-center justify-between px-3">
        {constructor ? (
          <div className="flex w-full">
            <span className="aspect-square w-14 self-center rounded-full border-2 border-gray-300" />
            <div className="flex flex-1 flex-col items-start justify-between pl-4">
              <h3 className="text-lg font-bold">{constructor.name}</h3>
            </div>
          </div>
        ) : (
          <Button
            onClick={onOpenPicker}
            variant="ghost"
            className="flex items-center gap-2 !bg-transparent"
          >
            <CirclePlus />
            Add Constructor
          </Button>
        )}
      </CardContent>
      {constructor && (
        <Button
          size="icon"
          variant="ghost"
          className="bg-secondary absolute top-2 right-2 h-6 w-6 rounded-full text-white"
          aria-label="Remove constructor"
          onClick={onRemove}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </Card>
  );
}
