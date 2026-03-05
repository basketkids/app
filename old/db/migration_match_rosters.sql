-- SQL Migration to create match_rosters table for relational convocatoria

CREATE TABLE IF NOT EXISTS public.match_rosters (
  match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  player_id uuid REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (match_id, player_id)
);

-- Enable RLS
ALTER TABLE public.match_rosters ENABLE ROW LEVEL SECURITY;

-- Allow public access for now (or team admins if you have policies set up)
CREATE POLICY "Enable read access for all users" ON public.match_rosters FOR
SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON public.match_rosters FOR
INSERT
WITH
    CHECK (true);

CREATE POLICY "Enable delete for all users" ON public.match_rosters FOR DELETE USING (true);

-- End of migration