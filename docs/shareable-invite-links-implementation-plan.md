# Implementation Plan: Shareable Invite Links (MVP)

## Overview

Implement shareable invite URLs that league owners can generate and share. Users can join leagues (including private ones) by clicking these links. This MVP uses a single perpetual invite per league with no expiry or revocation.

## Architectural Decision: LeagueInvite Table

The `LeagueInvite` entity is separated into its own table (vs adding a column to `League`) for future extensibility:

**MVP Benefit:** Clean separation of concerns - invites are a distinct concept from leagues.

**Future Extension:** Supports email invites where one league has multiple invites:

- Shareable link invite (one perpetual token)
- Email invites (one per recipient with tracking)
- Future: SMS invites, time-limited invites, etc.

**Columns ready for post-MVP:**

- `InviteType` (ShareableLink | Email | SMS)
- `RecipientEmail` (nullable - for targeted invites)
- `SentAt` / `UsedAt` / `UsedBy` (tracking)
- `ExpiresAt` / `MaxUses` / `IsRevoked` (management)

**Why not just a League column:** Can't support multiple invites per league or track individual invite metadata.

## Scope

**Included:**

- Single perpetual invite token per league (GetOrCreate pattern)
- Public preview page showing league details before auth
- "Share League" button in Dialog with copy functionality
- Full auth state handling (sign-in redirect, team creation flow)
- Proper backend architecture (exceptions, mappers, service layer)

**Excluded from MVP:**

- Token expiration
- Max usage limits
- Token revocation
- Multiple tokens per league
- Token management UI

## URL Structure & Token Flow

**Generated Invite URL Format:**

```
https://yourapp.com/join/AbC123XyZ789...
                         ^^^^^^^^^^^^^^^
                         Encrypted token
```

**How It Works:**

1. **Backend creates token**: Encrypts `{leagueId}:{Guid}` → URL-safe string (e.g., `AbC123XyZ789`)
2. **Backend returns token**: `InviteTokenResponse.Token` = `AbC123XyZ789`
3. **Frontend builds full URL**: `${window.location.origin}/join/${token}` = `https://yourapp.com/join/AbC123XyZ789`
4. **Owner copies full URL** from Dialog and shares it
5. **Recipient clicks link** → Browser navigates to `/join/AbC123XyZ789`
6. **Frontend extracts token** from URL route parameter (`:token`)
7. **Frontend calls API** with token:
   - `GET /leagues/join/AbC123XyZ789/preview` (shows league info)
   - `POST /leagues/join/AbC123XyZ789` (joins league)
8. **Backend decrypts token** to extract `leagueId` and process request

**Security:** Token is encrypted and tied to specific league, cannot be forged or guessed.

## Current State Analysis

**Method 1 (Direct Join) Status:** ✅ COMPLETE

- Backend: `JoinLeagueAsync`, `/leagues/{id}/join`, exceptions exist
- Frontend: BrowseLeagues with join functionality working

**Method 2 (Private Invite Code) Status:** ⏭️ SKIPPED

- No dependencies on Method 3

**Existing Architecture:**

- Backend: ASP.NET Core with Entity Framework, PostgreSQL, JWT auth via Supabase
- Frontend: React 19, TanStack Router, shadcn/ui components
- Service pattern: Interface-based services with DI, exception-based validation
- Route guards: `requireAuth`, `requireTeam` for protected routes

---

## Phase 1: Backend Implementation

### 1.1 Create LeagueInvite Entity

**File:** `api/F1CompanionApi/Data/Entities/LeagueInvite.cs` (new file)

**Properties:**

- `Id` (int, PK, identity)
- `LeagueId` (int, FK to League, unique indexed) - One token per league
- `Token` (string, unique indexed) - URL-safe encrypted token
- Inherits from `UserOwnedEntity` (CreatedBy, UpdatedBy, DeletedBy, timestamps)

**Relationships:**

- `League` navigation property (one-to-one)
- FK constraint with CASCADE delete (token deleted when league deleted)

### 1.2 Database Migration

**Command:** `dotnet ef migrations add AddLeagueInvite -p F1CompanionApi`

**Changes:**

1. Create `LeagueInvites` table with all columns
2. Add unique index on `Token`
3. Add unique index on `LeagueId` (one invite per league for MVP)
4. Add FK constraints to Leagues and UserProfiles (audit fields)
5. Update `ApplicationDbContext.cs`:
   - Add `DbSet<LeagueInvite> LeagueInvites`
   - Configure relationship in `OnModelCreating`

