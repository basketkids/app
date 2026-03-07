const fs = require('fs');

async function run() {
    const dotenv = require('dotenv');
    dotenv.config({ path: './src/environments/.env' });

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl) {
       console.log("No url found");
       return;
    }
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Testing match_events...");
    const req1 = await supabase.from('match_events').select('*').limit(1);
    console.log("match_events row:", req1.data?.[0] || 'no data', "error:", req1.error?.message || null);

    console.log("\nTesting match_player_stats...");
    const req2 = await supabase.from('match_player_stats').select('*').limit(1);
    console.log("match_player_stats row:", req2.data?.[0] || 'no data', "error:", req2.error?.message || null);

    if (req2.data?.[0]) {
       const req3 = await supabase.from('match_player_stats').select('*, players(*)').limit(1);
       console.log("\njoin result players:", req3.data?.[0]?.players || 'no join data', "error:", req3.error?.message || null);
    }
}
run();
