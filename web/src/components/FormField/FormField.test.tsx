import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FormField, FormFieldSwitch } from './FormField';

describe('FormField', () => {
  describe('Error and Help Text Display', () => {
    it('displays error message when error is provided', () => {
      render(
        <FormField label="Test Label" id="test" error="This field has an error">
          <input id="test" />
        </FormField>,
      );

      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toHaveTextContent('This field has an error');
    });

    it('displays help text when no error is present', () => {
      render(
        <FormField label="Test Label" id="test" helpText="This is helpful information">
          <input id="test" />
        </FormField>,
      );

      expect(screen.getByText('This is helpful information')).toBeInTheDocument();
    });

    it('hides help text when error is present', () => {
      render(
        <FormField
          label="Test Label"
          id="test"
          error="Error message"
          helpText="Help text should be hidden"
        >
          <input id="test" />
        </FormField>,
      );

      expect(screen.queryByText('Help text should be hidden')).not.toBeInTheDocument();
      expect(screen.getByText('Error message')).toBeInTheDocument();
    });
  });

  describe('FormFieldSwitch', () => {
    it('calls onCheckedChange when switch is toggled', () => {
      const handleChange = vi.fn();

      render(
        <FormFieldSwitch
          label="Private"
          id="private"
          checked={false}
          onCheckedChange={handleChange}
        />,
      );

      const switchElement = screen.getByRole('switch', { name: /private/i });
      switchElement.click();

      expect(handleChange).toHaveBeenCalledWith(true);
    });

    it('displays error message when error is provided', () => {
      const handleChange = vi.fn();

      render(
        <FormFieldSwitch
          label="Private"
          id="private"
          checked={false}
          onCheckedChange={handleChange}
          error="Switch error message"
        />,
      );

      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toHaveTextContent('Switch error message');
    });
  });
});
