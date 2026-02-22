# Budget System Implementation Plan (Issue #31)

## Context

Add a budget cap system aligned with SportsDeck rules. Drivers and constructors currently have no price data; team composition is unconstrained by cost. The frontend has placeholder stubs (`$--.-M`, hardcoded `$200k` budget) waiting for real data.

**Budget cap:** $100,000,000 (confirmed)
**Pricing source:** `docs/research/driver-value-research.json` (formula: `round_to_100K(262,000 × previous_average)`)

Each commit below is a complete, self-contained unit. Tests ship with the feature they cover. All tests must pass before requesting review.

---

## Commit 1 — Schema: add Price column to entities

**Files:**
- `api/F1CompanionApi/Data/Entities/Driver.cs` — add `public decimal Price { get; set; }`
- `api/F1CompanionApi/Data/Entities/Constructor.cs` — add `public decimal Price { get; set; }`
- `api/F1CompanionApi/Data/ApplicationDbContext.cs` — add `HasDefaultValue(3_000_000m)` for both in `OnModelCreating`:
  ```csharp
  modelBuilder.Entity<Driver>(entity =>
  {
      entity.Property(e => e.Price).HasDefaultValue(3_000_000m);
  });
  modelBuilder.Entity<Constructor>(entity =>
  {
      entity.Property(e => e.Price).HasDefaultValue(3_000_000m);
  });
  ```
- Migration: `dotnet ef migrations add AddPriceToDriversAndConstructors --project F1CompanionApi`

**Tests:** None — schema-only change.

**Commit message:** `chore: add Price column to Driver and Constructor entities`

---

## Commit 2 — Seed data: price files

**Files:**
- `api/supabase/seed.sql` — add `Price` inline in existing INSERT statements (column order: `FirstName, LastName, Abbreviation, CountryAbbreviation, Price, IsDeleted, CreatedAt, UpdatedAt, DeletedAt`). Known prices where available, `3000000` floor for all others.
- `api/supabase/seed-prices.sql` *(new)* — standalone UPDATE script with every driver and constructor listed explicitly. Run manually against any environment to update prices without a deploy.

  ```sql
  -- Driver prices — update values as real SportsDeck prices are confirmed
  -- Known (from docs/research/driver-value-research.json):
  UPDATE "Drivers" SET "Price" = 25600000 WHERE "Abbreviation" = 'NOR';
  UPDATE "Drivers" SET "Price" = 22800000 WHERE "Abbreviation" = 'LEC';
  UPDATE "Drivers" SET "Price" = 18600000 WHERE "Abbreviation" = 'SAI';
  UPDATE "Drivers" SET "Price" = 18500000 WHERE "Abbreviation" = 'PIA';
  UPDATE "Drivers" SET "Price" = 17700000 WHERE "Abbreviation" = 'RUS';
  UPDATE "Drivers" SET "Price" = 7200000  WHERE "Abbreviation" = 'ALO';
  UPDATE "Drivers" SET "Price" = 5300000  WHERE "Abbreviation" = 'GAS';
  -- Placeholder ($3M floor — update when SportsDeck 2026 prices available):
  UPDATE "Drivers" SET "Price" = 3000000 WHERE "Abbreviation" IN ('VER','HAM','ANT','HAD','STR','LAW','ALB','HUL','BOR','OCO','BEA','COL','LIN','DOO','TSU','BOT','PER');

  -- Constructor prices — update values as real SportsDeck prices are confirmed
  -- Known:
  UPDATE "Constructors" SET "Price" = 28300000 WHERE "Abbreviation" = 'MCL';
  UPDATE "Constructors" SET "Price" = 26500000 WHERE "Abbreviation" = 'FER';
  UPDATE "Constructors" SET "Price" = 25200000 WHERE "Abbreviation" = 'RBR';
  UPDATE "Constructors" SET "Price" = 8000000  WHERE "Abbreviation" = 'AMR';
  UPDATE "Constructors" SET "Price" = 7500000  WHERE "Abbreviation" = 'ALP';
  UPDATE "Constructors" SET "Price" = 4400000  WHERE "Abbreviation" = 'WIL';
  -- Placeholder:
  UPDATE "Constructors" SET "Price" = 3000000 WHERE "Abbreviation" IN ('MER','RBS','SAU','HAA','AUD','CAD');
  ```

**Tests:** None — SQL files only.

**Commit message:** `chore: add price seed data for drivers and constructors`

---

## Commit 3 — Domain: BudgetExceededException + GlobalExceptionHandler

