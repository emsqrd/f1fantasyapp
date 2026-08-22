import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Eye, EyeOff } from 'lucide-react';
import { type ComponentProps, useState } from 'react';

type PasswordInputProps = Omit<ComponentProps<typeof Input>, 'type'>;

export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const ToggleIcon = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      <Input type={visible ? 'text' : 'password'} className={cn('pr-9', className)} {...props} />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Show password"
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
        className="text-muted-foreground hover:text-foreground absolute top-0 right-0 hover:bg-transparent"
      >
        <ToggleIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}
