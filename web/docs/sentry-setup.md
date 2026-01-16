# Sentry Integration Guide

This guide explains how Sentry is configured in the F1 Fantasy Sports React app for error tracking, performance monitoring, and session replay.

## Overview

Sentry provides:

- **Error Tracking**: Real-time error reporting with stack traces
- **Performance Monitoring**: Track slow components and API calls
- **Session Replay**: Video-like reproductions of user sessions when errors occur
- **Contextual Data**: User info, component state, and custom tags with errors

## Setup Instructions

### 1. Create a Sentry Project

1. Sign up at [sentry.io](https://sentry.io)
2. Create a new project and select "React" as the platform
3. Copy your DSN (Data Source Name) from the project settings

### 2. Configure Environment Variables

Add your Sentry DSN to `.env`:

```bash
# Runtime Configuration (required)
VITE_SENTRY_DSN=https://your-key@o123456.ingest.sentry.io/123456

# Build-time Configuration (optional - for source map uploads)
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug
SENTRY_AUTH_TOKEN=your-auth-token
```

**Important**: Never commit `.env` with real credentials. Use `.env.local` for local development or environment variables in your CI/CD pipeline.

### 3. Generate Auth Token (Optional - for Source Maps)

For production source map uploads:

1. Go to Settings → Auth Tokens in Sentry
2. Create a new token with `project:releases` and `org:read` scopes
3. Add the token to your environment variables

## Features Enabled

### Error Tracking

All `console.error()` calls have been replaced with `Sentry.captureException()` to capture:

- League loading failures
- Team data fetch errors
- User profile errors
- Avatar upload failures
- Authentication errors

**Example**:

```typescript
catch (error) {
  Sentry.captureException(error, {
    contexts: {
      league: { id: params.leagueId },
    },
  });
  setError('Failed to load league');
}
```

### Performance Monitoring

Tracks:

- Component render times
- API call durations
- Page load performance
- Route transitions

**Sample Rate**: 10% in production, 100% in development

### Session Replay

Records user sessions when errors occur:

- 10% of all sessions recorded
- 100% of sessions with errors recorded
- Text and media not masked (adjust in `main.tsx` if needed)

## Monitoring in Production

### Viewing Errors

1. Go to Issues → All Issues in Sentry dashboard
2. Click on any error to see:
   - Stack trace with source maps
   - User context (browser, OS, network)
   - Custom context (league ID, team ID, etc.)
   - Breadcrumbs (user actions before error)

### Performance Insights

1. Go to Performance → Transactions
2. View slowest routes and API calls
3. Set up alerts for performance regressions

### Session Replays

1. Go to Issues → click an error
2. Click "Replays" tab to watch user session
3. See exactly what user did before error occurred

## Best Practices

### Adding Context to Errors

Always add relevant context when capturing exceptions:

```typescript
Sentry.captureException(error, {
  contexts: {
    component: { name: 'LeagueList' },
    league: { id: leagueId, name: leagueName },
  },
  tags: {
    feature: 'leagues',
  },
});
```

### Setting User Context

User context is automatically set when users authenticate:

```typescript
Sentry.setUser({
  id: user.id,
  email: user.email,
});
```

### Filtering Sensitive Data

Adjust in `main.tsx`:

```typescript
Sentry.init({
  // ...
  beforeSend(event) {
    // Remove sensitive data
    if (event.request?.cookies) {
      delete event.request.cookies;
    }
    return event;
  },
});
```

## Development Mode

Sentry is disabled in development by default (when `VITE_SENTRY_DSN` is empty). To test Sentry locally:

1. Add your DSN to `.env`
2. Trigger an error in the app
3. Check Sentry dashboard for the error

## Troubleshooting

### Source Maps Not Uploading

**Solution**: Verify your `SENTRY_AUTH_TOKEN` has correct permissions and is set in your CI/CD environment.

### Too Many Errors

**Solution**: Adjust sample rates in `main.tsx`:

```typescript
tracesSampleRate: 0.05, // Reduce to 5%
replaysSessionSampleRate: 0.05, // Reduce to 5%
```

### PII/Sensitive Data Leaking

**Solution**: Enable text masking in session replay:

```typescript
Sentry.replayIntegration({
  maskAllText: true,
  blockAllMedia: true,
});
```

## Cost Management

### Free Tier Limits

- 5,000 errors/month
- 500 session replays/month

### Optimization Tips

1. Lower sample rates in high-traffic periods
2. Use release filters to exclude dev/staging errors
3. Set up error grouping rules to reduce duplicate issues
4. Use inbound filters to ignore known errors (e.g., browser extensions)

## Next Steps

1. Set up email/Slack alerts for critical errors
2. Configure release tracking for better version visibility
3. Create custom dashboards for key metrics
4. Set up performance budgets and alerts

## References

- [Sentry React Docs](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Sentry Vite Plugin](https://github.com/getsentry/sentry-javascript-bundler-plugins/tree/main/packages/vite-plugin)
- [Performance Monitoring](https://docs.sentry.io/product/performance/)
- [Session Replay](https://docs.sentry.io/product/session-replay/)
