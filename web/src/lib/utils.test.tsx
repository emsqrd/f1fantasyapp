import { describe, expect, it } from 'vitest';

import { cn, formatBudget, formatMillions } from './utils';

describe('utils', () => {
  describe('cn', () => {
    it('resolves conditional inputs through clsx and tailwind conflicts through twMerge', () => {
      const result = cn('base', { active: true, hidden: false }, 'text-red-500', 'text-blue-500');
      expect(result).toBe('base active text-blue-500');
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

  describe('formatBudget', () => {
    it('formats values >= 1M with M suffix', () => {
      expect(formatBudget(100_000_000)).toBe('$100.0M');
      expect(formatBudget(18_600_000)).toBe('$18.6M');
      expect(formatBudget(1_000_000)).toBe('$1.0M');
    });

    it('formats values < 1M in thousands with k suffix', () => {
      expect(formatBudget(900_000)).toBe('$900k');
      expect(formatBudget(500_000)).toBe('$500k');
      expect(formatBudget(100_000)).toBe('$100k');
    });

    it('rounds thousands to nearest whole number', () => {
      expect(formatBudget(950_500)).toBe('$951k');
      expect(formatBudget(199_499)).toBe('$199k');
    });

    it('formats zero as $0k', () => {
      expect(formatBudget(0)).toBe('$0k');
    });
  });
});
