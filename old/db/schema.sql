-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- NOTA SOBRE CREATE DATABASE:
-- En Supabase, la base de datos ya está creada (por defecto 'postgres').
-- No es necesario ejecutar 'CREATE DATABASE'. Este script crea las tablas en el esquema 'public'.

-- DESTROY EXISTING TABLES (ORDER MATTERS DUE TO DEPENDENCIES)
drop table if exists public.match_requests cascade;

drop table if exists public.notifications cascade;

drop table if exists public.team_followers cascade;

drop table if exists public.team_members cascade;

drop table if exists public.match_events cascade;

drop table if exists public.match_player_stats cascade;

drop table if exists public.matches cascade;

drop table if exists public.rivals cascade;

drop table if exists public.competitions cascade;

drop table if exists public.players cascade;

drop table if exists public.teams cascade;

drop table if exists public.profiles cascade;

drop table if exists public.avatar_configs cascade;

drop table if exists public.event_types cascade;

drop table if exists public.contact_messages cascade;

-- EVENT TYPES
create table public.event_types (
  id text primary key, -- 'puntos', 'falta', etc.
  name text not null,
  icon text, -- URL or class name for the icon
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
  id text not null primary key, -- Firebase UID (Text)
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
  owner_id text references public.profiles(id) on delete cascade not null, -- References Firebase UID
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
  rival_name text, -- Denormalized in case rival deleted or not linked
  date timestamp with time zone,
  location text,
  is_local boolean,
  state text, -- 'scheduled', 'live', 'finished'
  match_config text, -- '4x10', '6x8', etc.
  team_score integer default 0,
  rival_score integer default 0,
  chronicle text, -- AI generated summary
  live_state jsonb, -- Full state dump for strict playback
  created_at timestamp with time zone default timezone('utc'::text, now())
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

-- CONTACT MESSAGES
create table public.contact_messages (
  id text primary key, -- Firebase ID
  name text,
  email text,
  phone text,
  message text,
  timestamp bigint,
  read boolean default false,
  archived boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- MATCH EVENTS
create table public.match_events (
  id uuid default uuid_generate_v4() primary key,
  match_id uuid references public.matches(id) on delete cascade not null,
  type text, -- Deprecated in favor of event_type_id, but kept for raw string if needed? No, let's use event_type_id as primary.
  event_type_id text references public.event_types(id) on delete set null,
  player_id uuid references public.players(id) on delete set null, -- Linked player
  quarter integer,
  timestamp integer, -- Seconds from start?
  value integer,
  properties jsonb, -- Extra data
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- POLICIES (Simple Setup - ADJUST AS NEEDED)
-- Enable RLS
alter table public.profiles enable row level security;

alter table public.teams enable row level security;

alter table public.players enable row level security;

alter table public.competitions enable row level security;

alter table public.rivals enable row level security;

alter table public.matches enable row level security;

alter table public.match_events enable row level security;

-- MIGRATION HELPERS
-- alter table public.profiles disable row level security;

-- TEAM MEMBERS
create table public.team_members (
  id uuid default uuid_generate_v4() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  user_id text references public.profiles(id) on delete cascade not null,
  role text default 'follower', -- 'admin', 'editor', 'follower'
  linked_player_id uuid references public.players(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  unique(team_id, user_id)
);

-- TEAM FOLLOWERS
create table public.team_followers (
  id uuid default uuid_generate_v4() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  user_id text references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  unique(team_id, user_id)
);

-- NOTIFICATIONS
create table public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id text references public.profiles(id) on delete cascade not null,
  type text not null,
  title text,
  message text,
  data jsonb,
  read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS for new tables
alter table public.team_members enable row level security;

alter table public.team_followers enable row level security;

alter table public.notifications enable row level security;

-- MATCH REQUESTS
create table public.match_requests (
  id uuid default uuid_generate_v4() primary key,
  match_id uuid references public.matches(id) on delete cascade not null,
  user_id text references public.profiles(id) on delete cascade not null,
  status text default 'pending', -- 'pending', 'accepted', 'rejected'
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.match_requests enable row level security;

-- TRIGGER FOR NEW PLAYERS
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, photo_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();