### 1.3 Create Exception Classes

**File:** `api/F1CompanionApi/Domain/Exceptions/InvalidInviteTokenException.cs` (new)

- Thrown when token is invalid or doesn't exist
- Returns 400 Bad Request

**Update:** `api/F1CompanionApi/Api/GlobalExceptionHandler.cs`

- Add case for `InvalidInviteTokenException` in exception handling switch

### 1.4 Create Request/Response DTOs

**File:** `api/F1CompanionApi/Api/Models/InviteTokenResponse.cs` (new)

```csharp
public class InviteTokenResponse
{
    public required int Id { get; set; }
    public required int LeagueId { get; set; }
    public required string Token { get; set; }
    public required DateTime CreatedAt { get; set; }
    public required string CreatedByName { get; set; }
}
```

**File:** `api/F1CompanionApi/Api/Models/InviteTokenPreviewResponse.cs` (new)

```csharp
public class InviteTokenPreviewResponse
{
    public required string LeagueName { get; set; }
    public string? LeagueDescription { get; set; }
    public required string OwnerName { get; set; }
    public int CurrentTeamCount { get; set; }
    public int MaxTeams { get; set; }
    public bool IsLeagueFull { get; set; }
}
```

### 1.5 Create InviteService

**File:** `api/F1CompanionApi/Domain/Services/InviteService.cs` (new)

**Interface Methods:**

- `GetOrCreateInviteAsync(leagueId, requesterId)` → InviteTokenResponse
- `ValidateAndPreviewInviteAsync(token)` → InviteTokenPreviewResponse
- `JoinLeagueViaInviteAsync(token, userId)` → LeagueResponse

**Implementation Details:**

- Inject `IDataProtectionProvider` for token encryption
- Use `CreateProtector("LeagueInvites")` for purpose separation
- Token generation: Encrypt `{leagueId}:{Guid}` payload, convert to URL-safe Base64
- **GetOrCreate pattern**: Check if token exists for league, return it; otherwise create new
- Authorization: Only league owner can get/create token
- **Private leagues only**: Throws `InvalidOperationException` if league is not private
- Transaction: Wrap join operation for atomicity
- Token decryption: Extract `leagueId` from encrypted token to validate and process requests

**Key Validations:**

- Owner check: `league.OwnerId != requesterId` → UnauthorizedAccessException
- Token validation: Valid encrypted format → InvalidInviteTokenException
- League full: `league.Teams.Count >= league.MaxTeams` → LeagueIsFullException
- Already member: Check existing membership → AlreadyInLeagueException

### 1.6 Update LeagueService

**File:** `api/F1CompanionApi/Domain/Services/LeagueService.cs`

**Modify:** Add `bypassPrivateCheck` parameter to `JoinLeagueAsync`:

```csharp
Task<LeagueResponse> JoinLeagueAsync(int leagueId, int userId, bool bypassPrivateCheck = false);
```

**Logic Change:** Only throw `LeagueIsPrivateException` when `!bypassPrivateCheck && league.IsPrivate`

**Reason:** Invite tokens should allow joining private leagues

### 1.7 Create Mapper

**File:** `api/F1CompanionApi/Api/Mappers/InviteResponseMapper.cs` (new)

**Extension Method:**

```csharp
public static InviteTokenResponse ToResponseModel(this LeagueInvite invite)
{
    // Map all properties from entity to response DTO
    // Include CreatedByUser.GetFullName() for display
}
```

### 1.8 Add API Endpoints

**File:** `api/F1CompanionApi/Api/Endpoints/LeagueEndpoints.cs`

**New Endpoints:**

1. **POST /leagues/{id}/invite** (auth required, owner only)
   - Handler: `GetOrCreateInviteAsync`
   - Returns: 200 OK with `InviteTokenResponse`
   - Gets existing invite or creates new one if none exists

2. **GET /leagues/join/{token}/preview** (PUBLIC - no auth)
   - Handler: `PreviewInviteAsync`
   - Returns: 200 OK with `InviteTokenPreviewResponse`
   - Used by frontend to show league info before requiring sign-in

3. **POST /leagues/join/{token}** (auth required)
   - Handler: `JoinLeagueViaInviteAsync`
   - Returns: 200 OK with `LeagueResponse`
   - Joins user to league via invite

