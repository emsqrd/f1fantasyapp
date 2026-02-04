# Race Schedule System - Implementation Plan

## Overview

Implement Season and Race entities with APIs to replace hardcoded race data in the Team component, enabling dynamic race selection and preparing the foundation for future roster lock functionality and historical data.

## Files to Create

### Backend

| File                                                                 | Purpose                               |
| -------------------------------------------------------------------- | ------------------------------------- |
| `api/F1CompanionApi/Data/Entities/Season.cs`                         | Season entity                         |
| `api/F1CompanionApi/Data/Entities/Race.cs`                           | Race entity                           |
| `api/F1CompanionApi/Api/Models/SeasonResponse.cs`                    | Season response DTO                   |
| `api/F1CompanionApi/Api/Models/RaceResponse.cs`                      | Race response DTO                     |
| `api/F1CompanionApi/Api/Mappers/SeasonResponseMapper.cs`             | Season entity-to-DTO mapper           |
| `api/F1CompanionApi/Api/Mappers/RaceResponseMapper.cs`               | Race entity-to-DTO mapper             |
| `api/F1CompanionApi/Domain/Services/SeasonService.cs`                | Service with ISeasonService interface |
| `api/F1CompanionApi/Domain/Services/RaceService.cs`                  | Service with IRaceService interface   |
| `api/F1CompanionApi/Api/Endpoints/SeasonEndpoints.cs`                | Season API endpoints                  |
| `api/F1CompanionApi/Api/Endpoints/RaceEndpoints.cs`                  | Race API endpoints                    |
| `api/F1CompanionApi/Data/Seeds/SeasonSeeds.cs`                       | 2026 season seed data                 |
| `api/F1CompanionApi/Data/Seeds/RaceSeeds.cs`                         | 2026 calendar seed data               |
| `api/F1CompanionApi.UnitTests/Services/SeasonServiceTests.cs`        | Season service tests                  |
| `api/F1CompanionApi.UnitTests/Services/RaceServiceTests.cs`          | Race service tests                    |
| `api/F1CompanionApi.UnitTests/Api/Endpoints/SeasonEndpointsTests.cs` | Season endpoint tests                 |
| `api/F1CompanionApi.UnitTests/Api/Endpoints/RaceEndpointsTests.cs`   | Race endpoint tests                   |

### Frontend

| File                                     | Purpose                     |
| ---------------------------------------- | --------------------------- |
| `web/src/contracts/Season.ts`            | Season TypeScript interface |
| `web/src/contracts/Race.ts`              | Race TypeScript interface   |
| `web/src/services/seasonService.ts`      | Season API service          |
| `web/src/services/raceService.ts`        | Race API service            |
| `web/src/services/seasonService.test.ts` | Season service tests        |
| `web/src/services/raceService.test.ts`   | Race service tests          |

## Files to Modify

| File                                                          | Change                                                           |
| ------------------------------------------------------------- | ---------------------------------------------------------------- |
| `api/F1CompanionApi/Data/ApplicationDbContext.cs`             | Add `DbSet<Season>` and `DbSet<Race>`, configure FK relationship |
| `api/F1CompanionApi/Extensions/ServiceExtensions.cs`          | Register `ISeasonService` and `IRaceService`                     |
| `api/F1CompanionApi/Api/Endpoints/Endpoints.cs`               | Chain `.MapSeasonEndpoints()` and `.MapRaceEndpoints()`          |
| `api/F1CompanionApi/Program.cs`                               | Add season and race seeding in dev mode                          |
| `api/F1CompanionApi/Api/Models/DriverResponse.cs`             | Remove unused `Type` property                                    |
| `api/F1CompanionApi/Api/Models/ConstructorResponse.cs`        | Remove unused `Type` property                                    |
| `api/F1CompanionApi/Api/Mappers/DriverResponseMapper.cs`      | Remove `Type = "driver"` from mapper                             |
| `api/F1CompanionApi/Api/Mappers/ConstructorResponseMapper.cs` | Remove `Type = "constructor"` from mapper                        |
| `web/src/router.tsx`                                          | Update loaders to fetch races                                    |
| `web/src/components/Team/Team.tsx`                            | Replace hardcoded Select with dynamic races                      |

---

## Implementation Details

### 1. Season Entity

```csharp
[Index(nameof(Year), IsUnique = true)]
public class Season : BaseEntity
{
    public required int Year { get; set; }
    public required DateTime StartDate { get; set; }
    public required DateTime EndDate { get; set; }

    public ICollection<Race> Races { get; set; } = [];
}
```

**Design decisions:**

- `Year` as unique identifier for the season
- `StartDate` / `EndDate` for defining season boundaries
- Navigation property to Races for easy querying

### Mapper Implementations

**SeasonResponseMapper:**

