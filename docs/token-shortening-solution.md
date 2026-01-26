# Token Shortening Solution

## Problem

Current invite tokens are ~160 characters long due to ASP.NET Core Data Protection overhead:

```
CfDJ8LJLw5veZ4tLt9FF-H-IamxPU3tpOtV9ZXlr8Vj5Hu3R1Ik5NhqfuH13dRAPEOKT2Gk3vGqxKaz-syLQlsHQQMpDNvkPNT-BQ4feiS1Mc_d_oXRZeUo7suV1joLbAx-PFdHmEg4Cq_CatocCYh7o1GM
```

This makes URLs unwieldy and harder to share.

## Root Cause

`DataProtection` API adds significant overhead:

- Encrypted payload (leagueId:guid)
- HMAC signature for tamper protection
- Key identifier metadata
- Base64 encoding

While secure, it's overkill for this use case.

## Current Implementation Status

### ✅ Already Implemented

- **Database table** (`LeagueInvites`) with `LeagueId` and `Token` columns
- **Unique index on Token** column (prevents duplicate tokens)
- **Unique index on LeagueId** (enforces one invite per league)
- **Token stored in database** (infrastructure ready for lookups)
- **Get-or-create pattern** (checks for existing invite before creating)
- **DataProtection configured** (in ServiceExtensions.cs)

### ❌ Still Using Encryption

- Token generation encrypts `leagueId:guid` with DataProtection
- Token validation decrypts to extract leagueId
- Database lookup happens AFTER decryption (should be the primary lookup method)

## Recommended Solution: Short Random Codes

**Generate short, random, cryptographically-secure codes stored in the database.**

### Benefits

✅ **Shorter tokens** (8-12 characters instead of 160)  
✅ **More secure** (no encrypted data to attack)  
✅ **URL-friendly** (easy to share, type, read)  
✅ **Simpler code** (no encryption/decryption)  
✅ **Better UX** (shorter URLs: `yourapp.com/join/Abc12Xyz`)

## Implementation Changes Required

The database schema is already perfect! Only the service logic needs updating.

### 1. Update Token Generation (LeagueInviteService.cs)

**Before:**

```csharp
var payload = $"{leagueId}:{Guid.NewGuid}";
var encryptedBytes = _protector.Protect(Encoding.UTF8.GetBytes(payload));
var token = Base64UrlEncode(encryptedBytes);
```

**After:**

````csharp
var token = GenerateSecureRandomCode(length: 10); // e.g., "Abc12Xyz34"
``` 2. Remove Encryption Dependencies

Remove from LeagueInviteService.cs:
- `IDataProtectionProvider` injection (constructor parameter and field)
- `DecryptAndExtractLeagueId()` method (lines 188-201)
- `Base64UrlEncode()` / `Base64UrlDecode()` methods (lines 203-227)
- `using Microsoft.AspNetCore.DataProtection;` import
- `using System.Security.Cryptography;` import (if only used for encryption)
- `using System.Text;` import (if only used for encoding)

 `Base64UrlEncode()` / `Base64UrlDecode()` methods

#### 3. Update Token Validation

**Before:**
```csharp
var leagueId = DecryptAndExtractLeagueId(token);
````

**After:**

```csharp
var invite = await _dbContext.LeagueInvites
    .Include(x => x.League)
    .FirstOrDefaultAsync(x => x.Token == token);

if (invite == null)
{
    throw new InvalidLeagueInviteTokenException("Invalid or expired invite");
}

varleagueId = invite.LeagueId;
```

#### 4. Add Secure Random Code Generator

```csharp
private static string GenerateSecureRandomCode(int length = 10)
{
    // Use only URL-safe characters (avoid confusion: no 0, O, I, l)
    const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz";

    var bytes = new byte[length];
    using var rng = RandomNumberGenerator.Create();
    rng.GetBytes(bytes);

    var result = new char[length];
    for (int i = 0; i < length; i++)
    {
        result[i] = chars[bytes[i] % chars.Length];
    }

    return new string(result);
}
```

