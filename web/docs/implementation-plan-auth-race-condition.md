# Authentication Race Condition Analysis & Solution Plan

## Problem Summary

You're experiencing a race condition during user signup where the React app redirects before the user profile is created in your .NET API.

## Root Cause Analysis

### The Race Condition Flow

```
1. User submits signup form
2. signUp() calls supabase.auth.signUp()
3. Supabase creates user AND immediately fires onAuthStateChange('SIGNED_IN')
4. onAuthStateChange callback sets user/session state and loading = false
5. InnerApp sees loading = false, renders RouterProvider
6. Route guards execute, potentially redirecting user
7. MEANWHILE: signUp() is still awaiting userProfileService.registerUser()
8. Profile doesn't exist yet when route guards/loaders run!
```

The issue is in [AuthContext.tsx:26-30](src/contexts/AuthContext.tsx#L26-L30) - the `onAuthStateChange` listener fires independently of your `signUp` function, causing the app to consider auth "complete" before profile creation finishes.

## Solution: Database Trigger (Industry Standard)

Supabase's official documentation recommends using a **PostgreSQL database trigger** to automatically create user profiles when a user signs up. This approach:

- Profile creation is **atomic** with user creation
- **No race condition possible** - profile exists before `onAuthStateChange` fires
- **Works with email confirmation** - no refactor needed when you add it later
- **Simpler frontend code** - remove profile registration logic from React
- **No extra API calls** - profile guaranteed to exist

## Implementation Plan

### Step 1: Apply Database Migration

The migration file is already created and source controlled at:
`../f1-companion-api/supabase/migrations/20260108000000_create_user_profile_trigger.sql`

#### Local Development

**Option A: Using Supabase Studio (recommended if you have existing data)**
1. Open http://localhost:54323 (Supabase Studio)
2. Go to SQL Editor (left sidebar)
3. Create new query and paste the migration SQL
4. Click "Run" (or press Cmd+Enter)
5. Verify "Success. No rows returned"

**Option B: Using Supabase CLI (clean slate)**
```bash
cd f1-companion-api
supabase db reset  # Warning: drops all data and reapplies migrations
```

#### Production Deployment

**Option A: Manual via Supabase Dashboard** (use this for now)
1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT_ID
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the entire migration SQL from `supabase/migrations/20260108000000_create_user_profile_trigger.sql`
5. Paste into the editor
6. Click **Run** (bottom right)
7. Verify success message

**Option B: Via Supabase CLI from your machine**
```bash
cd f1-companion-api
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

To get your project ref:
- Go to Supabase Dashboard → Project Settings → General
- Copy the "Reference ID"

**Option C: Via CI/CD** (recommended for future, see [CI/CD Best Practices](#cicd-deployment))

---

**What the migration creates:**
- `handle_new_user()` function that inserts into `Accounts` and `UserProfiles`
- `on_auth_user_created` trigger that fires on `auth.users` INSERT

### Step 2: Simplify React SignUp

**File**: [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)

Remove the API call and pass displayName through Supabase metadata:

```typescript
const signUp = async (email: string, password: string, additionalData: CreateProfileData) => {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        displayName: additionalData.displayName,
      },
    },
  });
  if (error) throw error;
  // No API call needed - database trigger creates profile atomically
};
```

### Step 3: Keep /me/register as Fallback (No Changes Needed)

The existing endpoint already handles duplicates (returns 409 Conflict). Keep it for edge cases or manual profile creation if needed.

## Critical Files to Modify

| File | Change |
|------|--------|
| `../f1-companion-api/supabase/migrations/20260108000000_create_user_profile_trigger.sql` | Already created - apply with `supabase db push` |
| [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx) | Simplify signUp - pass displayName in options, remove API call |

## Why Database Trigger is Worth It

1. **Works now AND with future email confirmation** - no refactor needed
2. **Truly atomic** - profile guaranteed to exist when session is established
3. **Simple logic** - just 2 INSERT statements, easy to verify
4. **Integration testable** - sign up and verify tables have rows
5. **Simpler frontend** - remove error handling, retry logic, race condition workarounds

## Verification Plan

1. **Test trigger in Supabase**:
   - Run the SQL in Supabase SQL Editor
   - Verify no errors (trigger created successfully)

2. **Test new signup flow**:
   - Sign up with a new email + displayName
   - Verify user is redirected to `/create-team` without errors (no race condition!)
   - Check `Accounts` table has new row with correct `Id`
   - Check `UserProfiles` table has new row with correct `AccountId`, `Email`, `DisplayName`

3. **Test edge cases**:
   - Sign up WITH displayName → verify it's stored in `UserProfiles.DisplayName`
   - Sign up WITHOUT displayName → verify `DisplayName` is NULL (not error)
   - Sign up with existing email → verify Supabase returns "User already registered" error

4. **Test existing users still work**:
   - Sign in with existing account
   - Verify profile loads correctly from API
   - Verify sign out works

5. **Test trigger rollback** (if signup fails mid-way):
   - The trigger runs in the same transaction as user creation
   - If trigger fails, the entire signup is rolled back
   - User won't exist in `auth.users` either (atomic)