```csharp
public static IEnumerable<SeasonResponse> ToResponseModel(
    this IEnumerable<Season> seasons,
    int? currentSeasonId)
{
    return seasons.Select(s => s.ToResponseModel(currentSeasonId));
}

public static SeasonResponse ToResponseModel(this Season season, int? currentSeasonId = null)
{
    return new SeasonResponse
    {
        Id = season.Id,
        Year = season.Year,
        StartDate = season.StartDate,
        EndDate = season.EndDate,
        IsCurrent = season.Id == currentSeasonId
    };
}
```

**RaceResponseMapper:**

```csharp
public static IEnumerable<RaceResponse> ToResponseModel(
    this IEnumerable<Race> races,
    int? currentRaceId)
{
    return races.Select(r => r.ToResponseModel(currentRaceId));
}

public static RaceResponse ToResponseModel(this Race race, int? currentRaceId = null)
{
    return new RaceResponse
    {
        Id = race.Id,
        SeasonId = race.SeasonId,
        Round = race.Round,
        Name = race.Name,
        Location = race.Location,
        Circuit = race.Circuit,
        Country = race.Country,
        RaceDate = race.RaceDate,
        LockDeadline = race.LockDeadline,
        IsCurrent = race.Id == currentRaceId
    };
}
```

**Design notes:**

- Mappers stay pure - no `DateTime.UtcNow` calls, all computed values passed in
- Services compute which entity is current, mappers receive the ID as a parameter
- SeasonService finds current season by date range, passes `currentSeasonId` to SeasonResponseMapper
- RaceService finds next upcoming race, passes `currentRaceId` to RaceResponseMapper
- Example service usage:

  ```csharp
  // SeasonService
  var seasons = await query.OrderBy(s => s.Year).ToListAsync();
  var now = DateTime.UtcNow;
  var currentSeasonId = seasons.FirstOrDefault(s => now >= s.StartDate && now <= s.EndDate)?.Id;
  return seasons.ToResponseModel(currentSeasonId);

  // RaceService
  var races = await query.OrderBy(r => r.Round).ToListAsync();
  var now = DateTime.UtcNow;
  var currentRaceId = races.FirstOrDefault(r => r.RaceDate >= now)?.Id;
  return races.ToResponseModel(currentRaceId);
  ```

### 2. Race Entity

```csharp
[Index(nameof(SeasonId), nameof(Round), IsUnique = true)]
public class Race : BaseEntity
{
    public required int SeasonId { get; set; }
    public required int Round { get; set; }
    public required string Name { get; set; }        // "Australian Grand Prix"
    public required string Location { get; set; }    // "Melbourne"
    public required string Circuit { get; set; }     // "Albert Park Circuit"
    public required string Country { get; set; }     // "Australia"
    public required DateTime RaceDate { get; set; }  // UTC
    public DateTime? LockDeadline { get; set; }      // For future roster lock feature

    public Season Season { get; set; } = null!;
}
```

**Design decisions:**

- `SeasonId` FK to Season entity for proper relational modeling
- `LockDeadline` nullable - included now to avoid future migration
- Composite unique index on `(SeasonId, Round)`

### 3. API Endpoints

**Season Endpoints:**

| Endpoint                | Description                           |
| ----------------------- | ------------------------------------- |
| `GET /api/seasons`      | Get all seasons with `isCurrent` flag |
| `GET /api/seasons/{id}` | Get season by ID                      |

**Race Endpoints:**

| Endpoint                       | Description                                                                 |
| ------------------------------ | --------------------------------------------------------------------------- |
| `GET /api/races?seasonId={id}` | Get all races for season (defaults to current season) with `isCurrent` flag |
| `GET /api/races/{id}`          | Get race by ID                                                              |

### 4. Frontend Contracts

```typescript
// Season.ts
export interface Season {
  id: number;
  year: number;
  startDate: string; // ISO 8601
  endDate: string; // ISO 8601
  isCurrent: boolean; // True if today is within startDate and endDate
}

// Race.ts
export interface Race {
  id: number;
  seasonId: number;
  round: number;
  name: string;
  location: string;
  circuit: string;
  country: string;
  raceDate: string; // ISO 8601
  lockDeadline: string | null;
  isCurrent: boolean; // True if this is the next upcoming race
}
```

### 5. Team Component Update

Replace hardcoded Select (lines 84-102) with:

```tsx
<Select value={selectedRaceId?.toString()} onValueChange={(value) => setSelectedRaceId(Number(value))}>
  <SelectContent>
    {races.map((race) => (
      <SelectItem key={race.id} value={race.id.toString()}>
        <p className="text-muted-foreground font-medium">Round {race.round}</p>
        <h1 className="text-2xl font-bold">{race.location}</h1>
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### 6. Route Loader Update

```typescript
const [team, activeDrivers, activeConstructors, races] = await Promise.all([getMyTeam(), getActiveDrivers(), getActiveConstructors(), getRaces()]);

