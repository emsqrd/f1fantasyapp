# F1CompanionApi.IntegrationTests

Integration tests that boot the real API in-process via `WebApplicationFactory<Program>`
against a disposable Postgres container managed by [Testcontainers](https://testcontainers.com/).
Authentication is stubbed via `TestAuthHandler` rather than hitting Supabase, so these
are not full end-to-end tests — they cover the API as a cohesive unit (routing,
middleware, authorization policies, EF migrations, DB constraints) against a real
database.

Use this project to assert **user-observable outcomes through the HTTP boundary** —
what a caller sends, what they get back, and what they see on the next request. Unit
tests (in `F1CompanionApi.UnitTests`) remain the authoritative layer for computation
correctness (e.g. point totals per position).

## Running

```bash
npm run api:test:integration   # from repo root
```

**Requirements:** Docker Desktop must be running. Testcontainers surfaces a clear
error if it is not.

## Fixture lifecycle

- **`PostgresFixture`** — xUnit collection fixture that starts one `postgres:16-alpine`
  container for the whole test run and applies EF migrations once. All test classes
  share the same container and schema via `IntegrationTestCollection`.
- **`IntegrationTestBase`** — base class for every test class. Before each test it
  creates a fresh `ApiWebApplicationFactory` and runs Respawn to truncate every
  table except `__EFMigrationsHistory`. Tests start from an empty database and
  must seed any catalog data (drivers, constructors, seasons, …) they depend on.

## Authentication

`TestAuthHandler` replaces the JWT Bearer scheme. Send requests with:

- `X-Test-User-Id: <account-id>` — the value lands on
  `ClaimTypes.NameIdentifier`, mirroring how `SupabaseAuthService` reads a real Supabase JWT.
- `X-Test-User-Email: <email>` — optional, lands on `ClaimTypes.Email`.

Prefer the `factory.CreateAuthenticatedAsync()` extension (in `AuthenticatedClient`) —
it seeds an Account + UserProfile and returns a preconfigured `HttpClient`.

The `ApiKey` scheme (used by scoring ingest endpoints) is left intact. Use
`ApiWebApplicationFactory.TestApiKey` as the value for the `X-Api-Key` header.

## When to reach for integration vs. unit tests

- Integration: routing, middleware, auth, DB constraints/migrations, multi-service
  compositions, anything that only breaks against real Postgres (JSON ops, `DISTINCT ON`,
  unique indexes, case sensitivity).
- Unit: single-service business logic, scoring math, edge cases in a service's own logic.
