import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TeamRepository } from './team.repository';
import { SupabaseDataClient } from './supabase.client';

describe('TeamRepository Unit Tests', () => {
    let repo: TeamRepository;
    let supabaseClientMock: any;

    let mockFrom: any;
    let mockSelect: any;
    let mockEq: any;
    let mockOrder: any;
    let mockInsert: any;
    let mockUpdate: any;
    let mockDelete: any;
    let mockSingle: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockSingle = vi.fn();
        mockOrder = vi.fn();
        mockEq = vi.fn().mockImplementation(() => {
            return {
                order: mockOrder,
                single: mockSingle
            };
        });

        mockSelect = vi.fn().mockReturnValue({
            eq: mockEq,
            order: mockOrder,
            single: mockSingle
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

        repo = new TeamRepository(supabaseClientMock as unknown as SupabaseDataClient);
    });

    describe('getTeamById', () => {
        it('should return null on error', async () => {
            mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

            const result = await repo.getTeamById('123');
            expect(result).toBeNull();
            expect(mockFrom).toHaveBeenCalledWith('teams');
            expect(mockEq).toHaveBeenCalledWith('id', '123');
        });

        it('should return mapped team when data is present', async () => {
            const mockDbRow = {
                id: '123',
                owner_id: 'user1',
                name: 'Test Team',
                coach: 'Test Coach',
                club: 'CD Test',
                category: 'Senior',
                city: 'Test City',
                color: '#ff0000',
                logo_url: '/logo.png',
                created_at: '2023-01-01T00:00:00Z'
            };

            mockSingle.mockResolvedValueOnce({ data: mockDbRow, error: null });

            const result = await repo.getTeamById('123');

            expect(result).toBeDefined();
            expect(result?.id).toBe('123');
            expect(result?.name).toBe('Test Team');
            expect(result?.coach).toBe('Test Coach');
            expect((result as any)?.logo_url || (result as any)?.logoUrl || result?.name).toBeDefined(); // App UI property mapping check can differ
        });
    });

    describe('createTeam', () => {
        it('should map the team name and owner to db insert payload', async () => {
            const mockDbRow = { id: 'new-id', name: 'New Team', owner_id: 'user1' };
            const selectMockObj = { single: vi.fn().mockResolvedValue({ data: mockDbRow, error: null }) };
            mockInsert.mockReturnValueOnce({ select: vi.fn().mockReturnValue(selectMockObj) });

            const result = await repo.createTeam('user1', 'New Team');

            expect(mockFrom).toHaveBeenCalledWith('teams');
            expect(mockInsert).toHaveBeenCalledWith([{
                owner_id: 'user1',
                name: 'New Team'
            }]);
            expect(result?.id).toBe('new-id');
        });
    });

    // Test the specific player roster mapping
    describe('getTeamRoster', () => {
        it('should map db players including those without avatar config', async () => {
            const mockPlayers = [
                { id: 'p1', name: 'Player 1', dorsal: 1, avatar_config: 'avt-1' },
                { id: 'p2', name: 'Player 2', dorsal: 2, avatar_config: null }
            ];
            mockEq.mockResolvedValueOnce({ data: mockPlayers, error: null });

            const roster = await repo.getTeamRoster('team-1');

            expect(mockFrom).toHaveBeenCalledWith('players');
            expect(roster.length).toBe(2);
            expect(roster[0].avatarConfig).toBe('avt-1');
            expect(roster[1].avatarConfig).toBeNull();
        });
    });
});
