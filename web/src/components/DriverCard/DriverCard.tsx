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
    <Card className="bg-secondary relative p-0">
      <CardContent className="px-3 py-4">
        {driver ? (
          <>
            <div className="flex items-center gap-3">
              <div className="border-border text-secondary-foreground flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold tracking-wide">
                {driver.abbreviation}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="overflow-hidden pr-6 leading-tight font-bold text-ellipsis whitespace-nowrap">
                  {driver.firstName} {driver.lastName}
                </h3>
                <div className="text-muted-foreground text-xs">{driver.countryAbbreviation}</div>
              </div>
            </div>
            <div className="bg-border my-2.5 h-px" />
            <div className="text-muted-foreground flex justify-between px-1 text-xs">
              <span>$--.-M</span>
              <span>-- pts</span>
            </div>
          </>
        ) : readOnly ? (
          <div className="flex items-center gap-3">
            <span className="h-14 w-14 shrink-0 rounded-full border-2 border-dashed border-gray-600" />
            <span className="text-muted-foreground text-sm">Empty Slot</span>
          </div>
        ) : (
          <Button
            onClick={onOpenPicker}
            variant="ghost"
            className="h-auto w-full justify-start gap-3 !bg-transparent p-0 hover:opacity-80"
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-gray-600">
              <CirclePlus className="text-primary h-6 w-6" />
            </span>
            <span className="text-muted-foreground text-sm">Add Driver</span>
          </Button>
        )}
      </CardContent>
      {driver && !readOnly && (
        <Button
          size="icon"
          variant="ghost"
          className="text-muted-foreground absolute top-2 right-2 h-6 w-6"
          aria-label="Remove driver"
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </Card>
  );
}
