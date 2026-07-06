import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AppContainer } from './AppContainer';

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
  });

  describe('edge cases', () => {
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
