-- Backfill profiles for existing users
-- Run this in Supabase SQL Editor to fix the 406 error for existing users

INSERT INTO
    public.profiles (
        id,
        email,
        display_name,
        photo_url
    )
SELECT
    id,
    email,
    raw_user_meta_data ->> 'full_name',
    raw_user_meta_data ->> 'avatar_url'
FROM auth.users ON CONFLICT (id) DO NOTHING;

-- Verification: Check if your user exists now
-- SELECT * FROM public.profiles WHERE id = 'f67cea0a-7521-4beb-908f-ec1870a16f43';