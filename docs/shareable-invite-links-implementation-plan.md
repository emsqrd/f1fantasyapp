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
2. **Backend returns full URL**: `InviteTokenResponse.ShareableUrl` = `https://yourapp.com/join/AbC123XyZ789`
3. **Owner copies full URL** from Dialog and shares it
4. **Recipient clicks link** → Browser navigates to `/join/AbC123XyZ789`
5. **Frontend extracts token** from URL route parameter (`:token`)
6. **Frontend calls API** with token:
   - `GET /leagues/join/AbC123XyZ789/preview` (shows league info)
   - `POST /leagues/join/AbC123XyZ789` (joins league)
7. **Backend decrypts token** to extract `leagueId` and process request

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
    public required string ShareableUrl { get; set; }  // Full frontend URL
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
- **ShareableUrl construction**: Build full frontend URL `{frontendBaseUrl}/join/{token}` (e.g., `https://yourapp.com/join/AbC123XyZ789`)
- Authorization: Only league owner can get/create token
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
    // Build shareable URL for frontend: /join/{invite.Token}
    // Map all properties from entity to response DTO
    // Include CreatedByUser.GetFullName() for display
}
```

### 1.8 Add API Endpoints

**File:** `api/F1CompanionApi/Api/Endpoints/LeagueEndpoints.cs`

**New Endpoints:**

1. **GET /leagues/{id}/invite** (auth required, owner only)
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

- `InviteToken` - Token details (id, token, leagueId, shareableUrl, createdAt, createdByName)
- `InviteTokenPreview` - League preview from token (leagueName, description, ownerName, currentTeamCount, maxTeams, isLeagueFull)

### 2.2 Create Service Layer

**File:** `web/src/services/inviteService.ts` (new)

**Functions:**

- `getOrCreateInvite(leagueId)` → Promise<InviteToken>
- `validateInvite(token)` → Promise<InviteTokenPreview>
- `joinViaInvite(token)` → Promise<League>

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

- `copy(text)` - Copies to clipboard, shows toast
- `copiedValue` - Currently copied value (for state tracking)
- `hasCopied` - Boolean flag

**Features:** Auto-reset after 2 seconds, Sentry logging on errors, uses `useCallback` for optimization

### 2.6 Update League Component

**File:** `web/src/components/League/League.tsx`

**Changes:**

1. Add "Share League" button (visible to owner only) in header area
2. Button opens Dialog with:
   - Dialog title: "Share League"
   - Dialog description: "Anyone with this link can join your league"
   - Read-only Input with invite URL
   - "Copy" button (uses `useClipboard` hook)
   - Visual feedback when copied (icon change)
   - "Close" button in footer
3. Check ownership: Compare current user with league owner
4. Load invite token when dialog opens (lazy load)

**Implementation Pattern:** Follow shadcn/ui Dialog "Share link" example

---

## Phase 3: Testing

### 3.1 Backend Unit Tests

**File:** `api/F1CompanionApi.UnitTests/Domain/Services/InviteServiceTests.cs` (new)

**Test Cases:**

- ✅ GetOrCreateInvite: Returns existing invite if one exists for league
- ✅ GetOrCreateInvite: Creates new invite if none exists
- ✅ GetOrCreateInvite: Throws UnauthorizedAccessException if not owner
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

- ✅ Owner sees "Share League" button
- ✅ Non-owner does not see "Share League" button
- ✅ Clicking "Share League" opens dialog
- ✅ Dialog shows invite URL in read-only input
- ✅ Copy button copies to clipboard
- ✅ Copy button shows visual feedback (icon change)

### 3.3 Service Tests

**File:** `web/src/services/inviteService.test.ts` (new)

**Test Cases:**

- ✅ All service functions call apiClient with correct endpoints
- ✅ Error handling propagates correctly
- ✅ Sentry logging called on success/failure

### 3.4 Hook Tests

**File:** `web/src/hooks/useClipboard.test.ts` (new)

**Test Cases:**

- ✅ copy() writes to clipboard
- ✅ hasCopied becomes true after copy
- ✅ Auto-resets after 2 seconds
- ✅ Toast shown on successful copy
- ✅ Sentry logs on error

---

## Phase 4: Manual Testing Scenarios

### 4.1 Happy Path - Create and Use Invite

1. Sign in as league owner
2. Navigate to league detail page
3. Click "Share League" button
4. Dialog opens with invite link
5. Click "Copy" button → URL copied to clipboard, toast confirmation
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
# 1. Get or create invite (owner only)
GET /leagues/1/invite
Response: 200 OK with invite details including token

# 2. Preview token (public)
GET /leagues/join/{token}/preview
Response: 200 OK with league preview

# 3. Join via token (authenticated)
POST /leagues/join/{token}
Response: 200 OK with league details
```

### 5.4 End-to-End Verification

✅ League owner can get/create invite link with "Share League" button
✅ Dialog shows invite URL with copy functionality
✅ Copy button provides visual feedback and toast notification
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
2. `web/src/components/League/League.tsx` - Add "Share League" button with Dialog

---

## Implementation Notes

**Security:**

- Tokens encrypted using ASP.NET Core Data Protection API
- URL-safe Base64 encoding prevents URL manipulation
- Owner authorization enforced at service layer
- Public preview endpoint doesn't expose sensitive data

**Performance:**

- Unique index on Token for O(1) lookups
- Unique index on LeagueId enforces one token per league
- Eager loading prevents N+1 queries

**UX Considerations:**

- Public preview allows viral growth (non-users can see what they're joining)
- Redirect parameter preserves invite link through sign-in flow
- Toast notifications for copy operations
- LiveRegion announcements for form submissions
- Dialog pattern follows shadcn/ui best practices

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