### 1.9 Register Services

**File:** `api/F1CompanionApi/Extensions/ServiceExtensions.cs`

**Add:**

```csharp
// Data Protection for token encryption
services.AddDataProtection()
    .SetApplicationName("F1CompanionApi");

// Invite Service
services.AddScoped<IInviteService, InviteService>();
```

---

## Phase 2: Frontend Implementation

### 2.1 Create TypeScript Contracts

**File:** `web/src/contracts/InviteToken.ts` (new)

**Interfaces:**

- `InviteToken` - Token details (id, token, leagueId, createdAt, createdByName)
- `InviteTokenPreview` - League preview from token (leagueName, description, ownerName, currentTeamCount, maxTeams, isLeagueFull)

### 2.2 Create Service Layer

**File:** `web/src/services/inviteService.ts` (new)

**Functions:**

- `getOrCreateInvite(leagueId)` → Promise<InviteToken> - Uses POST `/leagues/{id}/invite`
- `validateInvite(token)` → Promise<InviteTokenPreview> - Uses GET `/leagues/join/{token}/preview`
- `joinViaInvite(token)` → Promise<League> - Uses POST `/leagues/join/{token}`

**Implementation:** Use `apiClient` with proper error context, Sentry logging for significant events

### 2.3 Create Public Join Route

**File:** `web/src/router.tsx`

**New Route:** `/join/:token` (PUBLIC - no auth required)

**Route Config:**

- Parent: `rootRoute` (public access)
- Path parameter: `:token` - The encrypted invite token extracted from URL
- Params validation: Zod schema for token format
- Loader: Fetch `validateInvite(token)` → preview league details
- Component: `JoinInvite`
- Error handling: 404 for invalid tokens, ErrorBoundary for other errors
- Pending component: Loading spinner
- Static data: `pageTitle: 'Join League'`

**Example URLs:**

- Full URL shared: `https://yourapp.com/join/AbC123XyZ789`
- Route matches: `/join/:token` where `token = "AbC123XyZ789"`
- Token passed to API: `GET /leagues/join/AbC123XyZ789/preview`

**Update:** `routeTree` to include `joinInviteRoute`

### 2.4 Create JoinInvite Component

**File:** `web/src/components/JoinInvite/JoinInvite.tsx` (new)

**Features:**

- Display league preview (name, description, owner, member count)
- Check auth status: Unauthenticated → show "Sign In to Join" / "Create Account" buttons
- Check team status: No team → show "Create Team First" button
- Authenticated + has team → show "Join League" button
- Handle league full state with error message
- Success: Navigate to league detail page after join
- Error handling: InlineError for join failures, LiveRegion for announcements

**UX Flow:**

```
Unauthenticated → "Sign In" with redirect back to /join/:token
No Team → "Create Team" then return to join
Has Team → Click "Join League" → Navigate to /league/:leagueId
```

### 2.5 Create Clipboard Hook

**File:** `web/src/hooks/useClipboard.ts` (new)

**Purpose:** Reusable clipboard functionality

**Returns:**

- `copy(text)` - Copies to clipboard, returns Promise<boolean> for success/failure
- `reset()` - Clears copied state (call when dialog closes)
- `copiedValue` - Currently copied value (for state tracking)
- `hasCopied` - Boolean flag for visual feedback (icon swap)

**Features:** Sentry logging, no toast notifications (use icon swap for feedback). Call `reset()` when dialog closes to clear state for next open.

**Implementation:**

```typescript
import { useState, useCallback } from 'react';
import * as Sentry from '@sentry/react';

interface UseClipboardReturn {
  copy: (text: string) => Promise<boolean>;
  reset: () => void;
  copiedValue: string | null;
  hasCopied: boolean;
}

/**
 * Custom hook for copying text to clipboard
 *
 * @returns Object with copy function, reset function, copiedValue, and hasCopied state
 *
 * @example
 * const { copy, reset, hasCopied } = useClipboard();
 *
 * // In dialog close handler
 * const handleDialogOpen = (open: boolean) => {
 *   setIsDialogOpen(open);
 *   if (!open) reset(); // Clear state when dialog closes
 * };
 *
 * return (
 *   <Button onClick={() => copy(inviteUrl)}>
 *     {hasCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
 *   </Button>
 * );
 */
export function useClipboard(): UseClipboardReturn {
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  const copy = useCallback(async (text: string): Promise<boolean> => {
    if (!navigator.clipboard) {
      Sentry.captureMessage('Clipboard API not supported', 'warning');
      return false;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopiedValue(text);
      setHasCopied(true);

      return true;
    } catch (error) {
      setHasCopied(false);
      setCopiedValue(null);

      Sentry.captureException(error, {
        tags: { feature: 'clipboard' },
        extra: { textLength: text.length },
      });

      return false;
    }
  }, []);

  const reset = useCallback(() => {
    setHasCopied(false);
    setCopiedValue(null);
  }, []);

  return { copy, reset, copiedValue, hasCopied };
}
```

