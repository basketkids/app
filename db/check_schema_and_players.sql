-- Check matches table columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE
    table_name = 'matches';

-- Check players for the specific team again
select count(*) as player_count
from players
where
    team_id = '8c70c50c-4bf6-4692-afd2-1b26c81e0ffa';

select id, name, team_id
from players
where
    team_id = '8c70c50c-4bf6-4692-afd2-1b26c81e0ffa'
limit 5;