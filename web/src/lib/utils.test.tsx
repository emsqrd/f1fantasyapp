import { describe, expect, it } from 'vitest';

import { cn, formatMillions } from './utils';

describe('utils', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      const result = cn('class1', 'class2');
      expect(result).toBe('class1 class2');
    });

    it('should handle conditional class names', () => {
      const result = cn('base', true && 'conditional', false && 'hidden');
      expect(result).toBe('base conditional');
    });

    it('should handle undefined and null values', () => {
      const result = cn('base', undefined, null, 'valid');
      expect(result).toBe('base valid');
    });

    it('should handle empty strings', () => {
      const result = cn('base', '', 'valid');
      expect(result).toBe('base valid');
    });

    it('should handle arrays of class names', () => {
      const result = cn(['class1', 'class2'], 'class3');
      expect(result).toBe('class1 class2 class3');
    });

    it('should handle objects with boolean values', () => {
      const result = cn({
        active: true,
        disabled: false,
        'text-red-500': true,
      });
      expect(result).toBe('active text-red-500');
    });

    it('should merge tailwind classes and resolve conflicts', () => {
      // Test that twMerge functionality works - later classes should override earlier ones
      const result = cn('text-red-500', 'text-blue-500');
      expect(result).toBe('text-blue-500');
    });

    it('should handle complex combinations of inputs', () => {
      const result = cn(
        'base-class',
        { active: true, disabled: false },
        ['array-class1', 'array-class2'],
        undefined,
        'final-class',
      );
      expect(result).toBe('base-class active array-class1 array-class2 final-class');
    });

    it('should return empty string when no valid classes provided', () => {
      const result = cn(undefined, null, false, '');
      expect(result).toBe('');
    });

    it('should handle nested arrays and objects', () => {
      const result = cn(['base', { conditional: true }, ['nested', 'array']]);
      expect(result).toBe('base conditional nested array');
    });
  });

  describe('formatMillions', () => {
    it('should format whole millions correctly', () => {
      expect(formatMillions(1_000_000)).toBe('1.0');
      expect(formatMillions(5_000_000)).toBe('5.0');
      expect(formatMillions(10_000_000)).toBe('10.0');
    });

    it('should format fractional millions with one decimal place', () => {
      expect(formatMillions(1_500_000)).toBe('1.5');
      expect(formatMillions(2_250_000)).toBe('2.3'); // Rounded to 1 decimal
      expect(formatMillions(7_750_000)).toBe('7.8'); // Rounded to 1 decimal
    });

    it('should handle numbers less than one million', () => {
      expect(formatMillions(500_000)).toBe('0.5');
      expect(formatMillions(100_000)).toBe('0.1');
      expect(formatMillions(50_000)).toBe('0.1'); // Rounded up
    });

    it('should handle zero', () => {
      expect(formatMillions(0)).toBe('0.0');
    });

    it('should handle negative numbers', () => {
      expect(formatMillions(-1_000_000)).toBe('-1.0');
      expect(formatMillions(-2_500_000)).toBe('-2.5');
    });

    it('should handle very large numbers', () => {
      expect(formatMillions(1_000_000_000)).toBe('1,000.0');
      expect(formatMillions(50_000_000_000)).toBe('50,000.0');
    });

    it('should handle floating point numbers', () => {
      expect(formatMillions(1_234_567.89)).toBe('1.2');
      expect(formatMillions(9_876_543.21)).toBe('9.9');
    });

    it('should handle very small positive numbers', () => {
      expect(formatMillions(1_000)).toBe('0.0');
      expect(formatMillions(999)).toBe('0.0');
    });

    it('should maintain consistent decimal formatting', () => {
      // Test that it always shows one decimal place
      const results = [
        formatMillions(1_000_000),
        formatMillions(2_000_000),
        formatMillions(3_500_000),
      ];

      results.forEach((result) => {
        expect(result).toMatch(/^\d{1,3}(,\d{3})*\.\d$/);
      });
    });

    it('should handle edge cases near rounding boundaries', () => {
      // Test numbers that are close to rounding boundaries
      expect(formatMillions(1_049_999)).toBe('1.0'); // Should round down
      expect(formatMillions(1_050_000)).toBe('1.1'); // Should round up
      expect(formatMillions(1_950_000)).toBe('2.0'); // Should round up
    });

    it('should use locale-specific formatting', () => {
      // The function uses toLocaleString with undefined locale
      // This should use the system default locale
      const result = formatMillions(1_234_000_000);

      // Result should contain proper thousands separators
      expect(result).toMatch(/^1,234\.0$/);
    });

    it('should handle numbers with many decimal places in input', () => {
      expect(formatMillions(1_234_567.123456789)).toBe('1.2');
      expect(formatMillions(9_876_543.987654321)).toBe('9.9');
    });
  });
});
