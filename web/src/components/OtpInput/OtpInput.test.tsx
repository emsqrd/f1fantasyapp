import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { OtpInput } from './OtpInput';

function Controlled({
  initialValue = '',
  onChange,
  ...rest
}: {
  initialValue?: string;
  onChange?: (v: string) => void;
} & Omit<React.ComponentProps<typeof OtpInput>, 'value' | 'onChange'>) {
  const [value, setValue] = useState(initialValue);
  return (
    <OtpInput
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
      aria-label="Confirmation code"
      {...rest}
    />
  );
}

describe('OtpInput', () => {
  it('forwards inputmode, maxlength, and autocomplete to the underlying input', () => {
    render(<Controlled />);
    const input = screen.getByLabelText('Confirmation code');
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).toHaveAttribute('maxlength', '6');
    expect(input).toHaveAttribute('autocomplete', 'one-time-code');
  });

  it('updates value via onChange and filters non-digits while typing', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const input = screen.getByLabelText('Confirmation code');

    await user.type(input, '12ab34');

    expect(onChange).toHaveBeenLastCalledWith('1234');
  });

  it('handles paste by stripping non-digits and slicing to length in one onChange call', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const input = screen.getByLabelText('Confirmation code');

    input.focus();
    await user.paste('abc123456xyz');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('123456');
  });

  it('removes the last digit on backspace', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const input = screen.getByLabelText('Confirmation code');

    await user.type(input, '12345');
    onChange.mockClear();
    await user.type(input, '{Backspace}');

    expect(onChange).toHaveBeenLastCalledWith('1234');
  });

  it('fires onComplete when the value is filled by typing the final digit', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<Controlled onComplete={onComplete} />);
    const input = screen.getByLabelText('Confirmation code');

    await user.type(input, '12345');
    expect(onComplete).not.toHaveBeenCalled();
    await user.type(input, '6');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('fires onComplete when paste fills the value', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<Controlled onComplete={onComplete} />);
    const input = screen.getByLabelText('Confirmation code');

    input.focus();
    await user.paste('123456');

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('prevents typing when disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<OtpInput value="" onChange={onChange} disabled aria-label="otp" />);
    const input = screen.getByLabelText('otp');

    await user.type(input, '123');

    expect(onChange).not.toHaveBeenCalled();
  });
});
