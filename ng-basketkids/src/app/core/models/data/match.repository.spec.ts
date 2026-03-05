import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MatchRepository } from './match.repository';
import { SupabaseDataClient } from './supabase.client';

describe('MatchRepository Unit Tests', () => {
    let repo: MatchRepository;
    let supabaseClientMock: any;

    let mockFrom: any;
    let mockSelect: any;
    let mockEq: any;
    let mockOrder: any;
    let mockSingle: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockSingle = vi.fn();
        mockOrder = vi.fn();
        mockEq = vi.fn().mockReturnValue({
            order: mockOrder,
            single: mockSingle
        });

        mockSelect = vi.fn().mockReturnValue({
            eq: mockEq,
            order: mockOrder,
            single: mockSingle,
            in: vi.fn(),
            gte: vi.fn().mockReturnValue({ lte: vi.fn().mockReturnValue({ order: mockOrder }) })
        });

        mockFrom = vi.fn().mockReturnValue({
            select: mockSelect,
            insert: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        });

        supabaseClientMock = {
            instance: {
                from: mockFrom
            }
        };

        repo = new MatchRepository(supabaseClientMock as unknown as SupabaseDataClient);
    });

    describe('Valoracion and Stats Hydration Logic in getMatchById', () => {
        it('should fetch parallel connections and compute valoracion mathematics accurately', async () => {
            // 1. Mock DB row for the generic Match table query
            const matchDbRow = {
                id: 'm1', team_id: 't1', rival_id: 'r1', rival_name: 'Visitor FC',
                is_local: true, state: 'en_curso', team_score: 55, rival_score: 40,
                live_state: { currentQuarter: 3, jugadoresEnPista: { 'p1': true } },
                teams: { name: 'Home Team' }
            };
            mockSingle.mockResolvedValueOnce({ data: matchDbRow, error: null });

            // 2. Mock the 4 parallel requests the getMatchById makes under the hood. 
            //  - eventsRes
            //  - statsRes
            //  - playersRes
            //  - rostersRes

            // Event: Just one Puntos event
            const eventsRes = {
                data: [{ id: 'e1', event_type_id: 'puntos', player_id: 'p1', value: 2, quarter: 1, players: { name: 'Player One', number: '10' } }],
                error: null
            };
            // Stats: Return 1 player with points, fouls, assists... Valoracion should be PTS + REB + AST + STL + BLK - FOUL
            const statsRes = {
                data: [{ player_id: 'p1', points: 10, faltas: 3, asistencias: 2, rebotes: 5, robos: 1, tapones: 0, players: { name: 'Player One', number: '10' } }],
                error: null
            };
            const playersRes = {
                data: [{ id: 'p1', name: 'Player One', number: '10', avatar_config_id: null }],
                error: null
            };
            const rostersRes = {
                data: [{ player_id: 'p1' }], // Un convocado
                error: null
            };

            // In a realistic mock of `Promise.all` with multiple queries, we mock the implementation of `from()` globally.
            // We configure our from mock to return different things depending on the table asked.
            mockFrom.mockImplementation((table: string) => {
                if (table === 'matches') return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: matchDbRow, error: null }) }) }) };
                if (table === 'match_events') return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue(eventsRes) }) }) };
                if (table === 'match_player_stats') return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue(statsRes) }) };
                if (table === 'players') return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue(playersRes) }) };
                if (table === 'match_rosters') return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue(rostersRes) }) };
                return {};
            });

            const match = await repo.getMatchById('m1');

            expect(match).toBeDefined();
            // Validation logic: 10 (pts) + 5 (reb) + 2 (ast) + 1 (stl) + 0 (blk) - 3 (foul) = 15
            const valoracion = match!.stats['p1'].valoracion;
            expect(valoracion).toBe(15);
            expect(match!.stats['p1'].points).toBe(10);
            expect(match!.stats['p1'].fouls).toBe(3);

            // Verify mapped objects
            expect(match!.convocados['p1'].name).toBe('Player One');
            expect(match!.scoreLocal).toBe(55);
            expect(match!.scoreVisitor).toBe(40);
            expect(match!.currentQuarter).toBe(3);
            expect(match!.localTeamName).toBe('Home Team');
        });
    });

    describe('Date Range Query', () => {
        it('should map getMatchesByDateRange correctly using gte and lte', async () => {
            const mockData = [{ id: 'm1', date: '2023-01-15' }];

            // Chain: from('matches').select('*').gte('date', s).lte('date', e).order(...)
            const orderSpy = vi.fn().mockResolvedValue({ data: mockData, error: null });
            const lteSpy = vi.fn().mockReturnValue({ order: orderSpy });
            const gteSpy = vi.fn().mockReturnValue({ lte: lteSpy });
            mockSelect.mockReturnValueOnce({ gte: gteSpy });

            const list = await repo.getMatchesByDateRange('2023-01-01', '2023-01-31');

            expect(list).toHaveLength(1);
            expect(mockFrom).toHaveBeenCalledWith('matches');
            expect(gteSpy).toHaveBeenCalledWith('date', '2023-01-01');
            expect(lteSpy).toHaveBeenCalledWith('date', '2023-01-31');
        });
    });
});
