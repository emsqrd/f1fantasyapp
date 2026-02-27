import type { Driver } from '@/contracts/Role';
import { cn, formatMillions } from '@/lib/utils';
import { CirclePlus, X } from 'lucide-react';

import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

interface DriverCardProps {
  driver: Driver | null;
  onOpenPicker: () => void;
  onRemove: () => void;
  readOnly: boolean;
  isCaptain?: boolean;
  onSetCaptain?: () => void;
}

export function DriverCard({
  driver,
  onOpenPicker,
  onRemove,
  readOnly,
  isCaptain = false,
  onSetCaptain,
}: DriverCardProps) {
  return (
    <Card className={cn('bg-secondary relative p-0', isCaptain && 'border-yellow-500')}>
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
            <div className="text-muted-foreground flex items-center justify-between px-1 text-xs">
              <span>${formatMillions(driver.price)}M</span>
              {!readOnly && onSetCaptain && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="group h-6 w-6 p-0 [perspective:600px]"
                  aria-label={isCaptain ? 'Remove captain' : 'Set as captain'}
                  aria-pressed={isCaptain}
                  onClick={onSetCaptain}
                >
                  <span
                    className={cn(
                      'relative block h-5 w-5 transition-transform duration-300 [transform-style:preserve-3d]',
                      isCaptain && '[transform:rotateY(180deg)]',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute inset-0 flex items-center justify-center rounded-full border-2 text-xs font-black transition-colors [backface-visibility:hidden]',
                        'border-muted-foreground text-muted-foreground group-hover:border-yellow-700 group-hover:text-yellow-700 dark:group-hover:border-yellow-400 dark:group-hover:text-yellow-400',
                      )}
                    >
                      C
                    </span>
                    <span className="absolute inset-0 flex [transform:rotateY(180deg)] items-center justify-center rounded-full border-2 border-yellow-700 bg-yellow-700 text-xs font-black text-white [backface-visibility:hidden] dark:border-yellow-400 dark:bg-yellow-400 dark:text-black">
                      ×2
                    </span>
                  </span>
                </Button>
              )}
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
            className="h-auto w-full justify-start gap-3 p-0 hover:opacity-80"
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
