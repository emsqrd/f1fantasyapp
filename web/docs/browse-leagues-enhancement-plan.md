# Browse Leagues Component Enhancement Plan

## Overview
Enhance the BrowseLeagues component to provide comprehensive league information and a seamless join experience with optimal UI/UX.

## Goals
- Display league capacity (member count)
- Show public/private indicators
- Add join functionality with confirmation
- Provide clear user feedback for all actions
- Maintain WCAG 2.1 Level AA accessibility compliance

## Prerequisites

### 1. Install AlertDialog Component
```bash
npx shadcn@latest add alert-dialog
```

This component provides accessible confirmation dialogs following best practices from shadcn/ui.

### 2. Required Dependencies
All other dependencies are already available:
- ✅ `Badge` component (`src/components/ui/badge.tsx`)
- ✅ `LoadingButton` component (`src/components/LoadingButton/LoadingButton.tsx`)
- ✅ `InlineSuccess` component (`src/components/InlineSuccess/InlineSuccess.tsx`)
- ✅ `InlineError` component (`src/components/InlineError/InlineError.tsx`)
- ✅ `Card` component (`src/components/ui/card.tsx`)
- ✅ `joinLeague` service (`src/services/leagueService.ts`)
- ✅ `useLiveRegion` hook (`src/hooks/useLiveRegion.ts`)

## Component Features

### 1. League Information Display

**League Card Layout:**
```
┌──────────────────────────────────────────────────┐
│ League Name                    [Public Badge]    │
│ Description text here...                         │
│                                                   │
│ 👥 12 members                      [Join League] │
│ [Success/Error Message Area]                     │
└──────────────────────────────────────────────────┘
```

**Data Points:**
- **League Name**: Primary heading with large, semibold text
- **Public/Private Badge**: Visual indicator with icon
  - Public: `outline` variant with `Globe` icon
  - Private: `secondary` variant with `Lock` icon
- **Description**: League description text
- **Member Count**: Display `league.teams.length` with `Users` icon
- **Join Button**: `LoadingButton` that triggers confirmation dialog

### 2. Join Workflow

**User Flow:**
```
Click "Join" → AlertDialog Opens →
Confirm Action → Loading State →
API Call → Success/Error Feedback →
Update UI
```

**States to Manage:**
- `joiningLeagueId: number | null` - Tracks which league is being joined
- `successLeagueId: number | null` - Tracks successful join for success message
- `errorMessage: string | null` - Stores error messages
- Screen reader announcements via `useLiveRegion` hook

### 3. Confirmation Dialog (AlertDialog)

**Dialog Structure:**
- **Title**: "Join [League Name]?"
- **Description**: Clear explanation of what joining means
- **Actions**:
  - Cancel button (secondary)
  - Confirm button (primary)
- **Accessibility**: Built-in focus management and keyboard navigation

### 4. Success/Error Feedback

**Success State:**
- Green `InlineSuccess` component appears below join button
- Auto-dismisses after 5 seconds
- Message: "Successfully joined [League Name]!"
- Screen reader announcement via LiveRegion

**Error State:**
- Red `InlineError` component appears below join button
- Persists until user retries or dismisses
- Message: "Failed to join league. Please try again."
- Sentry logging for debugging

### 5. Loading States

**During Join Operation:**
- Join button shows loading spinner and "Joining..." text
- Button uses `aria-busy="true"` (not disabled) for accessibility
- Prevents multiple simultaneous join attempts

## Accessibility Features

Following WCAG 2.1 Level AA standards:

1. **Keyboard Navigation**
   - Tab through all interactive elements
   - Enter/Space to activate buttons
   - Escape to close dialog

2. **Screen Reader Support**
   - AlertDialog announces when opened
   - InlineSuccess uses `role="status"` for polite announcements
   - InlineError uses `role="alert"` for immediate announcements
   - LiveRegion for async operation feedback
   - Badges include accessible text with icons

3. **Focus Management**
   - AlertDialog automatically focuses on close button when opened
   - Focus returns to trigger button when closed
   - LoadingButton maintains focus during loading state

4. **ARIA Attributes**
   - `aria-busy` on loading button
   - `aria-label` for contextual button descriptions
   - `aria-hidden` on decorative icons

### Understanding LiveRegion

**What is LiveRegion?**

LiveRegion is an accessibility component that announces dynamic content changes to screen reader users. It solves a critical accessibility problem: when content changes dynamically (like showing a success or error message), sighted users see the change, but screen reader users might miss it because they're not actively reading that part of the page.

**How It Works:**

LiveRegion creates an invisible "announcement zone" using ARIA attributes:

