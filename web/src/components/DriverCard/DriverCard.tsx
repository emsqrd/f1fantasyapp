import type { Driver } from '@/contracts/Role';
import { CirclePlus, X } from 'lucide-react';

import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

interface DriverCardProps {
  driver: Driver | null;
  onOpenPicker: () => void;
  onRemove: () => void;
  readOnly: boolean;
}

export function DriverCard({ driver, onOpenPicker, onRemove, readOnly }: DriverCardProps) {
  return (
    <Card className="bg-secondary relative py-4">
      <CardContent className="group flex h-full items-center justify-between px-3">
        {driver ? (
          <div className="flex w-full">
            <span className="aspect-square w-14 self-center rounded-full border-2 border-gray-300" />
            <div className="flex flex-1 flex-col items-start justify-between pl-4">
              <h3 className="text-lg font-bold">
                {driver.firstName} {driver.lastName}
              </h3>
            </div>
          </div>
        ) : readOnly ? (
          // Read-only mode: Show placeholder matching filled card layout
          <div className="flex h-full w-full items-center">
            <span className="aspect-square w-14 self-center rounded-full border-2 border-dashed border-gray-600" />

            <div className="flex flex-1 flex-col items-start justify-between pl-4">
              <h3 className="text-muted-foreground text-lg font-medium">Empty Slot</h3>
            </div>
          </div>
        ) : (
          // Edit mode: Show add button matching filled card layout
          <Button
            onClick={onOpenPicker}
            variant="ghost"
            className="flex h-full w-full items-center !bg-transparent p-0 hover:opacity-80"
          >
            <span className="bg-primary/10 text-primary flex aspect-square w-14 items-center justify-center self-center rounded-full border-2 border-dashed border-gray-600">
              <CirclePlus className="size-6" />
            </span>
            <div className="flex flex-1 flex-col items-start justify-between pl-4">
              <h3 className="text-muted-foreground text-lg font-medium">Add Driver</h3>
            </div>
          </Button>
        )}
      </CardContent>
      {driver && !readOnly && (
        // Remove button only displays in edit mode
        <Button
          size="icon"
          variant="ghost"
          className="bg-secondary absolute top-2 right-2 h-6 w-6 rounded-full text-white"
          aria-label="Remove driver"
          onClick={onRemove}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </Card>
  );
}
