import { MatchRepository } from './match.repository';
import { SupabaseDataClient } from './supabase.client';
import { describe, it, expect, beforeAll } from 'vitest';

describe('MatchRepository Integration Test', () => {
    let supabaseClient: SupabaseDataClient;
    let repo: MatchRepository;

    beforeAll(async () => {
        // Inicializamos el cliente
        supabaseClient = new SupabaseDataClient();
        repo = new MatchRepository(supabaseClient);

        // Obtenemos las credenciales o el token (puedes pasarlos como variables de entorno al ejecutar el test)
        // Por ejemplo: TEST_USER="admin@email.com" TEST_PASS="1234" npm run test ...
        // O con Google Auth usando un token: TEST_TOKEN="jwt_token_here" npm run test ...
        const testUser = process.env['TEST_USER'];
        const testPass = process.env['TEST_PASS'];
        const testToken = process.env['TEST_TOKEN'];

        if (testToken) {
            console.log(`[Integration Test] Authenticating using provided access token`);
            // Set the session using the access token and refresh token (if available, otherwise dummy)
            const { error } = await supabaseClient.instance.auth.setSession({
                access_token: testToken,
                refresh_token: testToken // This is a hack for setting the session for a one-off run, as we only care about the access token validity
            });
            if (error) {
                console.error('[Integration Test] Authentication via token failed:', error.message);
            } else {
                console.log('[Integration Test] Authentication via token successful.');
            }
        } else if (testUser && testPass) {
            console.log(`[Integration Test] Authenticating as: ${testUser}`);
            const { error } = await supabaseClient.instance.auth.signInWithPassword({
                email: testUser,
                password: testPass,
            });
            if (error) {
                console.error('[Integration Test] Authentication failed:', error.message);
            } else {
                console.log('[Integration Test] Authentication successful.');
            }
        } else {
            console.log('[Integration Test] Running without authentication. Please set TEST_USER/TEST_PASS or TEST_TOKEN if RLS errors occur.');
        }
    });

    it('should fetch a match and display its full data structure', async () => {
        // Encontramos un ID de partido reciente para probar
        const { data, error } = await supabaseClient.instance
            .from('matches')
            .select('id')
            .order('date', { ascending: false })
            .limit(1);

        expect(error).toBeNull();
        expect(data).toBeDefined();

        if (data && data.length > 0) {
            const matchId = data[0].id;
            console.log(`[Integration Test] Fetching match with ID: ${matchId}`);

            const match = await repo.getMatchById(matchId);

            console.log('\n================ MATCH DATA LAYER VERIFICATION ================');
            console.log(JSON.stringify(match, null, 2));
            console.log('===============================================================\n');

            expect(match).toBeDefined();
            expect(match?.id).toBe(matchId);
            expect(match?.localTeamName).toBeDefined();
            expect(match?.visitorTeamName).toBeDefined();
            expect(match?.state).toBeDefined();

            // Verificamos que la información relacional se haya obtenido correctamente
            console.log('Checking required information exists:');
            console.log(`- Teams: ${match?.localTeamName} vs ${match?.visitorTeamName}`);
            console.log(`- Score: ${match?.scoreLocal} - ${match?.scoreVisitor} (Quarter: ${match?.currentQuarter})`);
            console.log(`- Roster populated: ${Object.keys(match?.roster || {}).length > 0}`);
            console.log(`- Plantilla populated: ${Object.keys(match?.plantilla || {}).length > 0}`);
            console.log(`- Convocados populated: ${Object.keys(match?.convocados || {}).length > 0}`);
            console.log(`- Events populated: ${Object.keys(match?.events || {}).length > 0}`);
            console.log(`- Stats populated: ${Object.keys(match?.stats || {}).length > 0}`);

        } else {
            console.log('No matches found in the database to test.');
        }
    });
});