**Files:**
- `api/F1CompanionApi/Domain/BudgetConstants.cs` *(new)*:
  ```csharp
  namespace F1CompanionApi.Domain;
  public static class BudgetConstants
  {
      public const decimal BudgetCap = 100_000_000m;
  }
  ```
- `api/F1CompanionApi/Domain/Exceptions/BudgetExceededException.cs` *(new)* — follow `TeamFullException` pattern.
- `api/F1CompanionApi/Domain/Exceptions/GlobalExceptionHandler.cs` — add alongside `TeamFullException`:
  ```csharp
  BudgetExceededException ex => (StatusCodes.Status400BadRequest, "Budget Exceeded", ex.Message),
  ```

**Tests:**
- `api/F1CompanionApi.UnitTests/Domain/Exceptions/BudgetExceededExceptionTests.cs` *(new)* — verify properties are set and message contains expected values
- `api/F1CompanionApi.UnitTests/Domain/Exceptions/GlobalExceptionHandlerTests.cs` — add test verifying `BudgetExceededException` → HTTP 400

**Commit message:** `feat: add BudgetExceededException and register in GlobalExceptionHandler`

---

## Commit 4 — Service: budget validation in TeamService

**File:** `api/F1CompanionApi/Domain/Services/TeamService.cs`

In **both** `AddDriverToTeamAsync` and `AddConstructorToTeamAsync`:

1. Expand the Include chain so both methods load both types:
   ```csharp
   .Include(t => t.TeamDrivers).ThenInclude(td => td.Driver)
   .Include(t => t.TeamConstructors).ThenInclude(tc => tc.Constructor)
   ```
   (Required to sum both types for total spend.)

2. After existing validations, before DB write:
   ```csharp
   var currentSpend = team.TeamDrivers.Sum(td => td.Driver.Price)
                    + team.TeamConstructors.Sum(tc => tc.Constructor.Price);
   var projectedSpend = currentSpend + newPlayer.Price;

   if (projectedSpend > BudgetConstants.BudgetCap)
       throw new BudgetExceededException(team.Id, newPlayer.Price, BudgetConstants.BudgetCap - currentSpend);
   ```

**Tests:** `api/F1CompanionApi.UnitTests/Services/TeamServiceTests.cs`
- Add `price` parameter to `CreateTestDriver` / `CreateTestConstructor` (default to a small value so existing tests pass without budget concern)
- Add:
  - `AddDriverToTeamAsync_PlayerFitsWithinBudget_Succeeds`
  - `AddDriverToTeamAsync_PlayerExceedsBudget_ThrowsBudgetExceededException`
  - `AddDriverToTeamAsync_ExactlyAtBudgetCap_Succeeds`
  - `AddConstructorToTeamAsync_PlayerExceedsBudget_ThrowsBudgetExceededException`
  - `AddConstructorToTeamAsync_CumulativeCostExceedsBudget_ThrowsBudgetExceededException`

**Commit message:** `feat: add budget validation to TeamService`

---

## Commit 5 — API: expose Price and RemainingBudget in response models

**Add `public decimal Price { get; set; }` to:**
- `api/F1CompanionApi/Api/Models/DriverResponse.cs`
- `api/F1CompanionApi/Api/Models/ConstructorResponse.cs`
- `api/F1CompanionApi/Api/Models/TeamDriverResponse.cs`
- `api/F1CompanionApi/Api/Models/TeamConstructorResponse.cs`

**Add `public decimal RemainingBudget { get; set; }` to:**
- `api/F1CompanionApi/Api/Models/TeamDetailsResponse.cs`

**Update mappers:**
- `api/F1CompanionApi/Api/Mappers/DriverResponseMapper.cs` — `Price = driver.Price`
- `api/F1CompanionApi/Api/Mappers/ConstructorResponseMapper.cs` — `Price = constructor.Price`
- `api/F1CompanionApi/Api/Mappers/TeamDriverResponseMapper.cs` — `Price = teamDriver.Driver.Price`
- `api/F1CompanionApi/Api/Mappers/TeamConstructorResponseMapper.cs` — `Price = teamConstructor.Constructor.Price`
- `api/F1CompanionApi/Api/Mappers/TeamResponseMapper.cs` — in `ToDetailsResponseModel()`:
  ```csharp
  RemainingBudget = BudgetConstants.BudgetCap
      - team.TeamDrivers.Sum(td => td.Driver.Price)
      - team.TeamConstructors.Sum(tc => tc.Constructor.Price)
  ```
  Note: `GetUserTeamAsync` already uses `.ThenInclude()` for both types, so prices are available without query changes.

**Tests:** None — mappers are covered by service-level and E2E testing.

**Commit message:** `feat: expose Price and RemainingBudget in API response models`

---

