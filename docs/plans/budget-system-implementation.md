# Budget System Implementation Plan (Issue #31)

## Context

Add a budget cap system aligned with SportsDeck rules. Currently, drivers and constructors have no price data, and team composition is unconstrained by cost. The frontend already has placeholder stubs (`$--.-M` in picker list items, `$200k` hardcoded budget in Team page) waiting for real data.

**Blockers resolved:** Issue #14 (UX Redesign) is closed. Phase 0 data collection is partially complete — scoring rules and pricing formula are documented. Driver/constructor starting prices will use known values from the research JSON where available, with $3M floor for unknowns (to be updated later when real SportsDeck prices are provided).

**Scope assessment:** Single issue. All tasks form one cohesive vertical slice — the backend schema, validation, and frontend display are all interdependent.

**Separate prerequisite:** Updating the grid to 2026 (new drivers/constructors, season-based associations replacing `IsActive`) should be a separate issue. This budget system works against whatever drivers/constructors currently exist in the DB.

---

## Implementation Steps

### Step 1: Add `Price` to entities

**Files:**
- `api/F1CompanionApi/Data/Entities/Driver.cs`
- `api/F1CompanionApi/Data/Entities/Constructor.cs`

Add `public decimal Price { get; set; }` to both entities.

### Step 2: Generate schema migration

Run: `dotnet ef migrations add AddPriceToDriversAndConstructors --project F1CompanionApi`

This adds a `Price` decimal column (NOT NULL, default 0) to both tables.

### Step 3: Seed driver and constructor prices

**File:** `api/supabase/seed.sql`

Add UPDATE statements at the end of the existing seed script (after driver/constructor INSERTs). This matches the existing seeding pattern used for drivers, constructors, seasons, and races.

```sql
-- Seed driver prices (known from 2025 season data)
UPDATE "Drivers" SET "Price" = 18600000 WHERE "Abbreviation" = 'SAI';
UPDATE "Drivers" SET "Price" = 5300000 WHERE "Abbreviation" = 'GAS';
-- ... etc for all drivers
-- Catch-all for unknowns:
UPDATE "Drivers" SET "Price" = 3000000 WHERE "Price" = 0;
UPDATE "Constructors" SET "Price" = 3000000 WHERE "Price" = 0;
```

**Known prices** (from `docs/research/driver-value-research.json`, calculated via `round_to_100K(262,000 * previous_average)`):

| Abbr | Player | Price |
|------|--------|-------|
| SAI | Sainz | 18,600,000 |
| GAS | Gasly | 5,300,000 |
| RUS | Russell | 17,700,000 |
| NOR | Norris | 25,600,000 |
| PIA | Piastri | 18,500,000 |
| LEC | Leclerc | 22,800,000 |
| ALO | Alonso | 7,200,000 |
| MCL | McLaren | 28,300,000 |
| WIL | Williams | 4,400,000 |
| ALP | Alpine | 7,500,000 |
| RBR | Red Bull | 25,200,000 |
| FER | Ferrari | 26,500,000 |
| AMR | Aston Martin | 8,000,000 |

**Remaining players** (VER, HAM, ANT, LAW, STR, DOO, ALB, TSU, HAD, HUL, BOR, OCO, BEA + MER, RBS, SAU, HAA): Use $3,000,000 floor as placeholder — will be updated when real SportsDeck 2026 prices are provided.

### Step 4: Define budget cap constant

**New file:** `api/F1CompanionApi/Domain/BudgetConstants.cs`

```csharp
namespace F1CompanionApi.Domain;

public static class BudgetConstants
{
    public const decimal BudgetCap = 100_000_000m;
}
```

Kept separate from `TeamService` so the mapper can also reference it without a service dependency.

### Step 5: Add `BudgetExceededException`

**New file:** `api/F1CompanionApi/Domain/Exceptions/BudgetExceededException.cs`

Follow the `TeamFullException` pattern — properties for `TeamId`, `PlayerPrice`, `RemainingBudget`. Message includes the budget cap value.

### Step 6: Register exception in `GlobalExceptionHandler`

**File:** `api/F1CompanionApi/Domain/Exceptions/GlobalExceptionHandler.cs`

Add alongside the other validation failures (near `TeamFullException` on line 99):

```csharp
BudgetExceededException ex => (StatusCodes.Status400BadRequest, "Budget Exceeded", ex.Message),
```

### Step 7: Add budget validation to `TeamService`

**File:** `api/F1CompanionApi/Domain/Services/TeamService.cs`

In both `AddDriverToTeamAsync` and `AddConstructorToTeamAsync`:

1. Expand the existing team `.Include()` query to also `.ThenInclude(td => td.Driver)` and `.ThenInclude(tc => tc.Constructor)` so prices are loaded
2. After the existing validations (slot, duplicate, entity exists) and before the DB write, compute:
   ```
   currentSpend = team.TeamDrivers.Sum(td => td.Driver.Price) + team.TeamConstructors.Sum(tc => tc.Constructor.Price)
   projectedSpend = currentSpend + newPlayer.Price
   ```
3. If `projectedSpend > BudgetConstants.BudgetCap`, throw `BudgetExceededException`

### Step 8: Add `Price` to API response models and mappers

**Response models — add `public decimal Price { get; set; }`:**
- `api/F1CompanionApi/Api/Models/DriverResponse.cs`
- `api/F1CompanionApi/Api/Models/ConstructorResponse.cs`
- `api/F1CompanionApi/Api/Models/TeamDriverResponse.cs`
- `api/F1CompanionApi/Api/Models/TeamConstructorResponse.cs`

**Add `RemainingBudget` to team details:**
- `api/F1CompanionApi/Api/Models/TeamDetailsResponse.cs` — add `public decimal RemainingBudget { get; set; }`

