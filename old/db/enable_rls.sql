-- RE-ENABLE ROW LEVEL SECURITY (RLS)
-- Run this AFTER migration to secure your database.

alter table public.profiles enable row level security;

alter table public.teams enable row level security;

alter table public.players enable row level security;

alter table public.competitions enable row level security;

alter table public.rivals enable row level security;

alter table public.matches enable row level security;

alter table public.match_events enable row level security;

alter table public.match_player_stats enable row level security;

alter table public.team_members enable row level security;

alter table public.team_followers enable row level security;

alter table public.notifications enable row level security;

alter table public.match_requests enable row level security;

alter table public.contact_messages enable row level security;

-- IMPORTANT: Ensure you have POLICIES defined, otherwise no one can access the data!
-- Example Policy (Uncomment to apply basic read access if needed):
-- create policy "Public Read Access" on public.profiles for select using (true);