#### 5. Handle Collisions

Since tokens are random, add collision detection:

```csharp
public async Task<LeagueInviteTokenResponse> GetOrCreateLeagueInviteAsync(int leagueId, int requesterId)
{
    // ... existing validation ...

    // Check if invite already exists
    var existingInvite = await _dbContext.LeagueInvites
        .FirstOrDefaultAsync(x => x.LeagueId == leagueId);

    if (existingInvite != null)
    {
        return existingInvite.ToResponseModel();
    }

    // Generate unique token (retry on collision)
    string token;
    int attempts = 0;
    const int maxAttempts = 5;

    do
    {
        token = GenerateSecureRandomCode(10);
        attempts++;

        if (attempts >= maxAttempts)
        {
            throw new InvalidOperationException("Failed to generate unique invite token");
        }
    }
    while (await _dbContext.LeagueInvites.AnyAsync(x => x.Token == token));

    var leagueInvite = new LeagueInvite
    {
        LeagueId = leagueId,
        Token = token,
        CreatedBy = requesterId,
        CreatedAt = DateTime.UtcNow,
    };

    await _dbContext.LeagueInvites.AddAsync(leagueInvite);
    await _dbContext.SaveChangesAsync();

    return leagueInvite.ToResponseModel();
}
```

### 6. Update ServiceExtensions.cs

Remove DataProtection registration from `AddServices()` method:

**File:** `api/F1CompanionApi/Extensions/ServiceExtensions.cs`

**Before (lines 78-79):**

```csharp
services.AddDataProtection()
    .SetApplicationName("F1CompanionApi");
```

**After:**

```csharp
// Remove these lines - no longer needed for invite tokens
```

**Keep:** Authentication setup and other service registrations remain unchanged.

### Security Considerations

| Aspect | Data Protection (Current) | Random Codes (Proposed) |
| ------ | ------------------------- | ----------------------- |

| \*\*7. Update Tests

**File:** `api/F1CompanionApi.UnitTests/Services/LeagueInviteServiceTests.cs`

Update test setup:

- Remove `Mock<IDataProtectionProvider>` and `Mock<IDataProtector>` setup
- Remove DataProtection mock configurations
- Update assertions to work with random codes instead of encrypted tokens
- Ensure tests validate token lookup via database queries

## Summary of Changes

### Files to Modify

1. **LeagueInviteService.cs** (primary changes)
   - Replace encrypted token generation with random code
   - Replace decryption with database lookup
   - Remove encryption helper methods
   - Add collision detection

2. **ServiceExtensions.cs** (cleanup)
   - Remove DataProtection registration

3. **LeagueInviteServiceTests.cs** (test updates)
   - Remove DataProtection mocks
   - Update test assertions

### Files NOT Changed

- ✅ Database migrations (already have unique indexes)
- ✅ ApplicationDbContext.cs (schema configuration is correct)
- ✅ API endpoints (token parameter handling unchanged)
- ✅ Frontend code (receives shorter tokens, no changes needed)

### Result

**Before:** `yourapp.com/join/CfDJ8LJLw5veZ4tLt9FF-H-IamxPU3tpOtV9ZXlr8Vj5Hu3R1Ik5NhqfuH13dRAPEOKT2Gk3vGqxKaz-syLQlsHQQMpDNvkPNT-BQ4feiS1Mc_d_oXRZeUo7suV1joLbAx-PFdHmEg4Cq_CatocCYh7o1GM`

**After:** `yourapp.com/join/Abc12Xyz34`

**94% reduction in token length** with improved security and user experience.

# **Transition Strategy**:

- New tokens use short codes
- There is no need to worry about existing tokens since this feature is still in active development

Examples of services using similar approaches:

- Discord invite links: `discord.gg/abc123xyz`
- Slack invites: `slack.com/join/Abc12Def34`
- Zoom meetings: `zoom.us/j/123456789`
