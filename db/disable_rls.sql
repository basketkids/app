-- EXPLICITLY DISABLE ROW LEVEL SECURITY (RLS)
-- Run this to allow bulk inserts/updates during migration without policy errors.

alter table public.profiles disable row level security;

alter table public.teams disable row level security;

alter table public.players disable row level security;

alter table public.competitions disable row level security;

alter table public.rivals disable row level security;

alter table public.matches disable row level security;

alter table public.match_events disable row level security;

alter table public.match_player_stats disable row level security;

alter table public.team_members disable row level security;

alter table public.team_followers disable row level security;

alter table public.notifications disable row level security;

alter table public.match_requests disable row level security;

alter table public.contact_messages disable row level security;

-- Verify status (optional view)
-- select tablename, rowsecurity from pg_tables where schemaname = 'public';