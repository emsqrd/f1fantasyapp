import type { Constructor } from '@/contracts/Role';
import { getConstructorColor } from '@/lib/teamColors';
import { cn, formatMillions } from '@/lib/utils';
import { X } from 'lucide-react';

import { Button } from '../ui/button';

interface ConstructorCardProps {
  constructor: Constructor | null;
  onOpenPicker: () => void;
  onRemove: () => void;
  readOnly: boolean;
}

export function ConstructorCard({
  constructor,
  onOpenPicker,
  onRemove,
  readOnly,
}: ConstructorCardProps) {
  if (!constructor) {
    if (readOnly) return null;
    return (
      <button
        onClick={onOpenPicker}
        className="border-border flex min-h-[72px] w-full items-center gap-3 rounded-md border-2 border-dashed px-3 hover:opacity-80"
      >
        <span className="border-border flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-dashed">
          <span className="text-primary text-lg leading-none">+</span>
        </span>
        <span className="text-muted-foreground text-sm">Add Constructor</span>
      </button>
    );
  }

  const stripeColor = getConstructorColor(constructor.abbreviation);

  return (
    <div className="flex min-h-[72px] items-stretch overflow-hidden rounded-md border">
      <div
        className={cn('w-2 shrink-0', !stripeColor && 'bg-border')}
        style={stripeColor ? { backgroundColor: stripeColor } : undefined}
        aria-hidden
      />
      <div className="flex min-w-0 flex-1 flex-col justify-center px-3 py-3">
        <span className="text-sm leading-tight font-bold">{constructor.name}</span>
        <span className="text-muted-foreground text-sm font-medium">
          ${formatMillions(constructor.price)}M
        </span>
      </div>
      {!readOnly && (
        <div className="flex flex-col items-center justify-center px-2">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 rounded-full"
            aria-label="Remove constructor"
            onClick={onRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
