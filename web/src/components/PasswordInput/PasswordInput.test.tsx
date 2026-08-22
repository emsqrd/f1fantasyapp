import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { PasswordInput } from './PasswordInput';

const passwordInput = () => screen.getByLabelText('Password');
const toggle = () => screen.getByRole('button', { name: 'Show password' });

describe('PasswordInput', () => {
  it('masks the value until the toggle is activated', async () => {
    const user = userEvent.setup();
    render(<PasswordInput aria-label="Password" />);

    expect(passwordInput()).toHaveAttribute('type', 'password');
    expect(toggle()).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle());

    expect(passwordInput()).toHaveAttribute('type', 'text');
    expect(toggle()).toHaveAttribute('aria-pressed', 'true');

    await user.click(toggle());

    expect(passwordInput()).toHaveAttribute('type', 'password');
    expect(toggle()).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles when activated from the keyboard', async () => {
    const user = userEvent.setup();
    render(<PasswordInput aria-label="Password" />);

    toggle().focus();
    await user.keyboard('{Enter}');

    expect(passwordInput()).toHaveAttribute('type', 'text');
  });

  it('does not submit the surrounding form when toggled', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <PasswordInput aria-label="Password" />
        <button type="submit">Sign In</button>
      </form>,
    );

    await user.click(toggle());

    expect(onSubmit).not.toHaveBeenCalled();
    expect(passwordInput()).toHaveAttribute('type', 'text');
  });

  it('forwards the ref and registration props to the underlying control', async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLInputElement>();
    render(
      <PasswordInput aria-label="Password" id="password" name="password" required ref={ref} />,
    );

    await user.type(passwordInput(), 'secret');

    expect(ref.current).toBe(passwordInput());
    expect(passwordInput()).toHaveValue('secret');
    expect(passwordInput()).toHaveAttribute('name', 'password');
    expect(passwordInput()).toBeRequired();
  });
});