```tsx
<div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
  {message}
</div>
```

Key attributes:
- `aria-live="polite"` - Screen reader announces when user pauses (doesn't interrupt current reading)
- `role="status"` - Identifies this as a status message
- `aria-atomic="true"` - Reads entire message, not just changes
- `className="sr-only"` - **Visually hidden** but accessible to screen readers

**Usage Pattern in BrowseLeagues:**

```tsx
// 1. Get announcement function from hook
const { message, announce } = useLiveRegion();

// 2. Render invisible LiveRegion component
<LiveRegion message={message} />

// 3. Announce messages when events occur
try {
  await joinLeague(league.id);
  announce('Successfully joined the league!'); // Screen reader speaks this
} catch (error) {
  announce(error.message); // Screen reader speaks the error
}
```

**Why Both InlineError/InlineSuccess AND LiveRegion?**

These components work together to provide **complete accessibility**:

- **Visual Feedback**: InlineError (red box) and InlineSuccess (green box) for sighted users
- **Auditory Feedback**: LiveRegion announcements for screen reader users
- **Result**: Both user groups get the same information through different modalities

**WCAG Compliance:**

LiveRegion helps meet **WCAG 2.1 Level AA Success Criterion 4.1.3 (Status Messages)**:
> Status messages can be programmatically determined through role or properties so they can be presented to the user by assistive technologies without receiving focus.

This ensures equal access for users with visual impairments by making dynamic content changes programmatically announced rather than requiring users to manually discover them.

## Visual Design

### Colors & Variants
- **Public Badge**: `outline` variant - neutral, open feeling
- **Private Badge**: `secondary` variant - subtle distinction
- **Join Button**: `default` variant - primary action color
- **Success**: Green background (`bg-green-500/10`) with green text
- **Error**: Red background with red text

### Icons (lucide-react)
- `Globe` - Public leagues
- `Lock` - Private leagues
- `Users` - Member count
- `Loader2` - Loading spinner (in LoadingButton)
- `CheckCircle` - Success message (in InlineSuccess)

### Spacing & Layout
- Card padding: `p-6` (24px)
- Gap between elements: `gap-3` (12px)
- Mobile-responsive with stacked layout

## Error Handling

### Scenarios to Handle
1. **Network Failure**: Show generic error message
2. **Already Joined**: "You're already a member of this league"
3. **League Full**: "This league has reached capacity"
4. **Unauthorized**: Redirect to sign-in (handled by API client)

### Sentry Integration
```typescript
Sentry.logger.error('Failed to join league', {
  leagueId,
  leagueName,
  error,
});
```

## Testing Strategy

Following the project's testing philosophy (test behavior, not implementation):

### User Interactions to Test
1. ✅ Public/private badges display correctly based on `isPrivate` field
2. ✅ Member count shows correct number from `league.teams.length`
3. ✅ Join button opens confirmation dialog
4. ✅ User can cancel join action
5. ✅ User can confirm join action
6. ✅ Loading state displays during async operation
7. ✅ Success message appears after successful join
8. ✅ Error message appears after failed join
9. ✅ Keyboard navigation works correctly
10. ✅ Screen reader announcements work

### Mock Requirements
- Mock `useLoaderData` from TanStack Router
- Mock `joinLeague` service function
- Mock `useLiveRegion` hook
- Test with various league data states (empty, full, error)

## Implementation Checklist

- [ ] Install alert-dialog component via shadcn CLI
- [ ] Add lucide-react icons (Globe, Lock, Users)
- [ ] Implement state management for join operations
- [ ] Create AlertDialog confirmation flow
- [ ] Add success/error feedback UI
- [ ] Integrate LiveRegion for announcements
- [ ] Handle all error scenarios
- [ ] Add Sentry logging
- [ ] Write comprehensive tests
- [ ] Verify WCAG 2.1 Level AA compliance
- [ ] Test keyboard navigation
- [ ] Test screen reader experience (VoiceOver)
- [ ] Mobile responsive testing

## Future Enhancements (Out of Scope)

- Search/filter functionality for leagues
- Sort by member count, name, or date created
- League capacity limits and full state indicators
- Preview league members before joining
- League images/avatars
- Pagination for large league lists
- Leave league functionality

## References

- **shadcn/ui AlertDialog**: Context7 documentation (used for confirmation pattern)
- **React Best Practices**: Context7 documentation (used for async state management)
- **Project CLAUDE.md**: Architecture patterns, accessibility standards, testing philosophy
- **Existing Components**: CreateLeague.tsx (dialog pattern reference)
