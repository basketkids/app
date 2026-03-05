-- FIX 406 NOT ACCEPTABLE (Missing Profile)
-- Run this in Supabase SQL Editor

-- 1. Insert missing profile for the specific user ID reported
INSERT INTO public.profiles (id, email, display_name, photo_url)
SELECT 
    id::text, 
    email, 
    COALESCE(raw_user_meta_data->>'full_name', 'Usuario Recuperado'), 
    raw_user_meta_data->>'avatar_url'
FROM auth.users
WHERE id = 'f67cea0a-7521-4beb-908f-ec1870a16f43' -- ID from your error log
ON CONFLICT (id) DO NOTHING;

-- 2. Verify it exists now
SELECT *
FROM public.profiles
WHERE
    id = 'f67cea0a-7521-4beb-908f-ec1870a16f43';