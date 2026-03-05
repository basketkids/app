-- Allow authenticated users to insert match events
DROP POLICY IF EXISTS "Authenticated users can insert match events." ON public.match_events;

CREATE POLICY "Authenticated users can insert match events." ON public.match_events FOR
INSERT
WITH
    CHECK (
        auth.role () = 'authenticated'
    );

-- Also ensure they can DELETE their events (or all authenticated for now to unblock)
DROP POLICY IF EXISTS "Authenticated users can delete match events." ON public.match_events;

CREATE POLICY "Authenticated users can delete match events." ON public.match_events FOR DELETE USING (
    auth.role () = 'authenticated'
);

-- Verify
NOTIFY pgrst, 'reload schema';