**Mappers — add `Price = entity.Price` mapping:**
- `api/F1CompanionApi/Api/Mappers/DriverResponseMapper.cs`
- `api/F1CompanionApi/Api/Mappers/ConstructorResponseMapper.cs`
- `api/F1CompanionApi/Api/Mappers/TeamDriverResponseMapper.cs` — `Price = teamDriver.Driver.Price`
- `api/F1CompanionApi/Api/Mappers/TeamConstructorResponseMapper.cs` — `Price = teamConstructor.Constructor.Price`
- `api/F1CompanionApi/Api/Mappers/TeamResponseMapper.cs` — in `ToDetailsResponseModel()`, compute:
  ```
  RemainingBudget = BudgetConstants.BudgetCap - drivers.Sum(Price) - constructors.Sum(Price)
  ```

### Step 9: Backend tests

**File:** `api/F1CompanionApi.UnitTests/Services/TeamServiceTests.cs`
- Update `CreateTestDriver`/`CreateTestConstructor` helpers with a `price` parameter (default to a reasonable value so existing tests still pass)
- Add tests:
  - `AddDriverToTeamAsync_PlayerFitsWithinBudget_Succeeds`
  - `AddDriverToTeamAsync_PlayerExceedsBudget_ThrowsBudgetExceededException`
  - `AddDriverToTeamAsync_ExactlyAtBudgetCap_Succeeds`
  - `AddConstructorToTeamAsync_PlayerExceedsBudget_ThrowsBudgetExceededException`
  - `AddConstructorToTeamAsync_CumulativeCostExceedsBudget_ThrowsBudgetExceededException`

**New file:** `api/F1CompanionApi.UnitTests/Domain/Exceptions/BudgetExceededExceptionTests.cs`
- Verify properties are set and message contains budget cap

**File:** `api/F1CompanionApi.UnitTests/Domain/Exceptions/GlobalExceptionHandlerTests.cs`
- Add test verifying `BudgetExceededException` maps to HTTP 400

### Step 10: Update frontend contracts

**File:** `web/src/contracts/Role.ts`
- Add `price: number` to `Driver` and `Constructor` interfaces

**File:** `web/src/contracts/Team.ts`
- Add `price: number` to `TeamDriver` and `TeamConstructor` interfaces
- Add `remainingBudget: number` to `Team` interface

### Step 11: Update mock factories

**File:** `web/src/test-utils/mockFactories.ts`
- Add `price` field to all mock driver/constructor factories
- Add `remainingBudget` field to mock team factory

### Step 12: Update frontend picker list items

**Files:**
- `web/src/components/DriverListItem/DriverListItem.tsx`
- `web/src/components/ConstructorListItem/ConstructorListItem.tsx`

Changes:
1. Replace `$--.-M` with `${formatMillions(driver.price)}M` (reuse existing `formatMillions` from `web/src/lib/utils.ts`)
2. Add `disabled?: boolean` prop — when true, dim the item and prevent `onSelect` from firing

### Step 13: Update frontend picker components

**Files:**
- `web/src/components/DriverPicker/DriverPicker.tsx`
- `web/src/components/ConstructorPicker/ConstructorPicker.tsx`

Add `remainingBudget: number` prop. When rendering list items, pass `disabled={item.price > remainingBudget}`.

### Step 14: Update frontend cards

**Files:**
- `web/src/components/DriverCard/DriverCard.tsx`
- `web/src/components/ConstructorCard/ConstructorCard.tsx`

Replace `$--.-M` with formatted real price from the team member data.

### Step 15: Update Team component

**File:** `web/src/components/Team/Team.tsx`

1. Replace hardcoded `$200k` budget display with `${formatMillions(team.remainingBudget)}M`
2. Pass `remainingBudget={team.remainingBudget}` to `DriverPicker` and `ConstructorPicker`

### Step 16: Frontend tests

Update tests in:
- `web/src/components/DriverListItem/DriverListItem.test.tsx` — assert real price display, test disabled state
- `web/src/components/ConstructorListItem/ConstructorListItem.test.tsx` — same
- `web/src/components/DriverCard/DriverCard.test.tsx` — assert price display
- `web/src/components/ConstructorCard/ConstructorCard.test.tsx` — same
- `web/src/components/Team/Team.test.tsx` — assert remaining budget display

---

## Key Design Decisions

- **Budget cap:** $100,000,000 (100M)
- **Budget is computed, not stored.** `RemainingBudget` is calculated in `TeamResponseMapper.ToDetailsResponseModel` from the cap minus team member prices. No new column on `Team` entity.
- **`BudgetConstants` class** is a static class in the Domain layer, referenced by both the mapper and the service.
- **Frontend disabling is a UX enhancement, not a security gate.** The backend rejects over-budget additions regardless. The frontend `disabled` prop prevents the user from attempting an obviously over-budget pick.
- **Reuses existing `formatMillions`** utility from `web/src/lib/utils.ts` for price formatting.

---

## Verification

1. **Build both projects:** `npm run api:build && npm run web:build`
2. **Run all tests:** `npm run test:all`
3. **Manual E2E check:**
   - Apply migration: `dotnet ef database update --project api/F1CompanionApi`
   - Run seed script: `psql <connection_string> -f api/supabase/seed.sql`
   - Start both servers (`npm run api:watch` + `npm run web:dev`)
   - Navigate to My Team page — verify budget shows a real dollar amount instead of `$200k`
   - Open driver picker — verify prices appear instead of `$--.-M`
   - Try adding a driver that would exceed the budget — verify the item is visually disabled
   - Try API call directly to add an over-budget player — verify 400 response with "Budget Exceeded"
