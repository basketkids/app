// Initialize Supabase
const sb = window.supabaseClient;

const statsTableBody = document.getElementById('statsTableBody');
const detailsModal = new bootstrap.Modal(document.getElementById('detailsModal'));
const modalTitle = document.getElementById('detailsModalLabel');
const modalContent = document.getElementById('modalContent');
const modalBackBtn = document.getElementById('modalBackBtn');

let currentUserData = null; // Store current user data for navigation
let currentUid = null;

// Check if user is admin
async function checkAdmin() {
    const { data: { user } } = await sb.auth.getUser();

    if (user) {
        try {
            const { data: profile, error } = await sb
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error || !profile || !profile.is_admin) {
                window.location.href = 'index.html';
                return;
            }

            loadStats();

        } catch (error) {
            console.error('Error checking admin status:', error);
            window.location.href = 'index.html';
        }
    } else {
        window.location.href = 'login.html';
    }
}

checkAdmin();

async function loadStats() {
    try {
        // Fetch all profiles, teams, competitions, matches
        // For scalability, this should be paginated or server-side aggregated.
        // But adapting existing logic:

        const { data: profiles, error: pError } = await sb.from('profiles').select('*');
        if (pError) throw pError;

        const { data: teams, error: tError } = await sb.from('teams').select('*');
        if (tError) throw tError;

        const { data: competitions, error: cError } = await sb.from('competitions').select('*');
        if (cError) throw cError;

        const { data: matches, error: mError } = await sb.from('matches').select('*');
        if (mError) throw mError;

        // Build the nested structure compatible with 'users' 
        // OR just calculate stats directly from arrays.

        // Map user stats
        const userStats = {};

        profiles.forEach(p => {
            userStats[p.id] = {
                profile: p,
                teams: [],
                teamCount: 0,
                matchCount: 0
            };
        });

        // Link teams to users
        teams.forEach(t => {
            if (userStats[t.owner_id]) {
                userStats[t.owner_id].teams.push(t);
                userStats[t.owner_id].teamCount++;
            }
        });

        // Link matches to teams (and thus users)
        // Matches have team_id.
        const teamMatchCount = {}; // teamId -> count
        const teamMatches = {};    // teamId -> [match objects]

        matches.forEach(m => {
            if (!teamMatchCount[m.team_id]) teamMatchCount[m.team_id] = 0;
            teamMatchCount[m.team_id]++;

            if (!teamMatches[m.team_id]) teamMatches[m.team_id] = [];
            teamMatches[m.team_id].push(m);
        });

        // Aggregate match counts to users
        Object.values(userStats).forEach(u => {
            u.teams.forEach(t => {
                if (teamMatchCount[t.id]) {
                    u.matchCount += teamMatchCount[t.id];
                }
            });
        });

        // Render
        statsTableBody.innerHTML = '';

        if (profiles.length === 0) {
            statsTableBody.innerHTML = '<tr><td colspan="3" class="text-center">No hay usuarios registrados.</td></tr>';
            return;
        }

        // Convert to array and Sort?
        const statsArray = Object.values(userStats);
        statsArray.sort((a, b) => {
            const nameA = a.profile.display_name || 'Usuario';
            const nameB = b.profile.display_name || 'Usuario';
            return nameA.localeCompare(nameB);
        });

        statsArray.forEach(u => {
            const uid = u.profile.id;
            const displayName = u.profile.display_name || u.profile.name || 'Usuario sin nombre';
            const email = u.profile.email || 'Sin email';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="d-flex align-items-center">
                        <div class="ms-2">
                            <h6 class="mb-0">${escapeHtml(displayName)}</h6>
                            <small class="text-muted d-none d-md-block">${escapeHtml(email)}</small>
                        </div>
                    </div>
                </td>
                <td class="text-center">
                    <a href="#" class="text-decoration-none fw-bold view-teams-btn" data-uid="${uid}">${u.teamCount}</a>
                </td>
                <td class="text-center">
                    <span class="badge bg-secondary">${u.matchCount}</span>
                </td>
            `;
            statsTableBody.appendChild(tr);
        });

        // Store data globally for modal
        window.tempUserStats = userStats;
        window.tempTeamMatches = teamMatches;
        window.tempCompetitions = competitions; // Match needs comp name?

        // Helper map for comp names
        window.compMap = {};
        competitions.forEach(c => window.compMap[c.id] = c);

        document.querySelectorAll('.view-teams-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const uid = e.target.dataset.uid;
                showTeams(uid);
            });
        });

    } catch (error) {
        console.error('Error loading stats:', error);
        statsTableBody.innerHTML = `<tr><td colspan="3" class="text-center text-danger">Error cargando estadísticas: ${error.message}</td></tr>`;
    }
}

function showTeams(uid) {
    const userStat = window.tempUserStats[uid];
    if (!userStat) return;

    currentUid = uid;

    const teams = userStat.teams;
    const profile = userStat.profile;
    const userName = profile.display_name || profile.name || 'Usuario';

    modalTitle.textContent = `Equipos de ${userName}`;
    modalBackBtn.style.display = 'none';

    if (teams.length === 0) {
        modalContent.innerHTML = '<p class="text-center text-muted">No hay equipos creados.</p>';
    } else {
        let html = '<div class="list-group">';
        teams.forEach(team => {
            html += `
                <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                    <div class="flex-grow-1 view-matches-btn" style="cursor: pointer;" data-team-id="${team.id}">
                        <span class="fw-bold">${escapeHtml(team.name || 'Equipo sin nombre')}</span>
                    </div>
                    <div class="d-flex align-items-center">
                        <span class="badge bg-primary rounded-pill me-2 view-matches-btn" style="cursor: pointer;" data-team-id="${team.id}">
                            <i class="bi bi-chevron-right"></i>
                        </span>
                        <button class="btn btn-sm btn-danger delete-team-btn" data-team-id="${team.id}" data-uid="${uid}">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        modalContent.innerHTML = html;

        modalContent.querySelectorAll('.view-matches-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const teamId = e.target.closest('.view-matches-btn').dataset.teamId;
                showMatches(teamId, uid);
            });
        });

        modalContent.querySelectorAll('.delete-team-btn').forEach(btn => {
            btn.addEventListener('click', handleDeleteTeam);
        });
    }

    detailsModal.show();
}