### 2.6 Update League Component

**File:** `web/src/components/League/League.tsx`

**Changes:**

1. Add "Share League" button (visible to owner of **private leagues only**) in header area
2. Button opens Dialog with:
   - Dialog title: "Share League"
   - Dialog description: "Anyone with this link can join your league"
   - Read-only Input with invite URL (built client-side from token)
   - Icon button with `useClipboard` hook (Copy icon → Check icon)
   - Visual feedback: Icon swaps from Copy to Check (persists until dialog closes)
   - No toast notifications (cleaner UX)
3. Check ownership and privacy: Compare current user with league owner AND check `league.isPrivate`
4. **Build full URL client-side**: Use `window.location.origin` + token to construct shareable URL
5. **Lazy load invite token using event handler** (not useEffect)

**Implementation Pattern:**

```typescript
import { Copy, Check } from 'lucide-react';

function League() {
  const { league } = useLoaderData({...});
  const { user } = useAuth();
  const isOwner = league.ownerId === user?.id;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [inviteToken, setInviteToken] = useState<InviteToken | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { copy, reset, hasCopied } = useClipboard();

  // Build full URL from token (client-side)
  const inviteUrl = inviteToken
    ? `${window.location.origin}/join/${inviteToken.token}`
    : '';

  // Lazy load invite when dialog opens (event handler approach)
  const handleDialogOpen = async (open: boolean) => {
    setIsDialogOpen(open);

    // Reset clipboard state when dialog closes
    if (!open) {
      reset();
    }

    // Only fetch when opening dialog and token not already loaded
    if (open && !inviteToken && !isLoading) {
      setIsLoading(true);
      setError(null);
      try {
        const token = await getOrCreateInvite(league.id);
        setInviteToken(token);
      } catch (err) {
        setError('Failed to load invite link');
        Sentry.logger.error('Failed to load invite', { leagueId: league.id, err });
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={handleDialogOpen}>
      <DialogTrigger asChild>
        {/* Only show for private leagues owned by current user */}
        {isOwner && league.isPrivate && <Button>Share League</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share League</DialogTitle>
          <DialogDescription>
            Anyone with this link can join your league
          </DialogDescription>
        </DialogHeader>
        {isLoading && <div>Loading invite link...</div>}
        {error && <InlineError message={error} />}
        {inviteToken && (
          <div className="flex items-center gap-2">
            <Input value={inviteUrl} readOnly className="flex-1" />
            <Button
              size="icon"
              variant="outline"
              onClick={() => copy(inviteUrl)}
              aria-label={hasCopied ? 'Copied' : 'Copy invite link'}
            >
              {hasCopied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

**Key Benefits:**

- **No useEffect** - Event handler directly tied to user action
- **Cached result** - Won't re-fetch on subsequent dialog opens
- **Clean loading states** - Error handling within dialog
- **Performance** - Only fetches when user actually wants to share
- **Client-side URL construction** - Backend doesn't need to know frontend URL structure

---

## Phase 3: Testing

### 3.1 Backend Unit Tests

**File:** `api/F1CompanionApi.UnitTests/Domain/Services/InviteServiceTests.cs` (new)

**Test Cases:**

- ✅ GetOrCreateInvite: Returns existing invite if one exists for league
- ✅ GetOrCreateInvite: Creates new invite if none exists
- ✅ GetOrCreateInvite: Throws UnauthorizedAccessException if not owner
- ✅ GetOrCreateInvite: Throws InvalidOperationException if league is public
- ✅ GetOrCreateInvite: Throws LeagueNotFoundException if league doesn't exist
- ✅ ValidateAndPreview: Returns correct preview data
- ✅ ValidateAndPreview: Throws InvalidInviteTokenException for invalid token format
- ✅ ValidateAndPreview: Throws InvalidInviteTokenException for non-existent token
- ✅ JoinViaInvite: Success, user joins league
- ✅ JoinViaInvite: Throws AlreadyInLeagueException if already member
- ✅ JoinViaInvite: Throws LeagueIsFullException if league at capacity
- ✅ JoinViaInvite: Allows joining private leagues (bypasses privacy check)

### 3.2 Frontend Component Tests

**File:** `web/src/components/JoinInvite/JoinInvite.test.tsx` (new)

**Test Cases:**

- ✅ Shows league preview with name, description, owner
- ✅ Shows member count (X/Y teams)
- ✅ Unauthenticated user sees "Sign In to Join" button
- ✅ Authenticated user without team sees "Create Team First" button
- ✅ Authenticated user with team sees "Join League" button
- ✅ League full shows error state
- ✅ Invalid token shows error state
- ✅ Successful join navigates to league detail page
- ✅ Failed join shows inline error

**File:** `web/src/components/League/League.test.tsx` (update existing)

**Test Cases:**

- ✅ Owner of private league sees "Share League" button
- ✅ Owner of public league does not see "Share League" button
- ✅ Non-owner does not see "Share League" button
- ✅ Clicking "Share League" opens dialog
- ✅ Dialog shows invite URL in read-only input (built from token)
- ✅ Copy button copies to clipboard
- ✅ Copy button shows visual feedback (Copy → Check icon)
- ✅ Closing dialog resets clipboard state (icon reverts to Copy on reopen)

### 3.3 Service Tests

**File:** `web/src/services/inviteService.test.ts` (new)

**Test Cases:**

- ✅ All service functions call apiClient with correct endpoints
- ✅ Error handling propagates correctly
- ✅ Sentry logging called on success/failure

### 3.4 Hook Tests

**File:** `web/src/hooks/useClipboard.test.ts` (new)

**Test Cases:**

- ✅ copy() writes to clipboard and returns true
- ✅ hasCopied becomes true after copy
- ✅ reset() clears hasCopied and copiedValue
- ✅ copy() returns false when clipboard API unavailable
- ✅ Sentry logs on error

---

## Phase 4: Manual Testing Scenarios

### 4.1 Happy Path - Create and Use Invite

1. Sign in as league owner
2. Navigate to league detail page
3. Click "Share League" button
4. Dialog opens with invite link
5. Click "Copy" button → URL copied to clipboard, icon changes to checkmark
6. Close dialog → icon resets to Copy for next time
6. Open link in incognito browser (not signed in)
7. See league preview with correct details
8. Click "Sign In to Join" → redirected to sign-in with redirect param
9. Sign in with existing account that has team
10. Automatically redirected back to invite page
11. Click "Join League"
12. Successfully joined → navigated to league detail page
13. Verify user appears in league members

### 4.2 Edge Cases

**League Full:**

1. Create league with maxTeams: 2
2. Fill league to capacity
3. Try to join via token → see "League is full" error

**Already Member:**

1. Join league via token
2. Try to use same token again → see "Already in league" error

**Invalid Token:**

1. Manually modify token in URL
2. Try to access → see "Invalid invite link" error

**Private League via Invite:**

1. Create private league
2. Generate invite token
3. Share with non-member
4. Verify they can join (bypasses private restriction)

**No Team Flow:**

1. Sign in with account that has no team
2. Visit invite link
3. See "Create Team First" button
4. Click → redirected to team creation
5. After creating team, return to invite
6. Successfully join league

---

## Phase 5: Verification

### 5.1 Build & Lint

**Backend:**

```bash
cd api
dotnet build F1CompanionApi/F1CompanionApi.csproj
dotnet test F1CompanionApi.UnitTests/F1CompanionApi.UnitTests.csproj
```

**Frontend:**

```bash
cd web
npm run build
npm run lint
npm run test
npm run test:coverage
```

### 5.2 Database Verification

**Commands:**

```bash
dotnet ef migrations add AddLeagueInvite -p F1CompanionApi
dotnet ef database update -p F1CompanionApi
```

**Verify:**

- Table `LeagueInvites` exists with correct columns
- Unique indexes on `Token` and `LeagueId`
- FK constraints to `Leagues` and `UserProfiles`

### 5.3 API Testing (Manual with curl/Postman)

```bash
# 1. Get or create invite (owner only, private leagues only)
POST /leagues/1/invite
Response: 200 OK with invite details including token

