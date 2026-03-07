import { TeamRepository } from './team.repository';
import { SupabaseDataClient } from './supabase.client';
import { describe, it, expect, beforeAll } from 'vitest';

describe('TeamRepository Integration Test', () => {
    let supabaseClient: SupabaseDataClient;
    let repo: TeamRepository;

    beforeAll(async () => {
        supabaseClient = new SupabaseDataClient();
        repo = new TeamRepository(supabaseClient);

        const testUser = process.env['TEST_USER'];
        const testPass = process.env['TEST_PASS'];
        const testToken = process.env['TEST_TOKEN'];

        if (testToken) {
            console.log(`[Integration Test - TeamRepo] Authenticating using provided access token`);
            const { error } = await supabaseClient.instance.auth.setSession({
                access_token: testToken,
                refresh_token: testToken
            });
            if (error) {
                console.error('[Integration Test - TeamRepo] Authentication via token failed:', error.message);
            } else {
                console.log('[Integration Test - TeamRepo] Authentication via token successful.');
            }
        } else if (testUser && testPass) {
            console.log(`[Integration Test - TeamRepo] Authenticating as: ${testUser}`);
            const { error } = await supabaseClient.instance.auth.signInWithPassword({
                email: testUser,
                password: testPass,
            });
            if (error) {
                console.error('[Integration Test - TeamRepo] Authentication failed:', error.message);
            } else {
                console.log('[Integration Test - TeamRepo] Authentication successful.');
            }
        } else {
            console.log('[Integration Test - TeamRepo] Running without authentication. Please set TEST_USER/TEST_PASS or TEST_TOKEN if RLS errors occur.');
        }
    });

    it('should fetch a team and display its data', async () => {
        // Find a recent team ID to test with
        const { data, error } = await supabaseClient.instance
            .from('teams')
            .select('id')
            .limit(1);

        expect(error).toBeNull();
        expect(data).toBeDefined();

        if (data && data.length > 0) {
            const teamId = data[0].id;
            console.log(`[Integration Test - TeamRepo] Fetching team with ID: ${teamId}`);

            const team = await repo.getTeamById(teamId);

            console.log('\n================ TEAM DATA LAYER VERIFICATION ================');
            console.log(JSON.stringify(team, null, 2));
            console.log('==============================================================\n');

            expect(team).toBeDefined();
            expect(team?.id).toBe(teamId);
            expect(team?.name).toBeDefined();

            console.log(`[Integration Test - TeamRepo] Fetching roster for team with ID: ${teamId}`);

            const roster = await repo.getTeamRoster(teamId);

            console.log('\n================ TEAM ROSTER VERIFICATION ====================');
            console.log(JSON.stringify(roster, null, 2));
            console.log('==============================================================\n');

            expect(roster).toBeDefined();

        } else {
            console.log('No teams found in the database to test.');
        }
    });
});
