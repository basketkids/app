-- ==============================================================================
-- UNIFIED BASKETKIDS SUPABASE INITIALIZATION SCRIPT
-- ==============================================================================
-- This script replaces all old fragmented SQL migrations.
-- It drops existing tables (if any), recreates the schema, and sets up RLS.
-- ==============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. DESTROY EXISTING TABLES (ORDER MATTERS DUE TO DEPENDENCIES)
drop table if exists public.match_requests cascade;

drop table if exists public.notifications cascade;

drop table if exists public.team_followers cascade;

drop table if exists public.team_members cascade;

drop table if exists public.match_events cascade;

drop table if exists public.match_player_stats cascade;

drop table if exists public.match_rosters cascade;

drop table if exists public.matches cascade;

drop table if exists public.rivals cascade;

drop table if exists public.competitions cascade;

drop table if exists public.players cascade;

drop table if exists public.teams cascade;

drop table if exists public.profiles cascade;

drop table if exists public.avatar_configs cascade;

drop table if exists public.event_types cascade;

drop table if exists public.contact_messages cascade;

-- 2. CREATE TABLES

-- EVENT TYPES
create table public.event_types (
  id text primary key,
  name text not null,
  icon text,
  default_value integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Seed initial event types
insert into
    public.event_types (id, name, icon, default_value)
values (
        'puntos',
        'Puntos',
        'img/icons/canasta.png',
        0
    ),
    (
        'asistencias',
        'Asistencia',
        'img/icons/asistencia.png',
        0
    ),
    (
        'rebotes',
        'Rebote',
        'img/icons/rebote.png',
        0
    ),
    (
        'robos',
        'Robo',
        'img/icons/robo.png',
        0
    ),
    (
        'tapones',
        'Tapón',
        'img/icons/tapon.png',
        0
    ),
    (
        'faltas',
        'Falta',
        'img/icons/falta.png',
        0
    ),
    (
        'fallo',
        'Fallo',
        'bi-x-circle',
        0
    ),
    (
        'cambioPista',
        'Cambio Pista',
        'bi-arrow-left-right',
        0
    ),
    (
        'inicioCuarto',
        'Inicio Cuarto',
        'bi-play',
        0
    ),
    (
        'finCuarto',
        'Fin Cuarto',
        'bi-stop',
        0
    );

-- AVATAR CONFIGS
create table public.avatar_configs (
  id uuid default uuid_generate_v4() primary key,
  skin_color text,
  top text,
  hair_color text,
  hat_color text,
  facial_hair_type text,
  facial_hair_color text,
  eyes text,
  eyebrows text,
  mouth text,
  accessories_type text,
  accessories_color text,
  clothing text,
  clothes_color text,
  clothing_graphic text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- PROFILES
create table public.profiles (
  id text not null primary key, -- Text to support potential manual IDs, but usually Auth UUID
  email text,
  display_name text,
  photo_url text,
  is_admin boolean default false,
  avatar_config_id uuid references public.avatar_configs(id) on delete set null,
  updated_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- TEAMS
create table public.teams (
  id uuid default uuid_generate_v4() primary key,
  owner_id text references public.profiles(id) on delete cascade on update cascade not null, 
  name text not null,
  coach text,
  club text,
  category text,
  city text,
  color text,
  logo_url text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- PLAYERS
create table public.players (
  id uuid default uuid_generate_v4() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  name text not null,
  number text,
  position text,
  height text,
  weight text,
  birth_date date,
  avatar_config_id uuid references public.avatar_configs(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- COMPETITIONS
create table public.competitions (
  id uuid default uuid_generate_v4() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  name text not null,
  season text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- RIVALS
create table public.rivals (
  id uuid default uuid_generate_v4() primary key,
  competition_id uuid references public.competitions(id) on delete cascade not null,
  name text not null,
  logo_url text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- MATCHES
create table public.matches (
  id uuid default uuid_generate_v4() primary key,
  competition_id uuid references public.competitions(id) on delete cascade not null,
  team_id uuid references public.teams(id) on delete cascade not null,
  rival_id uuid references public.rivals(id) on delete set null,
  rival_name text,
  date timestamp with time zone,
  location text,
  is_local boolean,
  state text,
  match_config text,
  team_score integer default 0,
  rival_score integer default 0,
  chronicle text,
  current_period integer default 1,
  period_duration integer default 600,
  live_state jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- MATCH ROSTERS (Convocatorias)
create table public.match_rosters (
  match_id uuid references public.matches(id) on delete cascade not null,
  player_id uuid references public.players(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  primary key (match_id, player_id)
);

-- MATCH PLAYER STATS
create table public.match_player_stats (
  id uuid default uuid_generate_v4() primary key,
  match_id uuid references public.matches(id) on delete cascade not null,
  player_id uuid references public.players(id) on delete cascade not null,
  dorsal text,
  minutes_played integer default 0,
  points integer default 0,
  rebounds integer default 0,
  asistencias integer default 0,
  robos integer default 0,
  tapones integer default 0,
  faltas integer default 0,
  valoracion integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- MATCH EVENTS
create table public.match_events (
  id uuid default uuid_generate_v4() primary key,
  match_id uuid references public.matches(id) on delete cascade not null,
  type text, 
  event_type_id text references public.event_types(id) on delete set null,
  player_id uuid references public.players(id) on delete set null,
  quarter integer,
  timestamp integer, 
  value integer,
  properties jsonb, 
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- CONTACT MESSAGES
create table public.contact_messages (
  id text primary key,
  name text,
  email text,
  phone text,
  message text,
  timestamp timestamp with time zone,
  read boolean default false,
  archived boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- TEAM MEMBERS
create table public.team_members (
  id uuid default uuid_generate_v4() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  user_id text references public.profiles(id) on delete cascade on update cascade not null,
  role text default 'follower',
  linked_player_id uuid references public.players(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  unique(team_id, user_id)
);

-- TEAM FOLLOWERS
create table public.team_followers (
  id uuid default uuid_generate_v4() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  user_id text references public.profiles(id) on delete cascade on update cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  unique(team_id, user_id)
);

-- NOTIFICATIONS
create table public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id text references public.profiles(id) on delete cascade on update cascade not null,
  type text not null,
  title text,
  message text,
  data jsonb,
  read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- MATCH REQUESTS
create table public.match_requests (
  id uuid default uuid_generate_v4() primary key,
  match_id uuid references public.matches(id) on delete cascade not null,
  user_id text references public.profiles(id) on delete cascade on update cascade not null,
  status text default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. ENABLE RLS (Row Level Security)
alter table public.profiles enable row level security;

alter table public.teams enable row level security;

alter table public.players enable row level security;

alter table public.competitions enable row level security;

alter table public.rivals enable row level security;

alter table public.matches enable row level security;

alter table public.match_rosters enable row level security;

alter table public.match_events enable row level security;

alter table public.match_player_stats enable row level security;

alter table public.team_members enable row level security;

alter table public.team_followers enable row level security;

alter table public.notifications enable row level security;

alter table public.match_requests enable row level security;

alter table public.contact_messages enable row level security;

alter table public.avatar_configs enable row level security;

alter table public.event_types enable row level security;

-- 4. POLICIES

-- READ POLICIES (Public to everyone for simplicity as this is how it worked. Can be tightened later.)
create policy "Allow public read - profiles" ON public.profiles FOR
SELECT USING (true);

create policy "Allow public read - teams" ON public.teams FOR
SELECT USING (true);

create policy "Allow public read - players" ON public.players FOR
SELECT USING (true);

create policy "Allow public read - competitions" ON public.competitions FOR
SELECT USING (true);

create policy "Allow public read - rivals" ON public.rivals FOR
SELECT USING (true);

create policy "Allow public read - matches" ON public.matches FOR
SELECT USING (true);

create policy "Allow public read - match_rosters" ON public.match_rosters FOR
SELECT USING (true);

create policy "Allow public read - match_events" ON public.match_events FOR
SELECT USING (true);

create policy "Allow public read - match_player_stats" ON public.match_player_stats FOR
SELECT USING (true);

create policy "Allow public read - event_types" ON public.event_types FOR
SELECT USING (true);

create policy "Allow public read - avatar_configs" ON public.avatar_configs FOR
SELECT USING (true);

-- WRITE POLICIES (Authenticated Only)
-- Avatars
create policy "Auth can insert avatars" ON public.avatar_configs FOR
INSERT
WITH
    CHECK (
        auth.role () = 'authenticated'
    );

create policy "Auth can update avatars" ON public.avatar_configs FOR
UPDATE USING (
    auth.role () = 'authenticated'
);
-- Profiles
create policy "Auth can insert profiles" ON public.profiles FOR INSERT WITH CHECK (auth.uid()::text = id);

create policy "Auth can update profiles" ON public.profiles FOR UPDATE USING (auth.uid()::text = id);
-- Teams
create policy "Auth can insert teams" ON public.teams FOR
INSERT
WITH
    CHECK (
        auth.role () = 'authenticated'
    );

create policy "Auth can update teams" ON public.teams FOR UPDATE USING (auth.uid()::text = owner_id);
-- Players
create policy "Auth can insert players" ON public.players FOR
INSERT
WITH
    CHECK (
        auth.role () = 'authenticated'
    );

create policy "Auth can update players" ON public.players FOR
UPDATE USING (
    auth.role () = 'authenticated'
);

create policy "Auth can delete players" ON public.players FOR DELETE USING (
    auth.role () = 'authenticated'
);
-- Competitions
create policy "Auth can insert competitions" ON public.competitions FOR
INSERT
WITH
    CHECK (
        auth.role () = 'authenticated'
    );

create policy "Auth can update competitions" ON public.competitions FOR
UPDATE USING (
    auth.role () = 'authenticated'
);
-- Rivals
create policy "Auth can insert rivals" ON public.rivals FOR
INSERT
WITH
    CHECK (
        auth.role () = 'authenticated'
    );

create policy "Auth can update rivals" ON public.rivals FOR
UPDATE USING (
    auth.role () = 'authenticated'
);
-- Matches
create policy "Auth can insert matches" ON public.matches FOR
INSERT
WITH
    CHECK (
        auth.role () = 'authenticated'
    );

create policy "Auth can update matches" ON public.matches FOR
UPDATE USING (
    auth.role () = 'authenticated'
);

create policy "Auth can delete matches" ON public.matches FOR DELETE USING (
    auth.role () = 'authenticated'
);
-- Match Rosters
create policy "Auth can insert rosters" ON public.match_rosters FOR
INSERT
WITH
    CHECK (
        auth.role () = 'authenticated'
    );

create policy "Auth can delete rosters" ON public.match_rosters FOR DELETE USING (
    auth.role () = 'authenticated'
);
-- Match Events
create policy "Auth can insert match events" ON public.match_events FOR
INSERT
WITH
    CHECK (
        auth.role () = 'authenticated'
    );

create policy "Auth can update match events" ON public.match_events FOR
UPDATE USING (
    auth.role () = 'authenticated'
);

create policy "Auth can delete match events" ON public.match_events FOR DELETE USING (
    auth.role () = 'authenticated'
);
-- Match Player Stats
create policy "Auth can insert match stats" ON public.match_player_stats FOR
INSERT
WITH
    CHECK (
        auth.role () = 'authenticated'
    );

create policy "Auth can update match stats" ON public.match_player_stats FOR
UPDATE USING (
    auth.role () = 'authenticated'
);
-- Contact Messages
create policy "Auth can insert contact messages" ON public.contact_messages FOR
INSERT
WITH
    CHECK (
        auth.role () = 'authenticated'
    );
-- Notifications
create policy "Auth can insert notifications" ON public.notifications FOR
INSERT
WITH
    CHECK (
        auth.role () = 'authenticated'
    );

create policy "Auth can update notifications" ON public.notifications FOR
UPDATE USING (
    auth.role () = 'authenticated'
);
-- Match Requests
create policy "Auth can insert match requests" ON public.match_requests FOR
INSERT
WITH
    CHECK (
        auth.role () = 'authenticated'
    );

create policy "Auth can update match requests" ON public.match_requests FOR
UPDATE USING (
    auth.role () = 'authenticated'
);
-- Team Members
create policy "Auth can insert team members" ON public.team_members FOR
INSERT
WITH
    CHECK (
        auth.role () = 'authenticated'
    );

create policy "Auth can update team members" ON public.team_members FOR
UPDATE USING (
    auth.role () = 'authenticated'
);

create policy "Auth can delete team members" ON public.team_members FOR DELETE USING (
    auth.role () = 'authenticated'
);
-- Team Followers
create policy "Auth can insert team followers" ON public.team_followers FOR
INSERT
WITH
    CHECK (
        auth.role () = 'authenticated'
    );

create policy "Auth can delete team followers" ON public.team_followers FOR DELETE USING (
    auth.role () = 'authenticated'
);

-- 5. TRIGGER FOR NEW USER HANDLING (Smart Linking)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  legacy_profile_id text;
  legacy_email text;
BEGIN
  -- Check for existing profile by email
  SELECT id, email INTO legacy_profile_id, legacy_email
  FROM public.profiles 
  WHERE lower(email) = lower(NEW.email)
  LIMIT 1;

  IF legacy_profile_id IS NOT NULL THEN
    UPDATE public.profiles
    SET id = NEW.id::text,
        updated_at = now()
    WHERE id = legacy_profile_id;
  ELSE
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

-- Bind trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';