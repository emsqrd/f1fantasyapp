import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMillions(value: number): string {
  return (value / 1_000_000).toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export function formatBudget(value: number): string {
  if (value < 1_000_000) {
    return `$${Math.round(value / 1_000)}k`;
  }
  return `$${formatMillions(value)}M`;
}