// Derive current race from races array
const currentRace = races.find((r) => r.isCurrent) ?? races.at(-1);
```

### 7. Seeding Strategy

Runtime seeding in `Program.cs` (development only):

```csharp
if (app.Environment.IsDevelopment())
{
    if (!context.Seasons.Any())
    {
        context.Seasons.AddRange(SeasonSeeds.GetSeasons());
        await context.SaveChangesAsync();
    }

    if (!context.Races.Any())
    {
        var season2026 = await context.Seasons.FirstAsync(s => s.Year == 2026);
        context.Races.AddRange(RaceSeeds.Get2026Races(season2026.Id));
        await context.SaveChangesAsync();
    }
}
```

### 8. Official 2026 F1 Calendar (Seed Data)

| Round | Date   | Race             | Location    | Sprint |
| ----- | ------ | ---------------- | ----------- | ------ |
| 1     | Mar 8  | Australian GP    | Melbourne   |        |
| 2     | Mar 15 | Chinese GP       | Shanghai    | \*     |
| 3     | Mar 29 | Japanese GP      | Suzuka      |        |
| 4     | Apr 12 | Bahrain GP       | Sakhir      |        |
| 5     | Apr 19 | Saudi Arabian GP | Jeddah      |        |
| 6     | May 3  | Miami GP         | Miami       | \*     |
| 7     | May 24 | Canadian GP      | Montreal    | \*     |
| 8     | Jun 7  | Monaco GP        | Monte Carlo |        |
| 9     | Jun 14 | Spanish GP       | Barcelona   |        |
| 10    | Jun 28 | Austrian GP      | Spielberg   |        |
| 11    | Jul 5  | British GP       | Silverstone | \*     |
| 12    | Jul 19 | Belgian GP       | Spa         |        |
| 13    | Jul 26 | Hungarian GP     | Budapest    |        |
| 14    | Aug 23 | Dutch GP         | Zandvoort   | \*     |
| 15    | Sep 6  | Italian GP       | Monza       |        |
| 16    | Sep 13 | Madrid GP        | Madrid      |        |
| 17    | Sep 26 | Azerbaijan GP    | Baku        |        |
| 18    | Oct 11 | Singapore GP     | Singapore   | \*     |
| 19    | Oct 25 | United States GP | Austin      |        |
| 20    | Nov 1  | Mexico City GP   | Mexico City |        |
| 21    | Nov 8  | São Paulo GP     | São Paulo   |        |
| 22    | Nov 21 | Las Vegas GP     | Las Vegas   |        |
| 23    | Nov 29 | Qatar GP         | Lusail      |        |
| 24    | Dec 6  | Abu Dhabi GP     | Abu Dhabi   |        |

\*Sprint weekends: China, Miami, Canada, Britain, Netherlands, Singapore

**Notes:**

- Madrid is a new venue for 2026
- Dutch GP is the final year at Zandvoort
- Imola (Emilia Romagna GP) is no longer on the calendar

---

## Implementation Sequence

1. **Backend Entities & Migration**
   - Create `Season.cs` entity
   - Create `Race.cs` entity
   - Add `DbSet<Season>` and `DbSet<Race>` to ApplicationDbContext
   - Run `dotnet ef migrations add AddSeasonAndRace`
   - Run `dotnet ef database update`

2. **Backend Service Layer**
   - Create `SeasonResponse.cs` and `RaceResponse.cs`
   - Create `SeasonResponseMapper.cs` and `RaceResponseMapper.cs`
   - Create `SeasonService.cs` with `ISeasonService`
   - Create `RaceService.cs` with `IRaceService`
   - Register in `ServiceExtensions.cs`

3. **Backend Endpoints**
   - Create `SeasonEndpoints.cs`
   - Create `RaceEndpoints.cs`
   - Register in `Endpoints.cs`

4. **Seed Data**
   - Create `SeasonSeeds.cs` with 2026 season
   - Create `RaceSeeds.cs` with 2026 calendar
   - Add seeding to `Program.cs`

5. **Backend Tests**
   - Create `SeasonServiceTests.cs`
   - Create `RaceServiceTests.cs`
   - Create `SeasonEndpointsTests.cs`
   - Create `RaceEndpointsTests.cs`

6. **Frontend**
   - Create `Season.ts` and `Race.ts` contracts
   - Create `seasonService.ts` and `raceService.ts`
   - Update route loaders in `router.tsx`
   - Update `Team.tsx` component

7. **Frontend Tests**
   - Create `seasonService.test.ts`
   - Create `raceService.test.ts`

---

## Verification

1. **API Testing**
   - Start API with `npm run api:watch`
   - Verify `GET /api/seasons` returns seasons with `isCurrent` flag
   - Verify one season has `isCurrent: true` (2026)
   - Verify `GET /api/races` returns 24 races with `isCurrent` flag
   - Verify one race has `isCurrent: true` (next upcoming)
   - Verify `GET /api/races/{id}` returns race by ID

2. **Frontend Testing**
   - Start app with `npm run web:dev`
   - Navigate to My Team page
   - Verify race selector shows all 2026 races
   - Verify default selection is current/next race

3. **Unit Tests**
   - Run `npm run api:test` - all tests pass
   - Run `npm run web:test` - all tests pass

4. **Build Verification**
   - Run `npm run api:build` - no errors
   - Run `npm run web:build` - no errors
