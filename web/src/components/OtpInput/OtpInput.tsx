import { cn } from '@/lib/utils';
import {
  type ChangeEvent,
  type ClipboardEvent,
  type ComponentPropsWithoutRef,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

interface OtpInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  'aria-label'?: string;
  autoComplete?: string;
  inputMode?: ComponentPropsWithoutRef<'input'>['inputMode'];
  className?: string;
  slotClassName?: string;
}

/**
 * Numeric OTP input. One real <input> stacked under a row of slot <div>s via
 * CSS Grid so the input owns paste, SMS autofill (autocomplete="one-time-code"),
 * and screen-reader naming, while the slot row owns visual rendering and click
 * targeting. Not a generic OTP primitive — non-digit filtering and
 * inputMode="numeric" are baked in.
 */
export function OtpInput({
  id,
  value,
  onChange,
  length = 6,
  disabled = false,
  'aria-label': ariaLabel,
  autoComplete = 'one-time-code',
  inputMode = 'numeric',
  className,
  slotClassName,
}: OtpInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  // `selectionchange` is the only DOM event that fires for every selection
  // mutation, including programmatic setSelectionRange that `onSelect` misses.
  useEffect(() => {
    if (!isFocused) return;
    const handler = () => {
      const input = inputRef.current;
      if (input && document.activeElement === input) {
        setSelectionStart(input.selectionStart);
      }
    };
    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, [isFocused]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const sanitized = e.target.value.replace(/\D/g, '').slice(0, length);
    onChange(sanitized);
  };

  // Intercept paste so the input's maxLength can't truncate mixed-character
  // pastes before we strip non-digits (e.g. "abc123456xyz" → "123456").
  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    const sanitized = text.replace(/\D/g, '').slice(0, length);
    onChange(sanitized);
  };

  const handleSlotPointerDown = (e: PointerEvent<HTMLDivElement>, index: number) => {
    if (disabled) return;

    e.preventDefault();

    const input = inputRef.current;

    if (!input) return;

    // Safari requires focus() to land before setSelectionRange.
    input.focus();

    if (index < value.length) {
      input.setSelectionRange(index, index + 1);
      setSelectionStart(index);
    } else {
      const pos = Math.min(index, value.length);
      input.setSelectionRange(pos, pos);
      setSelectionStart(pos);
    }
  };

  function computeActiveIndex(): number | null {
    if (!isFocused) return null;
    if (selectionStart === null) return Math.min(value.length, length - 1);
    if (selectionStart >= length) return length - 1;
    return selectionStart;
  }
  const activeIndex = computeActiveIndex();

  return (
    <div className={cn('grid', className)}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode={inputMode}
        autoComplete={autoComplete}
        maxLength={length}
        value={value}
        onChange={handleChange}
        onPaste={handlePaste}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        disabled={disabled}
        aria-label={ariaLabel}
        className="col-start-1 row-start-1 h-full w-full border-none bg-transparent text-transparent caret-transparent outline-none"
      />
      <div
        aria-hidden="true"
        className={cn(
          'z-10 col-start-1 row-start-1 flex justify-center gap-2.5',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        {Array.from({ length }, (_, i) => {
          const char = value[i] ?? '';
          const isActive = activeIndex === i;
          return (
            <div
              key={i}
              data-slot="otp-slot"
              data-active={isActive ? 'true' : undefined}
              onPointerDown={(e) => handleSlotPointerDown(e, i)}
              className={cn(
                'relative flex h-14 w-12 items-center justify-center rounded-md border font-mono text-2xl font-medium tabular-nums',
                isActive && 'border-primary ring-primary/40 ring-2 ring-inset',
                slotClassName,
              )}
            >
              {char}
              {isActive && !char && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="bg-foreground animate-caret-blink h-4 w-px duration-1000" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
