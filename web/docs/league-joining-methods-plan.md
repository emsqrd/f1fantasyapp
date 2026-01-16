# League Joining Methods - Implementation Plan

## Summary

Add four methods for users to join leagues: public browse, invite codes, shareable links, and email invitations.

---

## Methods to Implement

| # | Method | Complexity | New Infrastructure |
|---|--------|------------|-------------------|
| 1 | Direct Join (Public Leagues) | Low | None |
| 2 | Private League Invite Code | Low-Medium | None |
| 3 | Shareable Invite Link | Medium | Data Protection API |
| 6 | Email Invitations | Medium | Supabase Edge Function + Resend |

---

## Method 1: Direct Join (Public Leagues)
**Complexity: LOW**

Browse public leagues and join with one click. Uses existing `IsPrivate` flag.

### Backend Changes
- **LeagueService.cs**: Add `GetPublicLeaguesAsync(searchTerm)` and `JoinLeagueAsync(leagueId, userId)`
- **LeagueEndpoints.cs**: Add `GET /leagues/public` and `POST /leagues/{id}/join`
- **New exceptions**: `LeagueFullException`, `AlreadyInLeagueException`
- **Validation**: Check league is public, not full (MaxTeams), team not already member

### Frontend Changes
- New route `/leagues/browse` with search and join buttons
- New `leagueJoinService.ts` with `getPublicLeagues()` and `joinLeague()`

---

## Method 2: Private League Invite Code
**Complexity: LOW-MEDIUM**

League owners share a short code (e.g., "ABC123") that others enter to join.

### Backend Changes
- **Migration**: Add `InviteCode` column to League table (nullable, unique)
- **League.cs**: Add `InviteCode` property
- **LeagueService.cs**: Add `GenerateInviteCodeAsync()` and `JoinByCodeAsync()`
- **LeagueEndpoints.cs**: Add `POST /leagues/{id}/invite-code`, `GET /leagues/{id}/invite-code`, `POST /leagues/join-by-code`
- Code format: 6-8 alphanumeric characters, case-insensitive

### Frontend Changes
- Code input form with validation
- Display/copy code for league owners
- Regenerate code button

---

## Method 3: Shareable Invite Link
**Complexity: MEDIUM**

Generate time-limited, encrypted invite URLs that can be shared anywhere.

### Backend Changes
- **New entity**: `LeagueInviteToken` (LeagueId, Token, ExpiresAt, MaxUses, UsedCount, IsRevoked)
- **ServiceExtensions.cs**: Register `AddDataProtection()`
- **New service**: `InviteTokenService` using `IDataProtectionProvider`
- **LeagueEndpoints.cs**:
  - `POST /leagues/{id}/invite-link` - create link with expiry/max uses
  - `GET /leagues/join/{token}` - validate and preview
  - `POST /leagues/join/{token}` - join via token
  - `DELETE /leagues/{id}/invite-tokens/{id}` - revoke

### Frontend Changes
- New route `/join/:token` for accepting invites
- Invite link manager for owners (create, list, revoke)
- Copy/share functionality

---

## Method 6: Email Invitations (via Supabase Edge Functions)
**Complexity: MEDIUM**

Send invite emails to specific addresses using Supabase Edge Functions + Resend.

### Infrastructure Setup
1. **Resend Account**: Create account at resend.com (free tier: 3,000 emails/month)
2. **Supabase Edge Function**: Create `send-league-invite` function
3. **Environment Variables**: Store `RESEND_API_KEY` in Supabase secrets

### Supabase Edge Function
Create `supabase/functions/send-league-invite/index.ts`:
```typescript
import { Resend } from 'npm:resend';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

Deno.serve(async (req) => {
  const { email, leagueName, ownerName, inviteUrl } = await req.json();

  const { data, error } = await resend.emails.send({
    from: 'F1 Companion <noreply@yourdomain.com>',
    to: email,
    subject: `You're invited to join ${leagueName}`,
    html: `<p>${ownerName} invited you to join their F1 fantasy league.</p>
           <a href="${inviteUrl}">Join ${leagueName}</a>`
  });

  return new Response(JSON.stringify({ data, error }));
});
```

### Backend Changes
- **New entity**: `LeagueEmailInvite` (LeagueId, Email, Token, ExpiresAt, Status, SentAt, AcceptedAt)
- **New enum**: `EmailInviteStatus` (Pending, Sent, Accepted, Expired, Cancelled)
- **New service**: `EmailInviteService` - creates invite record, calls Edge Function
- **LeagueEndpoints.cs**:
  - `POST /leagues/{id}/email-invites` - send invites (array of emails, max 10)
  - `GET /leagues/{id}/email-invites` - list invites (owner only)
  - `POST /leagues/email-invites/{id}/resend` - resend invite
  - `DELETE /leagues/email-invites/{id}` - cancel invite
  - `POST /leagues/accept-email-invite/{token}` - accept email invite

### Frontend Changes
- Multi-email input form (comma or newline separated)
- Invite status list with resend/cancel buttons
- Accept invite route `/accept-invite/:token`

---

## Implementation Order

**Phase 1** - Core joining (Method 1)
- Establishes base join logic, validation, error handling
- New exceptions, join endpoint, public league browsing

**Phase 2** - Invite codes (Method 2)
- Add InviteCode to League entity
- Generate/view code endpoints
- Join by code endpoint and UI

**Phase 3** - Shareable links (Method 3)
- Add LeagueInviteToken entity
- Data Protection API for secure tokens
- Create/validate/revoke link endpoints

**Phase 4** - Email invitations (Method 6)
- Set up Resend account and Supabase Edge Function
- Add LeagueEmailInvite entity
- Send/resend/cancel invite endpoints

---

## Key Files to Modify

### Backend
- `F1CompanionApi/Data/Entities/League.cs` - Add InviteCode
- `F1CompanionApi/Domain/Services/LeagueService.cs` - Add join methods
- `F1CompanionApi/Api/Endpoints/LeagueEndpoints.cs` - Add endpoints

### Frontend
- `src/services/leagueService.ts` - Add API calls
- `src/router.tsx` - Add new routes
- New components for browse, join, invite management

---

## Verification Plan

### Unit Tests
- `LeagueService.GetPublicLeaguesAsync` - returns only public leagues, search works
- `LeagueService.JoinLeagueAsync` - validates public/full/duplicate, creates LeagueTeam
- `LeagueService.GenerateInviteCodeAsync` - creates unique code, owner only
- `LeagueService.JoinByCodeAsync` - validates code, creates LeagueTeam
- `InviteTokenService` - create/validate/revoke tokens, expiration

### Manual Testing
1. **Public Browse**: Create public league, browse from different account, join
2. **Invite Code**: Generate code as owner, join using code from different account
3. **Shareable Link**: Generate link, open in incognito, view preview, join
4. **Email Invite**: Send invite, receive email, click link, join
5. **Validation**: Verify MaxTeams enforcement, duplicate join prevention
6. **Authorization**: Verify only owners can generate codes/links, view invites

### Build Verification
```bash
# Backend
dotnet build F1CompanionApi/F1CompanionApi.csproj
dotnet test F1CompanionApi.UnitTests/F1CompanionApi.UnitTests.csproj

# Frontend
npm run build
npm run lint
```
