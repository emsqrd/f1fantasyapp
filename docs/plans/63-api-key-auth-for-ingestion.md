# API Key Auth for Race Result Ingestion (Issue #63)

## Context

PR #62 code review identified that the race result submission endpoints (`PUT /api/races/{raceId}/results/*`) use `.RequireAuthorization()` with no policy, meaning any authenticated Supabase user can submit/overwrite results. These endpoints should only be callable by the ingestion script.

The current ingestion script authenticates via a Supabase email/password user. This is awkward because it's a service, not a user — it requires a bogus admin account with an email address just to satisfy Supabase's user model. A static API key is a better fit: it's the standard pattern for backend scripts and admin tooling, integrates cleanly with ASP.NET Core's multi-scheme auth, and removes the Supabase user dependency entirely.

## Approach

Add a custom `ApiKeyAuthenticationHandler` as a second auth scheme alongside JWT Bearer. The default authorization policy accepts either scheme, so all existing endpoints are unaffected. A named `"ApiKeyOnly"` policy is applied to the PUT result endpoints. The Python script drops its Supabase auth flow and sends an `X-Api-Key` header instead.

## Commit 1: Add API key auth handler and policies

### New files

**`api/F1CompanionApi/Authentication/ApiKeyAuthenticationHandler.cs`**
- Custom `AuthenticationHandler<AuthenticationSchemeOptions>`
- Reads expected key from `IConfiguration["Authentication:ApiKey"]`
- Checks `X-Api-Key` header; uses `CryptographicOperations.FixedTimeEquals` for comparison
- Returns `NoResult` when header is absent (lets JWT scheme handle the request)
- Creates a `ClaimsPrincipal` with `ClaimTypes.Role = "Admin"` on success
- Constants: `SchemeName = "ApiKey"`, `HeaderName = "X-Api-Key"`

**`api/F1CompanionApi.UnitTests/Authentication/ApiKeyAuthenticationHandlerTests.cs`**
- Tests: no header → NoResult, valid key → Success with claims, invalid key → Fail, unconfigured key → Fail

### Modified files

**`api/F1CompanionApi/Extensions/ServiceExtensions.cs`** (lines 105-125)
- Register API key scheme alongside JWT:
  ```csharp
  services.AddAuthentication(options => {
      options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
      options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
  })
  .AddJwtBearer(/* existing config unchanged */)
  .AddScheme<AuthenticationSchemeOptions, ApiKeyAuthenticationHandler>("ApiKey", _ => { });
  ```
- Replace `services.AddAuthorization()` with:
  ```csharp
  services.AddAuthorizationBuilder()
      .AddPolicy("ApiKeyOnly", policy => {
          policy.AuthenticationSchemes.Add("ApiKey");
          policy.RequireAuthenticatedUser();
      })
      .SetDefaultPolicy(new AuthorizationPolicyBuilder(
          JwtBearerDefaults.AuthenticationScheme, "ApiKey")
          .RequireAuthenticatedUser()
          .Build());
  ```

**`api/F1CompanionApi/appsettings.json`** — add `"Authentication": { "ApiKey": "" }`

### Verify
```bash
cd api && dotnet build F1CompanionApi/F1CompanionApi.csproj
cd api && dotnet test F1CompanionApi.UnitTests/F1CompanionApi.UnitTests.csproj
```

---

## Commit 2: Restrict PUT result endpoints to API key only

### Modified files

**`api/F1CompanionApi/Api/Endpoints/RaceResultEndpoints.cs`**
- Split the single `resultsGroup` into two groups sharing the same route prefix:
  - `readGroup` with `.RequireAuthorization()` (default policy — JWT or API key)
  - `writeGroup` with `.RequireAuthorization("ApiKeyOnly")`
- Handler methods (private static) unchanged

Existing `RaceResultEndpointsTests.cs` invokes handler methods via reflection and doesn't test auth — no changes needed.

### Verify
```bash
cd api && dotnet test F1CompanionApi.UnitTests/F1CompanionApi.UnitTests.csproj
```

---

## Commit 3: Switch ingestion script to API key auth

### Modified files

**`api/scripts/ingest_results.py`**
- Remove `authenticate()` function
- Change `create_api_session(token)` → `create_api_session(api_key)` sending `X-Api-Key` header
- Change `load_config()` required keys to `["F1_API_KEY", "F1_API_URL"]`
- Simplify `ingest()`: remove Supabase auth block, replace with `create_api_session(config["F1_API_KEY"])`

**`api/scripts/.env.example`**
```
F1_API_KEY=<your-api-key>
F1_API_URL=http://localhost:5000
```

**`api/scripts/README.md`** — update setup/config instructions to reflect new API key config

### Verify
```bash
cd api/scripts && python3 -m pytest test_ingest_results.py -v
```

---

## Production deployment

```bash
openssl rand -base64 32  # generate key
fly secrets set Authentication__ApiKey="<key>" -a f1fantasyapp
```

Update `api/scripts/.env.prod`:
```
F1_API_KEY=<same-key>
F1_API_URL=https://f1fantasyapp.fly.dev
```

## Key files

| File | Role |
|------|------|
| `api/F1CompanionApi/Authentication/ApiKeyAuthenticationHandler.cs` | New auth handler |
| `api/F1CompanionApi.UnitTests/Authentication/ApiKeyAuthenticationHandlerTests.cs` | Handler tests |
| `api/F1CompanionApi/Extensions/ServiceExtensions.cs` | Auth/policy registration |
| `api/F1CompanionApi/Api/Endpoints/RaceResultEndpoints.cs` | Endpoint auth split |
| `api/F1CompanionApi/appsettings.json` | Config placeholder |
| `api/scripts/ingest_results.py` | Script simplification |
| `api/scripts/.env.example` | Updated config template |
