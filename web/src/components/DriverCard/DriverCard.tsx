import type { Driver } from '@/contracts/Role';
import { getDriverColor } from '@/lib/teamColors';
import { cn, formatMillions } from '@/lib/utils';
import { X } from 'lucide-react';

import { Button } from '../ui/button';

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
  if (!driver) {
    if (readOnly) return null;
    return (
      <button
        onClick={onOpenPicker}
        className="border-border flex min-h-[72px] w-full items-center gap-3 rounded-md border-2 border-dashed px-3 hover:opacity-80"
      >
        <span className="border-border flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-dashed">
          <span className="text-primary text-lg leading-none">+</span>
        </span>
        <span className="text-muted-foreground text-sm">Add Driver</span>
      </button>
    );
  }

  const stripeColor = getDriverColor(driver.abbreviation);

  return (
    <div
      className={cn(
        'flex min-h-[72px] items-stretch overflow-hidden rounded-md border',
        isCaptain && 'border-yellow-500',
      )}
    >
      <div
        className={cn('w-2 shrink-0', !stripeColor && 'bg-border')}
        style={stripeColor ? { backgroundColor: stripeColor } : undefined}
        aria-hidden
      />
      <div className="flex min-w-0 flex-1 flex-col justify-center px-3 py-3">
        <span className="text-sm leading-tight font-bold">
          {driver.firstName} {driver.lastName}
        </span>
        <span className="text-muted-foreground text-sm font-medium">
          ${formatMillions(driver.price)}M
        </span>
      </div>
      {!readOnly && (
        <div className="flex flex-col items-center justify-center gap-1 px-2">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 rounded-full"
            aria-label="Remove driver"
            onClick={onRemove}
          >
            <X className="h-4 w-4" />
          </Button>
          {onSetCaptain && (
            <Button
              size="icon"
              variant="ghost"
              className="group h-7 w-7 p-0 [perspective:600px]"
              aria-label={
                isCaptain
                  ? 'Captain — 2× points (active)'
                  : `Set ${driver.firstName} ${driver.lastName} as captain`
              }
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
                  2×
                </span>
              </span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
