-- Enable Row Level Security on every public-schema table as defense-in-depth
-- against the Supabase anon/authenticated REST surface. The .NET API bypasses
-- RLS via a privileged role, so no policies are needed.

-- Enables RLS on each public-schema table created by the firing CREATE TABLE
-- statement, except __EFMigrationsHistory.
CREATE OR REPLACE FUNCTION public.enable_rls_on_new_public_tables()
RETURNS event_trigger AS $$
DECLARE r record;
BEGIN
    FOR r IN SELECT * FROM pg_event_trigger_ddl_commands()
    LOOP
        IF r.schema_name = 'public' AND r.object_identity <> 'public."__EFMigrationsHistory"' THEN
            EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', r.object_identity);
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Wires the function to fire on every CREATE TABLE.
DROP EVENT TRIGGER IF EXISTS auto_enable_rls_public;
CREATE EVENT TRIGGER auto_enable_rls_public
ON ddl_command_end
WHEN TAG IN ('CREATE TABLE')
EXECUTE FUNCTION public.enable_rls_on_new_public_tables();
