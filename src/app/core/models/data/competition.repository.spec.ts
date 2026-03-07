import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CompetitionRepository } from './competition.repository';
import { SupabaseDataClient } from './supabase.client';

describe('CompetitionRepository Unit Tests', () => {
    let repo: CompetitionRepository;
    let supabaseClientMock: any;

    let mockFrom: any;
    let mockSelect: any;
    let mockEq: any;
    let mockOrder: any;
    let mockSingle: any;
    let mockInsert: any;
    let mockUpdate: any;
    let mockDelete: any;

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

        repo = new CompetitionRepository(supabaseClientMock as unknown as SupabaseDataClient);
    });

    describe('getCompetitionsByTeam', () => {
        it('should fetch and map competitions array', async () => {
            const mockDbData = [
                { id: 'c1', name: 'Liga Regular', season: '23/24' },
                { id: 'c2', name: 'Copa', season: '23/24' }
            ];

            // eq().order()
            const orderSpy = vi.fn().mockResolvedValue({ data: mockDbData, error: null });
            mockEq.mockReturnValueOnce({ order: orderSpy });

            const list = await repo.getCompetitionsByTeam('t1');

            expect(mockFrom).toHaveBeenCalledWith('competitions');
            expect(mockEq).toHaveBeenCalledWith('team_id', 't1');
            expect(list).toHaveLength(2);
            expect(list[0].name).toBe('Liga Regular');
            expect(list[1].id).toBe('c2');
        });
    });

    describe('createCompetition', () => {
        it('should call insert with proper payload', async () => {
            const teamId = 't1';
            const mockDbRow = { id: 'new-comp' };

            // returning chained single mock
            const singleSpy = vi.fn().mockResolvedValue({ data: mockDbRow, error: null });
            mockSelect.mockReturnValueOnce({ single: singleSpy });

            const result = await repo.createCompetition(teamId, 'Test Comp', '24/25');

            expect(mockFrom).toHaveBeenCalledWith('competitions');
            expect(mockInsert).toHaveBeenCalledWith([{ team_id: teamId, name: 'Test Comp', season: '24/25' }]);
            expect(result?.id).toBe('new-comp');
        });
    });

    describe('Rivals Management', () => {
        it('should get all rivals mapped', async () => {
            const mockDbData = [
                { id: 'r1', name: 'Classic Rival', logo_url: 'logo.jpg' }
            ];
            const orderSpy = vi.fn().mockResolvedValue({ data: mockDbData, error: null });
            mockEq.mockReturnValueOnce({ order: orderSpy });

            const list = await repo.getRivalsByCompetition('c1');
            expect(mockFrom).toHaveBeenCalledWith('rivals');
            expect(list[0].logoUrl).toBe('logo.jpg');
        });

        it('should delete rival correctly', async () => {
            mockEq.mockResolvedValueOnce({ error: null });
            await repo.deleteRival('r1');

            expect(mockFrom).toHaveBeenCalledWith('rivals');
            expect(mockDelete).toHaveBeenCalled();
            expect(mockEq).toHaveBeenCalledWith('id', 'r1');
        });
    });
});
