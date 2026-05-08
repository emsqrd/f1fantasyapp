# Supabase Migrations

This directory contains SQL migrations for Supabase-specific features including storage buckets, Row Level Security (RLS) policies, and authentication settings.

## Important: These are NOT Entity Framework Migrations

- **EF Core Migrations**: Located in `F1CompanionApi/Data/Migrations/` - manage PostgreSQL schema (tables, columns, etc.)
- **Supabase Migrations**: Located here - manage Supabase features (storage, RLS policies, auth)

## Migration Naming Convention

Migrations follow the timestamp format: `YYYYMMDDHHMMSS_description.sql`

Example: `20241215000000_create_avatars_storage.sql`

## Running Migrations

### Local Development

Migrations can be applied using the Supabase CLI:

```bash
# Apply all pending migrations
supabase db push

# Or reset and apply all migrations
supabase db reset
```

### Manual Application

If you need to manually run a migration in your local Supabase:

1. Open Supabase Studio: http://localhost:54323
2. Go to SQL Editor
3. Copy the contents of the migration file
4. Execute the SQL

### Production

Migrations are automatically applied when deploying to Supabase Cloud using:

```bash
supabase db push
```

## Troubleshooting

**Error: "new row violates row-level security policy"**

- Ensure the avatars bucket exists
- Verify RLS policies are applied
- Check that the user is authenticated
- Confirm the file path follows the pattern: `{userId}/{filename}`

**Bucket already exists**

- The migration uses `ON CONFLICT DO NOTHING` so it's safe to run multiple times
- If you manually created the bucket, the migration will skip creation and only add policies
