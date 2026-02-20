-- FORCE UPDATE USER LINKING TRIGGER
-- Run this in Supabase SQL Editor to ensure the linking logic is active.

-- 1. DROP EXISTING
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DROP FUNCTION IF EXISTS public.handle_new_user ();

-- 2. RECREATE FUNCTION WITH LOGGING AND ROBUST LOGIC
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  legacy_profile_id text;
  legacy_email text;
BEGIN
  -- Log for debugging (visible in Supabase Database > Postgres Logs)
  RAISE LOG 'Handle New User Trigger Fired for Email: %', NEW.email;

  -- Check for existing profile by email (case insensitive)
  -- We select ID and Email to be sure
  SELECT id, email INTO legacy_profile_id, legacy_email
  FROM public.profiles 
  WHERE lower(email) = lower(NEW.email)
  LIMIT 1;

  IF legacy_profile_id IS NOT NULL THEN
    RAISE LOG 'Found Legacy Profile ID: % for Email: %', legacy_profile_id, legacy_email;

    -- Legacy profile found: Update ID to new Auth UUID
    -- Cascading FKs will update references in teams, etc.
    -- We perform an UPDATE on the ID itself.
    -- IMPORTANT: This requires ON UPDATE CASCADE on Foreign Keys (which we added in full_schema.sql)
    
    UPDATE public.profiles
    SET id = NEW.id::text,
        updated_at = now()
    WHERE id = legacy_profile_id;
    
    RAISE LOG 'Updated Profile ID from % to %', legacy_profile_id, NEW.id;
    
  ELSE
    RAISE LOG 'No Legacy Profile found. Creating new profile for %', NEW.email;

    -- No legacy profile: Create new
    INSERT INTO public.profiles (id, email, display_name, photo_url)
    VALUES (
      NEW.id::text,
      NEW.email,
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. REBIND TRIGGER
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. VERIFY FKs (Optional check, can't be conditional in SQL script easily, but good to know)
-- Ensure your Foreign Keys in teams, team_members, etc. have ON UPDATE CASCADE.
-- If you ran full_schema.sql, they should have it.