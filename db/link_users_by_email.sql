-- 1. DROP EXISTING CONSTRAINTS AND RE-ADD WITH ON UPDATE CASCADE
-- This allows us to update the profile ID (from Firebase UID to Supabase UUID)
-- and have it automatically update all derived tables (teams, members, etc.)

-- TEAMS
ALTER TABLE public.teams
DROP CONSTRAINT IF EXISTS teams_owner_id_fkey;

ALTER TABLE public.teams
ADD CONSTRAINT teams_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles (id) ON DELETE CASCADE ON UPDATE CASCADE;

-- TEAM MEMBERS (user_id)
ALTER TABLE public.team_members
DROP CONSTRAINT IF EXISTS team_members_user_id_fkey;

ALTER TABLE public.team_members
ADD CONSTRAINT team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles (id) ON DELETE CASCADE ON UPDATE CASCADE;

-- TEAM FOLLOWERS (user_id)
ALTER TABLE public.team_followers
DROP CONSTRAINT IF EXISTS team_followers_user_id_fkey;

ALTER TABLE public.team_followers
ADD CONSTRAINT team_followers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles (id) ON DELETE CASCADE ON UPDATE CASCADE;

-- NOTIFICATIONS (user_id)
ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles (id) ON DELETE CASCADE ON UPDATE CASCADE;

-- MATCH REQUESTS (user_id)
ALTER TABLE public.match_requests
DROP CONSTRAINT IF EXISTS match_requests_user_id_fkey;

ALTER TABLE public.match_requests
ADD CONSTRAINT match_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles (id) ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. UPDATE THE TRIGGER TO LINK BY EMAIL
-- This trigger will run when a user Signs Up or Logs In (if inserted into auth.users)
-- It searches for a profile with the same EMAIL.
-- If found, it UPDATES the profile's ID to the new Auth UUID (linking the data).
-- If not found, it creates a new profile.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  legacy_profile_id text;
BEGIN
  -- Check if a legacy profile exists with this email
  -- We match LOWER(email) to be safe
  SELECT id INTO legacy_profile_id 
  FROM public.profiles 
  WHERE lower(email) = lower(NEW.email)
  LIMIT 1;

  IF legacy_profile_id IS NOT NULL THEN
    -- A legacy profile exists (from Firebase import)
    -- Update its ID to match the new Supabase Auth UUID.
    -- Thanks to ON UPDATE CASCADE, this updates teams, followers, etc.
    UPDATE public.profiles
    SET id = NEW.id::text,
        updated_at = now()
    WHERE id = legacy_profile_id;
    
  ELSE
    -- No legacy profile found, create a completely new one
    INSERT INTO public.profiles (id, email, display_name, photo_url)
    VALUES (
      NEW.id::text,
      NEW.email,
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING; -- Safety net
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger is set (using the standard name from schema)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. MANUAL FIX FOR CURRENT USER (Optional helper)
-- If you have already created a user in Auth but it's not linked,
-- you might need to manually trigger an update or delete the Auth user and sign up again.
-- Or run a manual update query like:
-- UPDATE public.profiles SET id = 'NEW_UUID' WHERE email = 'YOUR_EMAIL' AND id != 'NEW_UUID';