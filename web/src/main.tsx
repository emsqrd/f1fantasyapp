import { Toaster } from '@/components/ui/sonner';
import * as Sentry from '@sentry/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { InnerApp } from './InnerApp.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { TeamProvider } from './contexts/TeamContext.tsx';
import './index.css';
import { router } from './router.tsx';

// Initialize Sentry for error tracking and performance monitoring
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    Sentry.tanstackRouterBrowserTracingIntegration(router),
    // Conditional integrations based on environment
    ...(import.meta.env.DEV
      ? [
          // Development: Use Spotlight for local debugging
          Sentry.spotlightBrowserIntegration(),
          Sentry.captureConsoleIntegration({
            levels: ['log', 'info', 'warn', 'error', 'debug'],
          }),
        ]
      : [
          // Production: Enable Session Replay to capture user sessions
          Sentry.replayIntegration({
            maskAllText: false,
            blockAllMedia: false,
          }),
        ]),
  ],

  // Performance Monitoring - Higher sample rate in dev for testing, lower in prod
  tracesSampleRate: import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE
    ? parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE)
    : import.meta.env.DEV
      ? 1.0
      : 0.1, // Dev: 100%, Prod: 10%

  // Set tracePropagationTargets to control distributed tracing between frontend and backend
  tracePropagationTargets: ['localhost', import.meta.env.VITE_F1_FANTASY_API].filter(Boolean),

  // Session Replay - Higher sample rate in dev, lower in prod
  replaysSessionSampleRate: import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE
    ? parseFloat(import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE)
    : import.meta.env.DEV
      ? 1.0
      : 0.1, // Dev: 100%, Prod: 10%

  environment: import.meta.env.MODE,

  // Only enable in production or when DSN is configured
  enabled: !!import.meta.env.VITE_SENTRY_DSN,

  // Enable structured logs in production (dev uses Spotlight with console integration)
  enableLogs: import.meta.env.PROD,
});

const container = document.getElementById('root');
if (!container) throw new Error('Root container not found');

const root = createRoot(container, {
  onUncaughtError: Sentry.reactErrorHandler(),
  onCaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
});

root.render(
  <StrictMode>
    <Toaster position="top-center" />
    <AuthProvider>
      <TeamProvider>
        <InnerApp />
      </TeamProvider>
    </AuthProvider>
  </StrictMode>,
);
