/**
 * CalendarService - Service to aggregate all matches from all teams and competitions
 */
class CalendarService {
    constructor() {
        this.supabase = window.supabaseClient;
    }

    /**
     * Get all matches from all teams and competitions for a user
     * @param {string} userId - User ID
     * @returns {Promise<Array>} - Promise resolving to array of all matches with metadata
     */
    async getAllUserMatches(userId) {
        const allMatches = [];

        try {
            // 1. Get IDs of teams owned by user
            const { data: ownedTeams, error: ownedError } = await this.supabase
                .from('teams')
                .select('id, name, owner_id')
                .eq('owner_id', userId);

            if (ownedError) throw ownedError;

            // 2. Get IDs of teams followed by user
            const { data: followedTeams, error: followedError } = await this.supabase
                .from('team_followers')
                .select('team_id, teams(id, name, owner_id)')
                .eq('user_id', userId);

            if (followedError) throw followedError;

            // Collect all relevant Team IDs
            const teamIds = new Set();
            const teamMap = {}; // ID -> {name, ownerId}

            // Process owned teams
            ownedTeams?.forEach(t => {
                teamIds.add(t.id);
                teamMap[t.id] = { name: t.name, ownerId: t.owner_id };
            });

            // Process followed teams
            followedTeams?.forEach(f => {
                if (f.teams) {
                    teamIds.add(f.team_id);
                    teamMap[f.team_id] = { name: f.teams.name, ownerId: f.teams.owner_id };
                }
            });

            if (teamIds.size === 0) return [];

            // 3. Fetch matches for these teams
            // We want matches where team_id IN (...)
            const { data: matches, error: matchesError } = await this.supabase
                .from('matches')
                .select('*')
                .in('team_id', Array.from(teamIds))
                .order('date', { ascending: true });

            if (matchesError) throw matchesError;

            // 4. Map matches to expected structure
            // CalendarApp expects: { matchId, teamId, teamName, compId, compName, ownerUid, ...matchData }
            // 'matchData' in previous Firebase structure was the whole object.
            // Here 'matches' are flat objects.

            matches.forEach(m => {
                const teamInfo = teamMap[m.team_id] || { name: 'Desconocido', ownerId: null };

                // Construct object compatible with CalendarApp/IndexApp
                allMatches.push({
                    id: m.id, // Supabase ID
                    matchId: m.id, // Legacy alias
                    teamId: m.team_id,
                    teamName: teamInfo.name,
                    compId: m.competition_id,
                    compName: m.competition_id, // We might need to fetch comp name if critical, but ID often sufficient for grouping? 
                    // Actually, fetching competition names would need another join or map.
                    // For now, let's leave compName as ID or empty if UI can handle it.
                    // Or we can simple fetch competitions in step 3 as well?
                    // Let's assume UI handles it or we do a quick fetch if needed.
                    ownerUid: teamInfo.ownerId,
                    fechaHora: m.date,
                    equipoId: m.team_id, // Duplicate?
                    rivalId: m.rival_id,
                    nombreEquipo: teamInfo.name,
                    nombreRival: m.rival_name,
                    estado: m.state,
                    pabellon: m.location,
                    location: m.location,
                    puntosEquipo: m.team_score,
                    puntosRival: m.rival_score,
                    // Spread other properties if needed
                    ...m
                });
            });

            return allMatches;

        } catch (error) {
            console.error('CalendarService: Error getting all user matches:', error);
            return [];
        }
    }

    /**
     * Get the start of the current week (Monday)
     * @returns {Date} - Date object for Monday of current week
     */
    getCurrentWeekStart() {
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        const monday = new Date(today.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        return monday;
    }

    /**
     * Get matches for a specific week
     * @param {Array} matches - Array of all matches
     * @param {Date} weekStartDate - Monday of the week
     * @returns {Object} - Object with matches grouped by day of week
     */
    getMatchesForWeek(matches, weekStartDate) {
        const weekMatches = {
            monday: [],
            tuesday: [],
            wednesday: [],
            thursday: [],
            friday: [],
            saturday: [],
            sunday: []
        };

        const weekStart = new Date(weekStartDate);
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

        matches.forEach(match => {
            if (!match.fechaHora && !match.date) return;
            const d = match.fechaHora || match.date;
            const matchDate = new Date(d);

            if (matchDate >= weekStart && matchDate < weekEnd) {
                const dayOfWeek = matchDate.getDay();
                const dayKey = dayNames[dayOfWeek];
                if (weekMatches[dayKey]) {
                    weekMatches[dayKey].push(match);
                }
            }
        });

        return weekMatches;
    }

    /**
     * Get week navigation info (previous/next week dates)
     * @param {Date} currentWeekStart - Current Monday
     * @returns {Object} - Object with previous and next week start dates
     */
    getWeekNavigation(currentWeekStart) {
        const prevWeek = new Date(currentWeekStart);
        prevWeek.setDate(prevWeek.getDate() - 7);

        const nextWeek = new Date(currentWeekStart);
        nextWeek.setDate(nextWeek.getDate() + 7);

        return {
            previous: prevWeek,
            next: nextWeek
        };
    }

    /**
     * Format week range for display
     * @param {Date} weekStart - Monday of the week
     * @returns {string} - Formatted week range (e.g., "25 Nov - 1 Dic 2024")
     */
    formatWeekRange(weekStart) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const options = { day: 'numeric', month: 'short' };
        const startStr = weekStart.toLocaleDateString('es-ES', options);
        const endStr = weekEnd.toLocaleDateString('es-ES', { ...options, year: 'numeric' });

        return `${startStr} - ${endStr}`;
    }
}