## Commit 6 — Frontend: update contracts and mock factories

**Files:**
- `web/src/contracts/Role.ts` — add `price: number` to `Driver` and `Constructor`
- `web/src/contracts/Team.ts` — add `price: number` to `TeamDriver` and `TeamConstructor`; add `remainingBudget: number` to `Team`
- `web/src/test-utils/mockFactories.ts` — add `price` field to all driver/constructor/teamDriver/teamConstructor factories; add `remainingBudget` to team factory

**Tests:** None — these are type definitions and test utilities.

**Commit message:** `feat: add price and remainingBudget to frontend contracts and mock factories`

---

## Commit 7 — Frontend: prices in picker list items

**Files:**
- `web/src/components/DriverListItem/DriverListItem.tsx`
  - Replace `$--.-M` with `` `$${formatMillions(driver.price)}M` `` (reuse `formatMillions` from `web/src/lib/utils.ts`)
  - Add `disabled?: boolean` prop — dim item and suppress `onSelect` when true
- `web/src/components/ConstructorListItem/ConstructorListItem.tsx` — same changes

**Tests:**
- `web/src/components/DriverListItem/DriverListItem.test.tsx` — assert price display; test disabled state (item dimmed, onSelect not called)
- `web/src/components/ConstructorListItem/ConstructorListItem.test.tsx` — same

**Commit message:** `feat: display prices in driver and constructor picker list items`

---

## Commit 8 — Frontend: prices on team cards

**Files:**
- `web/src/components/DriverCard/DriverCard.tsx` — replace `$--.-M` with formatted real price
- `web/src/components/ConstructorCard/ConstructorCard.tsx` — same

**Tests:**
- `web/src/components/DriverCard/DriverCard.test.tsx` — assert price display
- `web/src/components/ConstructorCard/ConstructorCard.test.tsx` — assert price display

**Commit message:** `feat: display prices on driver and constructor team cards`

---

## Commit 9 — Frontend: disable over-budget picks in pickers

**Files:**
- `web/src/components/DriverPicker/DriverPicker.tsx` — add `remainingBudget: number` prop; pass `disabled={item.price > remainingBudget}` to each `DriverListItem`
- `web/src/components/ConstructorPicker/ConstructorPicker.tsx` — same

**Tests:**
- `web/src/components/DriverPicker/DriverPicker.test.tsx` — add `remainingBudget` to all render calls; add tests for disabled state
- `web/src/components/ConstructorPicker/ConstructorPicker.test.tsx` — same

**Commit message:** `feat: disable over-budget picks in driver and constructor pickers`

---

## Commit 10 — Frontend: remaining budget on Team page

**File:** `web/src/components/Team/Team.tsx`
- Replace hardcoded `$200k` with `` `$${formatMillions(team.remainingBudget)}M` ``
- Pass `remainingBudget={team.remainingBudget}` to both `DriverPicker` and `ConstructorPicker`

**Tests:**
- `web/src/components/Team/Team.test.tsx` — assert remaining budget display (not hardcoded value)

**Commit message:** `feat: display remaining budget on Team page`

---

## Key Design Decisions

- **Budget cap:** $100,000,000 (100M)
- **Budget is computed, not stored.** `RemainingBudget` is calculated in `TeamResponseMapper.ToDetailsResponseModel` from the cap minus team member prices. No new column on `Team` entity.
- **`BudgetConstants` class** is a static class in the Domain layer, referenced by both the mapper and the service.
- **`HasDefaultValue(3_000_000m)`** sets the DB column default so existing rows get the floor price on migration.
- **`seed-prices.sql`** is a standalone file for updating prices in any environment without a deploy.
- **Include chain:** Both `AddDriverToTeamAsync` and `AddConstructorToTeamAsync` load both TeamDrivers+Driver and TeamConstructors+Constructor to compute total spend accurately.
- **Frontend disabling is a UX enhancement, not a security gate.** The backend rejects over-budget additions regardless. The frontend `disabled` prop prevents the user from attempting an obviously over-budget pick.
- **Reuses existing `formatMillions`** utility from `web/src/lib/utils.ts` for price formatting.

---

## Verification (after all commits)

1. Apply migration: `dotnet ef database update --project api/F1CompanionApi`
2. Run price seed: `psql <connection_string> -f api/supabase/seed-prices.sql`
3. Start servers: `npm run api:watch` + `npm run web:dev`
4. My Team page — budget shows a real dollar amount (not `$200k`)
5. Driver picker — prices appear (not `$--.-M`)
6. Add a driver that would exceed the budget — item visually disabled
7. API call directly to add an over-budget player — 400 with "Budget Exceeded"
