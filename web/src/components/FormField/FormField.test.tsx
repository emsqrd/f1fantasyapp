import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { FormField, FormFieldInput, FormFieldPassword, FormFieldSwitch } from './FormField';

function stubRegister(name: string): UseFormRegisterReturn {
  return { name, onChange: vi.fn(), onBlur: vi.fn(), ref: vi.fn() };
}

function describedElements(control: HTMLElement) {
  const tokens = control.getAttribute('aria-describedby')?.split(' ') ?? [];
  return tokens.map((token) => document.getElementById(token));
}

describe('FormField', () => {
  it('renders help text before the error when both are present', () => {
    render(
      <FormField label="Test Label" id="test" error="Error message" helpText="Help text">
        <input id="test" />
      </FormField>,
    );

    const help = screen.getByText('Help text');
    const error = screen.getByText('Error message');

    expect(help.compareDocumentPosition(error)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('renders the label action after the label', () => {
    render(
      <FormField label="Password" id="password" labelAction={<a href="/reset">Forgot?</a>}>
        <input id="password" />
      </FormField>,
    );

    const label = screen.getByText('Password');
    const action = screen.getByRole('link', { name: 'Forgot?' });

    expect(label.compareDocumentPosition(action)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  describe('FormFieldInput', () => {
    it('describes the input by the help text alone when valid', () => {
      render(
        <FormFieldInput
          label="Password"
          id="password"
          helpText="Password must be at least 8 characters"
          register={stubRegister('password')}
        />,
      );

      const input = screen.getByLabelText('Password');
      expect(describedElements(input).map((el) => el?.textContent)).toEqual([
        'Password must be at least 8 characters',
      ]);
      expect(input).toHaveAttribute('aria-invalid', 'false');
    });

    it('describes the input by the error alone when there is no help text', () => {
      render(
        <FormFieldInput
          label="Email"
          id="email"
          error="Enter your email"
          register={stubRegister('email')}
        />,
      );

      expect(
        describedElements(screen.getByLabelText('Email')).map((el) => el?.textContent),
      ).toEqual(['Enter your email']);
    });

    it('describes the input by both help text and error when invalid', () => {
      render(
        <FormFieldInput
          label="Password"
          id="password"
          error="Password is too short"
          helpText="Password must be at least 8 characters"
          register={stubRegister('password')}
        />,
      );

      const input = screen.getByLabelText('Password');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(describedElements(input).map((el) => el?.textContent)).toEqual([
        'Password must be at least 8 characters',
        'Password is too short',
      ]);
      expect(screen.getByRole('alert')).toHaveTextContent('Password is too short');
    });

    it('omits aria-describedby when there is nothing to describe', () => {
      render(<FormFieldInput label="Email" id="email" register={stubRegister('email')} />);

      expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-describedby');
    });
  });

  describe('FormFieldPassword', () => {
    const passwordInput = () => screen.getByLabelText('Password');
    const toggle = () => screen.getByRole('button', { name: 'Show password' });

    it('masks the value until the reveal toggle is activated', async () => {
      const user = userEvent.setup();
      render(
        <FormFieldPassword label="Password" id="password" register={stubRegister('password')} />,
      );

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
      render(
        <FormFieldPassword label="Password" id="password" register={stubRegister('password')} />,
      );

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
          <FormFieldPassword label="Password" id="password" register={stubRegister('password')} />
          <button type="submit">Sign In</button>
        </form>,
      );

      await user.click(toggle());

      expect(onSubmit).not.toHaveBeenCalled();
      expect(passwordInput()).toHaveAttribute('type', 'text');
    });

    it('describes the password input by both help text and error when invalid', () => {
      render(
        <FormFieldPassword
          label="Password"
          id="password"
          error="Password is too short"
          helpText="Password must be at least 8 characters"
          register={stubRegister('password')}
        />,
      );

      const input = screen.getByLabelText('Password');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(describedElements(input).map((el) => el?.textContent)).toEqual([
        'Password must be at least 8 characters',
        'Password is too short',
      ]);
      expect(screen.getByRole('alert')).toHaveTextContent('Password is too short');
    });
  });

  describe('FormFieldSwitch', () => {
    it('describes the switch by both help text and error when invalid', () => {
      render(
        <FormFieldSwitch
          label="Private"
          id="private"
          checked={false}
          onCheckedChange={vi.fn()}
          error="Switch error message"
          helpText="Only invited members can join"
        />,
      );

      expect(
        describedElements(screen.getByRole('switch', { name: /private/i })).map(
          (el) => el?.textContent,
        ),
      ).toEqual(['Only invited members can join', 'Switch error message']);
    });
  });
});
