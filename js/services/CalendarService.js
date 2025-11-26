/**
 * CalendarService - Service to aggregate all matches from all teams and competitions
 */
class CalendarService {
    constructor(db) {
        this.db = db;
    }

    /**
     * Get all matches from all teams and competitions for a user
     * @param {string} userId - User ID
     * @returns {Promise<Array>} - Promise resolving to array of all matches with metadata
     */
    async getAllUserMatches(userId) {
        const allMatches = [];

        try {
            // Get all teams
            const teamsSnapshot = await this.db.ref(`usuarios/${userId}/equipos`).once('value');
            const teams = teamsSnapshot.val();

            if (!teams) {
                return allMatches;
            }

            // For each team, get all competitions and matches
            for (const [teamId, teamData] of Object.entries(teams)) {
                const teamName = teamData.nombre || 'Equipo sin nombre';

                // Check if competiciones exists and is an object
                if (!teamData.competiciones || typeof teamData.competiciones !== 'object') {
                    continue;
                }

                const competitions = teamData.competiciones;

                for (const [compId, compData] of Object.entries(competitions)) {
                    const compName = compData.nombre || 'Competición sin nombre';

                    // Check if partidos exists and is an object
                    if (!compData.partidos || typeof compData.partidos !== 'object') {
                        continue;
                    }

                    const matches = compData.partidos;

                    for (const [matchId, matchData] of Object.entries(matches)) {
                        allMatches.push({
                            matchId,
                            teamId,
                            teamName,
                            compId,
                            compName,
                            ...matchData
                        });
                    }
                }
            }

            // Sort by date/time
            allMatches.sort((a, b) => {
                const dateA = new Date(a.fechaHora);
                const dateB = new Date(b.fechaHora);
                return dateA - dateB;
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
            const matchDate = new Date(match.fechaHora);

            if (matchDate >= weekStart && matchDate < weekEnd) {
                const dayOfWeek = matchDate.getDay();
                const dayKey = dayNames[dayOfWeek];
                weekMatches[dayKey].push(match);
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
