import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AppContainer } from './AppContainer';

// Mock the cn utility to isolate component testing
vi.mock('@/lib/utils', () => ({
  cn: vi.fn((...args) => args.filter(Boolean).join(' ')),
}));

describe('AppContainer', () => {
  it('should render children content', () => {
    render(
      <AppContainer>
        <div data-testid="child-content">Test Content</div>
      </AppContainer>,
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should apply default maxWidth classes when no maxWidth prop is provided', () => {
    render(
      <AppContainer>
        <div>Content</div>
      </AppContainer>,
    );

    const container = screen.getByText('Content').parentElement;
    expect(container).toHaveClass('container mx-auto px-4 sm:px-5 lg:px-8');
    expect(container).toHaveClass('max-w-6xl'); // lg is default
  });

  describe('maxWidth variants', () => {
    it('should apply correct classes for sm maxWidth', () => {
      render(
        <AppContainer maxWidth="sm">
          <div>Content</div>
        </AppContainer>,
      );

      const container = screen.getByText('Content').parentElement;
      expect(container).toHaveClass('max-w-2xl');
    });

    it('should apply correct classes for md maxWidth', () => {
      render(
        <AppContainer maxWidth="md">
          <div>Content</div>
        </AppContainer>,
      );

      const container = screen.getByText('Content').parentElement;
      expect(container).toHaveClass('max-w-4xl');
    });

    it('should apply correct classes for lg maxWidth', () => {
      render(
        <AppContainer maxWidth="lg">
          <div>Content</div>
        </AppContainer>,
      );

      const container = screen.getByText('Content').parentElement;
      expect(container).toHaveClass('max-w-6xl');
    });

    it('should apply correct classes for xl maxWidth', () => {
      render(
        <AppContainer maxWidth="xl">
          <div>Content</div>
        </AppContainer>,
      );

      const container = screen.getByText('Content').parentElement;
      expect(container).toHaveClass('max-w-7xl');
    });

    it('should not apply max-width class for full maxWidth', () => {
      render(
        <AppContainer maxWidth="full">
          <div>Content</div>
        </AppContainer>,
      );

      const container = screen.getByText('Content').parentElement;
      expect(container).not.toHaveClass('max-w-2xl');
      expect(container).not.toHaveClass('max-w-4xl');
      expect(container).not.toHaveClass('max-w-6xl');
      expect(container).not.toHaveClass('max-w-7xl');
    });
  });

  it('should apply custom className when provided', () => {
    render(
      <AppContainer className="custom-class">
        <div>Content</div>
      </AppContainer>,
    );

    const container = screen.getByText('Content').parentElement;
    expect(container).toHaveClass('custom-class');
  });

  it('should combine default classes with custom className', () => {
    render(
      <AppContainer className="custom-class" maxWidth="md">
        <div>Content</div>
      </AppContainer>,
    );

    const container = screen.getByText('Content').parentElement;
    expect(container).toHaveClass('container mx-auto px-4 sm:px-5 lg:px-8');
    expect(container).toHaveClass('max-w-4xl');
    expect(container).toHaveClass('custom-class');
  });

  it('should call cn utility with correct arguments for default props', async () => {
    const { cn } = vi.mocked(await import('@/lib/utils'));

    render(
      <AppContainer>
        <div>Content</div>
      </AppContainer>,
    );

    expect(cn).toHaveBeenCalledWith(
      'container mx-auto px-4 sm:px-5 lg:px-8',
      false, // sm condition
      false, // md condition
      'max-w-6xl', // lg condition (default)
      false, // xl condition
      undefined, // className
    );
  });

  it('should call cn utility with correct arguments when all props are provided', async () => {
    const { cn } = vi.mocked(await import('@/lib/utils'));

    render(
      <AppContainer maxWidth="xl" className="test-class">
        <div>Content</div>
      </AppContainer>,
    );

    expect(cn).toHaveBeenCalledWith(
      'container mx-auto px-4 sm:px-5 lg:px-8',
      false, // sm condition
      false, // md condition
      false, // lg condition
      'max-w-7xl', // xl condition
      'test-class', // className
    );
  });

  describe('multiple children', () => {
    it('should render multiple children correctly', () => {
      render(
        <AppContainer>
          <div data-testid="first-child">First Child</div>
          <div data-testid="second-child">Second Child</div>
          <span data-testid="third-child">Third Child</span>
        </AppContainer>,
      );

      expect(screen.getByTestId('first-child')).toBeInTheDocument();
      expect(screen.getByTestId('second-child')).toBeInTheDocument();
      expect(screen.getByTestId('third-child')).toBeInTheDocument();
    });

    it('should maintain proper DOM structure with multiple children', () => {
      render(
        <AppContainer>
          <header>Header</header>
          <main>Main Content</main>
          <footer>Footer</footer>
        </AppContainer>,
      );

      const container = screen.getByText('Header').parentElement;
      expect(container?.tagName).toBe('DIV');
      expect(container?.children).toHaveLength(3);
    });
  });

  describe('edge cases', () => {
    it('should handle empty className prop', () => {
      render(
        <AppContainer className="">
          <div>Content</div>
        </AppContainer>,
      );

      const container = screen.getByText('Content').parentElement;
      expect(container).toHaveClass('container mx-auto px-4 sm:px-5 lg:px-8');
    });

    it('should handle null children gracefully', () => {
      render(<AppContainer>{null}</AppContainer>);

      // Container should still be rendered with proper classes
      const container = document.querySelector('.container');
      expect(container).toBeInTheDocument();
      expect(container).toHaveClass('container mx-auto px-4 sm:px-5 lg:px-8');
    });

    it('should handle React fragment as children', () => {
      render(
        <AppContainer>
          <>
            <div data-testid="fragment-child-1">Fragment Child 1</div>
            <div data-testid="fragment-child-2">Fragment Child 2</div>
          </>
        </AppContainer>,
      );

      expect(screen.getByTestId('fragment-child-1')).toBeInTheDocument();
      expect(screen.getByTestId('fragment-child-2')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should render as a div with proper semantic structure', () => {
      render(
        <AppContainer>
          <div>Content</div>
        </AppContainer>,
      );

      const container = screen.getByText('Content').parentElement;
      expect(container?.tagName).toBe('DIV');
    });

    it('should preserve accessibility attributes passed through children', () => {
      render(
        <AppContainer>
          <button aria-label="Test Button" data-testid="accessible-button">
            Click Me
          </button>
        </AppContainer>,
      );

      const button = screen.getByTestId('accessible-button');
      expect(button).toHaveAttribute('aria-label', 'Test Button');
    });
  });
});
