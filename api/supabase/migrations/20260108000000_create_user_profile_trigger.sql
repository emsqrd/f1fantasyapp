-- Create trigger to automatically create user profiles when users sign up
-- This ensures atomic profile creation and eliminates race conditions
-- between auth.users creation and profile API calls

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Insert into Accounts table (matches EF Core schema)
  INSERT INTO public."Accounts" (
    "Id",
    "CreatedAt",
    "UpdatedAt",
    "IsActive",
    "IsDeleted",
    "LastLoginAt"
  )
  VALUES (
    NEW.id::text,
    NOW() AT TIME ZONE 'UTC',
    NOW() AT TIME ZONE 'UTC',
    true,
    false,
    NOW() AT TIME ZONE 'UTC'
  );

  -- Insert into UserProfiles table (Id is auto-generated serial)
  INSERT INTO public."UserProfiles" (
    "AccountId",
    "Email",
    "DisplayName",
    "CreatedAt"
  )
  VALUES (
    NEW.id::text,
    NEW.email,
    NEW.raw_user_meta_data->>'displayName',
    NOW() AT TIME ZONE 'UTC'
  );

  RETURN NEW;
END;
$$;

-- Create trigger on auth.users insert
-- This fires automatically when Supabase creates a new user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
