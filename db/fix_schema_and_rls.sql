-- 1. FIX MATCHES SCHEMA
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS current_period integer DEFAULT 1;

ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS period_duration integer DEFAULT 600;

-- 2. ENABLE RLS (Ensure it's enabled)
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.rivals ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.avatar_configs ENABLE ROW LEVEL SECURITY;

-- 3. ADD POLICIES FOR READ ACCESS
-- Profiles (Public read)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;

CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR
SELECT USING (true);

-- Teams (Public read)
DROP POLICY IF EXISTS "Teams are viewable by everyone." ON public.teams;

CREATE POLICY "Teams are viewable by everyone." ON public.teams FOR
SELECT USING (true);

-- Players (Public read)
DROP POLICY IF EXISTS "Players are viewable by everyone." ON public.players;

CREATE POLICY "Players are viewable by everyone." ON public.players FOR
SELECT USING (true);

-- Competitions (Public read)
DROP POLICY IF EXISTS "Competitions are viewable by everyone." ON public.competitions;

CREATE POLICY "Competitions are viewable by everyone." ON public.competitions FOR
SELECT USING (true);

-- Rivals (Public read)
DROP POLICY IF EXISTS "Rivals are viewable by everyone." ON public.rivals;

CREATE POLICY "Rivals are viewable by everyone." ON public.rivals FOR
SELECT USING (true);

-- Matches (Public read)
DROP POLICY IF EXISTS "Matches are viewable by everyone." ON public.matches;

CREATE POLICY "Matches are viewable by everyone." ON public.matches FOR
SELECT USING (true);

-- Match Events (Public read)
DROP POLICY IF EXISTS "Match events are viewable by everyone." ON public.match_events;

CREATE POLICY "Match events are viewable by everyone." ON public.match_events FOR
SELECT USING (true);

-- Match Player Stats (Public read)
DROP POLICY IF EXISTS "Match player stats are viewable by everyone." ON public.match_player_stats;

CREATE POLICY "Match player stats are viewable by everyone." ON public.match_player_stats FOR
SELECT USING (true);

-- Event Types (Public read)
DROP POLICY IF EXISTS "Event types are viewable by everyone." ON public.event_types;

CREATE POLICY "Event types are viewable by everyone." ON public.event_types FOR
SELECT USING (true);

-- Avatar Configs (Public read)
DROP POLICY IF EXISTS "Avatar configs are viewable by everyone." ON public.avatar_configs;

CREATE POLICY "Avatar configs are viewable by everyone." ON public.avatar_configs FOR
SELECT USING (true);

-- 4. ADD POLICIES FOR WRITE ACCESS (AUTHENTICATED USERS)
-- Allow authenticated users to update matches (For now, broad access to unblock. We can refine later.)
DROP POLICY IF EXISTS "Authenticated users can update matches." ON public.matches;

CREATE POLICY "Authenticated users can update matches." ON public.matches FOR
UPDATE USING (
    auth.role () = 'authenticated'
);

DROP POLICY IF EXISTS "Authenticated users can insert matches." ON public.matches;

CREATE POLICY "Authenticated users can insert matches." ON public.matches FOR
INSERT
WITH
    CHECK (
        auth.role () = 'authenticated'
    );

-- 5. RELOAD SCHEMA CACHE (Trick: Limit 0 query or Notify)
NOTIFY pgrst, 'reload schema';

-- 6. VERIFICATION
DO $$ DECLARE player_count integer;

BEGIN
SELECT count(*) INTO player_count
FROM public.players
WHERE
    team_id = '8c70c50c-4bf6-4692-afd2-1b26c81e0ffa';

RAISE NOTICE 'Player Count for reported team: %',
player_count;

END $$;