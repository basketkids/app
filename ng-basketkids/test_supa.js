const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function run() {
  const envFile = fs.readFileSync('/media/disco/dades/src/basketKids/app/ng-basketkids/src/environments/environment.ts', 'utf8');
  const urlMatch = envFile.match(/supabaseUrl:\s*'([^']+)'/);
  const keyMatch = envFile.match(/supabaseKey:\s*'([^']+)'/);

  if (urlMatch && keyMatch) {
    const supabase = createClient(urlMatch[1], keyMatch[1]);
    const res = await supabase.from('match_player_stats').select('match_id, points, faltas, fouls, asistencias, assists, rebotes, rebounds, robos, steals, tapones, blocks, matches!inner(id, date, team_score, rival_score, rival_name, state, competition_id)').limit(1);
    console.log('RESULT:', JSON.stringify(res, null, 2));
  }
}
run();
