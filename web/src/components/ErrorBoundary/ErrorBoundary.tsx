import * as Sentry from '@sentry/react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

import { ErrorFallback } from './ErrorFallback';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  level?: 'page' | 'section';
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Catches React rendering errors and displays fallback UI
export class ErrorBoundary extends Component<Props, State> {
  // Initialize component state
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  // Update state when a child component throws an error
  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  // Log error details to Sentry for monitoring
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
    this.props.onReset?.();
  };

  // Render fallback UI if error occurred, otherwise render children
  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Use default ErrorFallback component
      return (
        <ErrorFallback
          error={this.state.error}
          onReset={this.handleReset}
          level={this.props.level}
        />
      );
    }

    return this.props.children;
  }
}
