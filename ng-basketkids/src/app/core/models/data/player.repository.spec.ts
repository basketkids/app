import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlayerRepository } from './player.repository';
import { SupabaseDataClient } from './supabase.client';

describe('PlayerRepository Unit Tests', () => {
    let repo: PlayerRepository;
    // We create a mocked instance of SupabaseDataClient
    let supabaseClientMock: any;

    // We mock the chained builder functions of Supabase like .from().select().eq()
    let mockFrom: any;
    let mockSelect: any;
    let mockEq: any;
    let mockOrder: any;
    let mockInsert: any;
    let mockUpdate: any;
    let mockDelete: any;

    beforeEach(() => {
        // Reset all mocks before each test
        vi.clearAllMocks();

        mockEq = vi.fn().mockReturnValue({
            order: vi.fn(),
            single: vi.fn()
        });

        mockOrder = vi.fn().mockReturnValue({ /* End of chain usually */ });

        mockSelect = vi.fn().mockImplementation(() => {
            const chain = {
                eq: mockEq,
                order: mockOrder,
                in: vi.fn(),
                single: vi.fn()
            };
            return chain;
        });

        mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
        mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
        mockDelete = vi.fn().mockReturnValue({ eq: mockEq });

        mockFrom = vi.fn().mockReturnValue({
            select: mockSelect,
            insert: mockInsert,
            update: mockUpdate,
            delete: mockDelete,
        });

        supabaseClientMock = {
            instance: {
                from: mockFrom
            }
        };

        repo = new PlayerRepository(supabaseClientMock as unknown as SupabaseDataClient);
    });

    describe('getPlayersByTeam', () => {
        it('should successfully map and return an array of players', async () => {
            const teamId = 'team-123';
            const dbData = [
                { id: '1', name: 'Player One', number: '10', position: 'Escolta', height: '1.9', weight: '80', birth_date: '2010-01-01', avatar_config_id: 'avatar-1' },
                { id: '2', name: 'Player Two', number: '11', position: 'Alero', height: '2.0', weight: '90', birth_date: '2009-01-01', avatar_config_id: null }
            ];

            // Wire the mock chain: from('players').select('*').eq('team_id', teamId).order(..) -> returns { data, error }
            mockEq.mockResolvedValueOnce({ data: dbData, error: null });
            mockEq.mockResolvedValueOnce({ data: dbData, error: null });

            const result = await repo.getPlayersByTeam(teamId);

            expect(mockFrom).toHaveBeenCalledWith('players');
            expect(mockSelect).toHaveBeenCalledWith('*');
            expect(mockEq).toHaveBeenCalledWith('team_id', teamId);

            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('1');
            expect(result[0].name).toBe('Player One');
            expect(result[0].dorsal).toBe(10);
            expect(result[0].avatarConfig).toBe('avatar-1');

            // Check fallback logic for null
            expect(result[1].avatarConfig).toBeNull();
        });

        it('should return empty array when supabase returns error', async () => {
            mockEq.mockResolvedValueOnce({ data: null, error: { message: 'Database error' } });

            const result = await repo.getPlayersByTeam('team-123');

            expect(result).toEqual([]);
        });
    });

    describe('createPlayer', () => {
        it('should send the mapped payload to supabasse insert', async () => {
            const teamId = 'team-123';
            const payload = { name: 'Player', dorsal: 99 };
            const returnedDbRow = { id: 'new-id', name: 'New Player', number: '99', position: 'Base', avatar_config_id: 'avt' };

            // from('players').insert().select().single()
            const singleMock = vi.fn().mockResolvedValue({ data: returnedDbRow, error: null });
            mockSelect.mockReturnValueOnce({ single: singleMock });

            const result = await repo.createPlayer(teamId, payload as any);

            expect(mockFrom).toHaveBeenCalledWith('players');
            expect(mockInsert).toHaveBeenCalledWith([{ name: 'Player', team_id: teamId, number: '99' }]);
            expect(result?.id).toBe('new-id');
        });

        it('should return null if insert fails', async () => {
            const singleMock = vi.fn().mockResolvedValue({ data: null, error: { message: 'Fail' } });
            mockSelect.mockReturnValueOnce({ single: singleMock });

            const result = await repo.createPlayer('t1', {});
            expect(result).toBeNull();
        });
    });

    describe('updatePlayer', () => {
        it('should call update and eq with correct parameters', async () => {
            const playerId = 'p1';
            const updates = { name: 'Updated name' };

            const selectMock = vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'p1', number: '0' }, error: null }) });
            mockEq.mockReturnValueOnce({ select: selectMock });

            const result = await repo.updatePlayer(playerId, updates);

            expect(mockFrom).toHaveBeenCalledWith('players');
            expect(mockUpdate).toHaveBeenCalledWith(updates);
            expect(mockEq).toHaveBeenCalledWith('id', playerId);
            expect(result?.id).toBe('p1');
        });

        it('should return false when database update fails', async () => {
            const selectMock = vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error: { details: 'Failed' } }) });
            mockEq.mockReturnValueOnce({ select: selectMock });
            const result = await repo.updatePlayer('p1', {});
            expect(result).toBeNull();
        });
    });

    describe('deletePlayer', () => {
        it('should call delete and eq successfully', async () => {
            mockEq.mockResolvedValueOnce({ error: null });

            const result = await repo.deletePlayer('p1');

            expect(mockFrom).toHaveBeenCalledWith('players');
            expect(mockDelete).toHaveBeenCalled();
            expect(mockEq).toHaveBeenCalledWith('id', 'p1');
            expect(result).toBe(true);
        });
    });
});