# 2. Preview token (public)
GET /leagues/join/{token}/preview
Response: 200 OK with league preview

# 3. Join via token (authenticated)
POST /leagues/join/{token}
Response: 200 OK with league details
```

### 5.4 End-to-End Verification

✅ Private league owner can get/create invite link with "Share League" button
✅ Public league owner does not see "Share League" button
✅ Dialog shows invite URL (built client-side from token) with copy functionality
✅ Copy button provides visual feedback with icon swap (Copy → Check)
✅ Closing and reopening dialog resets icon to Copy state
✅ Public users can preview league details before signing in
✅ Authenticated users can join private leagues via invite links
✅ GetOrCreate pattern returns same token on subsequent calls
✅ Invalid tokens show appropriate error messages
✅ Copy to clipboard works with visual feedback
✅ Navigation flow handles all auth states correctly
✅ Mobile responsive (test on iPhone/Android)
✅ Accessibility: keyboard navigation, screen reader support

---

## Critical Files Summary

### Backend (6 new files, 4 modified)

**New Files:**

1. `api/F1CompanionApi/Data/Entities/LeagueInvite.cs`
2. `api/F1CompanionApi/Data/Migrations/[timestamp]_AddLeagueInvite.cs`
3. `api/F1CompanionApi/Domain/Services/InviteService.cs`
4. `api/F1CompanionApi/Domain/Exceptions/InvalidInviteTokenException.cs`
5. `api/F1CompanionApi/Api/Models/InviteTokenResponse.cs`
6. `api/F1CompanionApi/Api/Models/InviteTokenPreviewResponse.cs`

**Modified Files:**

1. `api/F1CompanionApi/Data/ApplicationDbContext.cs` - Add DbSet and relationships
2. `api/F1CompanionApi/Domain/Services/LeagueService.cs` - Add bypassPrivateCheck parameter
3. `api/F1CompanionApi/Api/Endpoints/LeagueEndpoints.cs` - Add 3 new endpoints
4. `api/F1CompanionApi/Extensions/ServiceExtensions.cs` - Register Data Protection and service
5. `api/F1CompanionApi/Api/GlobalExceptionHandler.cs` - Add exception handler

### Frontend (5 new files, 2 modified)

**New Files:**

1. `web/src/contracts/InviteToken.ts`
2. `web/src/services/inviteService.ts`
3. `web/src/components/JoinInvite/JoinInvite.tsx`
4. `web/src/components/JoinInvite/JoinInvite.test.tsx`
5. `web/src/hooks/useClipboard.ts`

**Modified Files:**

1. `web/src/router.tsx` - Add joinInviteRoute with redirect parameter support
2. `web/src/components/League/League.tsx` - Add "Share League" button with Dialog (private leagues only)

---

## Implementation Notes

**Security:**

- Tokens encrypted using ASP.NET Core Data Protection API
- URL-safe Base64 encoding prevents URL manipulation
- Owner authorization enforced at service layer
- Private leagues only - backend enforces this constraint
- Public preview endpoint doesn't expose sensitive data

**Performance:**

- Unique index on Token for O(1) lookups
- Unique index on LeagueId enforces one token per league
- Eager loading prevents N+1 queries

**UX Considerations:**

- Public preview allows viral growth (non-users can see what they're joining)
- Redirect parameter preserves invite link through sign-in flow
- Icon swap for copy feedback (Copy → Check, resets when dialog closes)
- LiveRegion announcements for form submissions
- Dialog pattern follows shadcn/ui best practices
- Client-side URL construction - better separation of concerns, backend agnostic to frontend URL structure

**Accessibility:**

- All buttons have proper ARIA labels
- Loading states use aria-busy instead of disabled
- Error states announced via role="alert"
- Copy confirmation uses both visual and SR feedback
- Keyboard navigation fully supported

**Future Enhancements (Post-MVP):**

- **Email invites**: Add `InviteType`, `RecipientEmail`, `SentAt`, `UsedAt`, `UsedBy` columns
- Multiple invites per league (remove unique index on `LeagueId`)
- Token expiration dates
- Usage limits and tracking
- Invite revocation
- Invite management UI with list/resend/revoke capabilities
