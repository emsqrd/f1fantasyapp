import { render, screen } from '@testing-library/react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { FormField, FormFieldInput, FormFieldSwitch } from './FormField';

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
