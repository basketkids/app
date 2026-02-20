-- BACKFILL PROFILES FROM AUTH.USERS
-- Run this if you see 406 errors or missing profiles after resetting the database.

INSERT INTO public.profiles (id, email, display_name, photo_url)
SELECT 
    id::text, 
    email, 
    raw_user_meta_data->>'full_name', 
    raw_user_meta_data->>'avatar_url'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- This ensures that every user in Auth has a corresponding public profile.