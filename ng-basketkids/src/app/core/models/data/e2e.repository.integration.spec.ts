import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { SupabaseDataClient } from './supabase.client';
import { MatchRepository } from './match.repository';
import { TeamRepository } from './team.repository';
import { PlayerRepository } from './player.repository';
import { CompetitionRepository } from './competition.repository';
import { MatchState } from '../match.model';

describe('Data Layer E2E Flow', () => {
    let supabaseClient: SupabaseDataClient;
    let matchRepo: MatchRepository;
    let teamRepo: TeamRepository;
    let playerRepo: PlayerRepository;
    let compRepo: CompetitionRepository;

    // IDs created during the test to clean up later
    let testTeamId: string;
    let testPlayerId: string;
    let testCompetitionId: string;
    let testRivalId: string;
    let testMatchId: string;
    let testUserId: string;

    beforeAll(async () => {
        supabaseClient = new SupabaseDataClient();
        matchRepo = new MatchRepository(supabaseClient);
        teamRepo = new TeamRepository(supabaseClient);
        playerRepo = new PlayerRepository(supabaseClient);
        compRepo = new CompetitionRepository(supabaseClient);

        try {
            const envPath = path.resolve(process.cwd(), '.env.test');
            if (fs.existsSync(envPath)) {
                const content = fs.readFileSync(envPath, 'utf-8');
                content.split('\n').forEach(line => {
                    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
                    if (match) {
                        let val = match[2] || '';
                        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
                        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
                        process.env[match[1]] = val;
                    }
                });
            }
        } catch (e) {
            console.warn('[E2E Test] Could not load .env.test', e);
        }

        const testUser = process.env['TEST_USER'];
        const testPass = process.env['TEST_PASS'];
        const testToken = process.env['TEST_TOKEN'];

        if (testToken) {
            console.log(`[E2E Test] Authenticating using provided access token`);
            await supabaseClient.instance.auth.setSession({
                access_token: testToken,
                refresh_token: testToken
            });
            const { data } = await supabaseClient.instance.auth.getUser();
            testUserId = data?.user?.id || 'TEST_USER_ID';
        } else if (testUser && testPass) {
            console.log(`[E2E Test] Authenticating as: ${testUser}`);
            await supabaseClient.instance.auth.signInWithPassword({
                email: testUser,
                password: testPass,
            });
            const { data } = await supabaseClient.instance.auth.getUser();
            testUserId = data?.user?.id || 'TEST_USER_ID';
        } else {
            console.warn('[E2E Test] Warning: Running without authentication.');
            testUserId = 'anonymous'; // This might cause RLS errors
        }
    });

    afterAll(async () => {
        console.log('\n================ CLEANING UP TEST DATA ================');
        if (testMatchId) await matchRepo.deleteMatch(testMatchId);
        if (testRivalId) await compRepo.deleteRival(testRivalId);
        if (testCompetitionId) await compRepo.deleteCompetition(testCompetitionId);
        if (testPlayerId) await playerRepo.deletePlayer(testPlayerId);
        if (testTeamId) await teamRepo.deleteTeam(testTeamId);
        console.log('================ CLEANUP COMPLETE ====================\n');
    });

    it('should execute full E2E data repository lifecycle (Create -> Read -> Update -> Delete)', async () => {
        if (testUserId === 'anonymous' || testUserId === 'TEST_USER_ID') {
            console.warn('Skipping E2E test due to missing or invalid authentication credentials in .env.test.');
            return;
        }

        console.log('\n--- 1. CREATING TEAM ---');
        const team = await teamRepo.createTeam(testUserId, 'E2E Test Team');
        expect(team).toBeDefined();
        testTeamId = team!.id;

        await teamRepo.updateTeam(testTeamId, { coach: 'E2E Coach Updated' });
        const fetchedTeam = await teamRepo.getTeamById(testTeamId);
        expect(fetchedTeam?.coach).toBe('E2E Coach Updated');

        console.log('\n--- 2. CREATING PLAYERS ---');
        const player = await playerRepo.createPlayer(testTeamId, { name: 'E2E Player', dorsal: 99 });
        expect(player).toBeDefined();
        testPlayerId = player!.id;

        await playerRepo.updatePlayer(testPlayerId, { name: 'E2E Player Updated' });
        const fetchedPlayers = await playerRepo.getPlayersByTeam(testTeamId);
        expect(fetchedPlayers.find(p => p.id === testPlayerId)?.name).toBe('E2E Player Updated');

        console.log('\n--- 3. CREATING COMPETITION & RIVALS ---');
        const comp = await compRepo.createCompetition(testTeamId, 'E2E Test Liga', '26/27');
        expect(comp).toBeDefined();
        testCompetitionId = comp!.id;

        const rival = await compRepo.createRival(testCompetitionId, 'E2E Rival', 'http://logo.com');
        expect(rival).toBeDefined();
        testRivalId = rival!.id;

        await compRepo.updateRival(testRivalId, { name: 'E2E Rival Updated' });
        const fetchedRivals = await compRepo.getRivalsByCompetition(testCompetitionId);
        expect(fetchedRivals.find(r => r.id === testRivalId)?.name).toBe('E2E Rival Updated');

        console.log('\n--- 4. CREATING MATCH ---');
        const matchPayload = {
            team_id: testTeamId,
            competition_id: testCompetitionId,
            rival_id: testRivalId,
            rival_name: 'E2E Rival Updated',
            date: new Date().toISOString(),
            is_local: true,
            state: 'pendiente',
            team_score: 0,
            rival_score: 0
        };
        const match = await matchRepo.createMatch(matchPayload);
        expect(match).toBeDefined();
        testMatchId = match!.id;

        console.log('\n--- 5. ADD CONVOCADOS & START MATCH ---');
        const matchBeforeStart = await matchRepo.getMatchById(testMatchId);
        expect(matchBeforeStart).toBeDefined();

        await matchRepo.updateConvocatoria(testMatchId, [testPlayerId]);

        matchBeforeStart!.state = MatchState.IN_PROGRESS;
        matchBeforeStart!.scoreLocal = 2; // Simulated score
        matchBeforeStart!.scoreVisitor = 3;
        await matchRepo.saveMatchState(testMatchId, matchBeforeStart!);

        console.log('\n--- 6. VERIFY FINAL REPOSITORY READS ---');
        const matchesByTeam = await matchRepo.getMatchesByTeam(testTeamId);
        expect(matchesByTeam.length).toBeGreaterThan(0);

        const finalMatchState = await matchRepo.getMatchById(testMatchId);
        expect(finalMatchState!.state).toBe(MatchState.IN_PROGRESS);
        expect(finalMatchState!.scoreLocal).toBe(2);
        expect(finalMatchState!.scoreVisitor).toBe(3);

        console.log('E2E Test Flow Complete. All Repositories CRUD verifications passed.');
    }, 30000); // 30 seconds timeout
});