async function handleDeleteTeam(e) {
    const btn = e.target.closest('button');
    const teamId = btn.dataset.teamId;
    const uid = btn.dataset.uid;

    if (confirm('¿Estás seguro de que quieres borrar este equipo? Se borrarán también sus partidos y jugadores.')) {
        try {
            const { error } = await sb.from('teams').delete().eq('id', teamId);
            if (error) throw error;

            // Reload
            detailsModal.hide();
            loadStats();
        } catch (error) {
            console.error('Error deleting team:', error);
            alert('Error borrando equipo: ' + error.message);
        }
    }
}

function showMatches(teamId, uid) {
    const userStat = window.tempUserStats[uid];
    const team = userStat.teams.find(t => t.id === teamId);
    if (!team) return;

    modalTitle.textContent = `Partidos de ${team.name || 'Equipo'}`;
    modalBackBtn.style.display = 'block';

    modalBackBtn.onclick = () => {
        showTeams(uid);
    };

    const matches = window.tempTeamMatches[teamId] || [];

    if (matches.length === 0) {
        modalContent.innerHTML = '<p class="text-center text-muted">No hay partidos registrados para este equipo.</p>';
    } else {
        // Sort by date
        matches.sort((a, b) => new Date(a.date) - new Date(b.date));

        let html = '<div class="table-responsive"><table class="table table-sm table-striped align-middle">';
        html += '<thead><tr><th>Fecha</th><th>Rival</th><th>Competición</th><th>Acciones</th></tr></thead><tbody>';

        matches.forEach(match => {
            let displayDate = 'Sin fecha';
            if (match.date) {
                try {
                    displayDate = new Date(match.date).toLocaleDateString();
                } catch (e) { }
            }

            const compName = window.compMap[match.competition_id] ? window.compMap[match.competition_id].name : 'Desconocida';

            html += `
                <tr>
                    <td>${displayDate}</td>
                    <td>${escapeHtml(match.rival_name || 'Rival')}</td>
                    <td><small class="text-muted">${escapeHtml(compName)}</small></td>
                    <td>
                        <button class="btn btn-sm btn-danger delete-match-btn" data-match-id="${match.id}">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        modalContent.innerHTML = html;

        modalContent.querySelectorAll('.delete-match-btn').forEach(btn => {
            btn.addEventListener('click', handleDeleteMatch);
        });
    }
}

async function handleDeleteMatch(e) {
    const btn = e.target.closest('button');
    const matchId = btn.dataset.matchId;

    if (confirm('¿Estás seguro de que quieres borrar este partido?')) {
        try {
            const { error } = await sb.from('matches').delete().eq('id', matchId);
            if (error) throw error;

            // Refresh matches list? Or just reload stats?
            // Since we rely on global temp data, reloading stats is cleaner but closes modal.
            // Let's reload stats and close modal for simplicity/consistency with previous style
            detailsModal.hide();
            loadStats();
        } catch (error) {
            console.error('Error deleting match:', error);
            alert('Error borrando partido: ' + error.message);
        }
    }
}

function escapeHtml(text) {
    if (!text) return '';
    if (typeof Sanitizer !== 'undefined') return Sanitizer.escape(text);
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
