-- Script to create missing tables if they don't exist
-- Run this in Supabase SQL Editor if you are seeing 404 errors for these tables

-- 1. MATCH REQUESTS
CREATE TABLE IF NOT EXISTS public.match_requests (
  id uuid default uuid_generate_v4() primary key,
  match_id uuid references public.matches(id) on delete cascade not null,
  user_id text references public.profiles(id) on delete cascade not null,
  status text default 'pending', -- 'pending', 'accepted', 'rejected'
  created_at timestamp with time zone default timezone('utc'::text, now())
);

ALTER TABLE public.match_requests ENABLE ROW LEVEL SECURITY;

-- 2. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id text references public.profiles(id) on delete cascade not null,
  type text not null,
  title text,
  message text,
  data jsonb,
  read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 3. TEAM FOLLOWERS
CREATE TABLE IF NOT EXISTS public.team_followers (
  id uuid default uuid_generate_v4() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  user_id text references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  unique(team_id, user_id)
);

ALTER TABLE public.team_followers ENABLE ROW LEVEL SECURITY;

-- 4. PROFILE CREATION TRIGGER (Fixes 406 Not Acceptable / missing profile)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, photo_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing; -- Prevent error if profile already exists
  return new;
end;
$$ language plpgsql security definer;

-- Re-create trigger to ensure it uses the updating function
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();