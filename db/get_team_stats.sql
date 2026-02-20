CREATE OR REPLACE FUNCTION public.get_team_stats(query_team_id uuid)
RETURNS TABLE (
  player_id uuid,
  puntos bigint,
  asistencias bigint,
  rebotes bigint,
  robos bigint,
  tapones bigint,
  faltas bigint,
  tiros_fallados bigint,
  partidos_jugados bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    me.player_id,
    -- Puntos
    SUM(CASE 
      WHEN me.type IN ('puntos', 'point') OR me.event_type_id IN ('puntos', 'point') THEN COALESCE(me.value, 0)
      WHEN me.type = 'point_1' OR me.event_type_id = 'point_1' THEN 1
      WHEN me.type = 'point_2' OR me.event_type_id = 'point_2' THEN 2
      WHEN me.type = 'point_3' OR me.event_type_id = 'point_3' THEN 3
      ELSE 0 
    END) as puntos,
    -- Asistencias
    SUM(CASE WHEN me.type IN ('asistencias', 'assist') OR me.event_type_id IN ('asistencias', 'assist') THEN COALESCE(me.value, 1) ELSE 0 END) as asistencias,
    -- Rebotes
    SUM(CASE WHEN me.type IN ('rebotes', 'rebound') OR me.event_type_id IN ('rebotes', 'rebound') THEN COALESCE(me.value, 1) ELSE 0 END) as rebotes,
    -- Robos
    SUM(CASE WHEN me.type IN ('robos', 'steal') OR me.event_type_id IN ('robos', 'steal') THEN COALESCE(me.value, 1) ELSE 0 END) as robos,
    -- Tapones
    SUM(CASE WHEN me.type IN ('tapones', 'block') OR me.event_type_id IN ('tapones', 'block') THEN COALESCE(me.value, 1) ELSE 0 END) as tapones,
    -- Faltas
    SUM(CASE WHEN me.type IN ('faltas', 'foul') OR me.event_type_id IN ('faltas', 'foul') THEN COALESCE(me.value, 1) ELSE 0 END) as faltas,
    -- Tiros Fallados (Sum of their values, e.g. a missed 3pt counts as 1 miss? Or do we want the value associated? 
    -- Valuation usually subtracts 1 for each missed shot.
    -- App logic was: if val=1 t1_fallados+=1.
    -- So we just want COUNT of misses.
    -- But 'value' might be the points attempting?
    -- TeamApp logic: if type='fallo', count++.
    -- So we sum 1 for each miss event.
    SUM(CASE WHEN me.type IN ('fallo', 'miss') OR me.event_type_id IN ('fallo', 'miss') THEN 1 ELSE 0 END) as tiros_fallados,
    
    -- Partidos Jugados (Count distinct match_ids)
    COUNT(DISTINCT me.match_id) as partidos_jugados
  FROM match_events me
  JOIN matches m ON me.match_id = m.id
  WHERE m.team_id = query_team_id
  AND me.player_id IS NOT NULL
  GROUP BY me.player_id;
END;
$$ LANGUAGE plpgsql;