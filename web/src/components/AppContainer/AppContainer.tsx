import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface AppContainerProps {
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
}

export function AppContainer({ children, maxWidth = 'lg', className }: AppContainerProps) {
  return (
    <div
      className={cn(
        'container mx-auto px-4 sm:px-5 lg:px-8',
        maxWidth === 'sm' && 'max-w-2xl',
        maxWidth === 'md' && 'max-w-4xl',
        maxWidth === 'lg' && 'max-w-6xl',
        maxWidth === 'xl' && 'max-w-7xl',
        className,
      )}
    >
      {children}
    </div>
  );
}
