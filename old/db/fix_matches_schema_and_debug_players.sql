-- 1. ADD MISSING COLUMNS TO MATCHES
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS current_period integer DEFAULT 1;

ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS period_duration integer DEFAULT 600;

-- 2. CHECK PLAYERS FOR THE REPORTED TEAM
-- User reported team_id: 8c70c50c-4bf6-4692-afd2-1b26c81e0ffa
DO $$
DECLARE
    player_count integer;
    team_exists boolean;
BEGIN
    SELECT EXISTS(SELECT 1 FROM public.teams WHERE id = '8c70c50c-4bf6-4692-afd2-1b26c81e0ffa') INTO team_exists;
    SELECT count(*) INTO player_count FROM public.players WHERE team_id = '8c70c50c-4bf6-4692-afd2-1b26c81e0ffa';
    
    RAISE NOTICE 'Team 8c70c50c... Exists: %', team_exists;
    RAISE NOTICE 'Player Count for Team 8c70c50c...: %', player_count;
END $$;

-- 3. RETURN PLAYERS IF ANY (For UI confirmation)
SELECT id, name, number
FROM public.players
WHERE
    team_id = '8c70c50c-4bf6-4692-afd2-1b26c81e0ffa';