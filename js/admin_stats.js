// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(window.firebaseConfig);
}

const db = firebase.database();
const auth = firebase.auth();
const statsTableBody = document.getElementById('statsTableBody');
const detailsModal = new bootstrap.Modal(document.getElementById('detailsModal'));
const modalTitle = document.getElementById('detailsModalLabel');
const modalContent = document.getElementById('modalContent');
const modalBackBtn = document.getElementById('modalBackBtn');

let currentUserData = null; // Store current user data for navigation
let currentUid = null;

// Check if user is admin
auth.onAuthStateChanged(async user => {
    if (user) {
        try {
            const profileSnap = await db.ref(`usuarios/${user.uid}/profile`).once('value');
            const profile = profileSnap.val();

            if (!profile || !profile.admin) {
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
});

async function loadStats() {
    try {
        const usersSnap = await db.ref('usuarios').once('value');
        const users = usersSnap.val();

        statsTableBody.innerHTML = '';

        if (!users) {
            statsTableBody.innerHTML = '<tr><td colspan="3" class="text-center">No hay usuarios registrados.</td></tr>';
            return;
        }

        Object.keys(users).forEach(uid => {
            const userData = users[uid];
            const profile = userData.profile || {};
            const displayName = profile.displayName || profile.nombre || 'Usuario sin nombre';
            const email = profile.email || 'Sin email';

            // Calculate counts
            const teams = userData.equipos || {};
            const teamCount = Object.keys(teams).length;

            let matchCount = 0;
            Object.values(teams).forEach(team => {
                const competitions = team.competiciones || {};
                Object.values(competitions).forEach(comp => {
                    const matches = comp.partidos || {};
                    matchCount += Object.keys(matches).length;
                });
            });

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="d-flex align-items-center">
                        <div class="ms-2">
                            <h6 class="mb-0">${displayName}</h6>
                            <small class="text-muted">${email}</small>
                        </div>
                    </div>
                </td>
                <td class="text-center">
                    <a href="#" class="text-decoration-none fw-bold view-teams-btn" data-uid="${uid}">${teamCount}</a>
                </td>
                <td class="text-center">
                    <span class="badge bg-secondary">${matchCount}</span>
                </td>
            `;
            statsTableBody.appendChild(tr);

            // Store user data in memory for modal access (simplified)
            // Ideally we fetch again or pass data, but attaching to DOM element or global map is easier here
            // Let's use a global map if we want, or just re-fetch from the 'users' object we have in scope?
            // Actually, we can attach the data to the button click handler.
        });

        // Event listeners
        document.querySelectorAll('.view-teams-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const uid = e.target.dataset.uid;
                showTeams(users[uid], uid);
            });
        });

    } catch (error) {
        console.error('Error loading stats:', error);
        statsTableBody.innerHTML = `<tr><td colspan="3" class="text-center text-danger">Error cargando estadísticas: ${error.message}</td></tr>`;
    }
}

function showTeams(userData, uid) {
    currentUserData = userData; // Store for back navigation if needed
    currentUid = uid;

    const teams = userData.equipos || {};
    const profile = userData.profile || {};
    const userName = profile.displayName || profile.nombre || 'Usuario';

    modalTitle.textContent = `Equipos de ${userName}`;
    modalBackBtn.style.display = 'none';

    if (Object.keys(teams).length === 0) {
        modalContent.innerHTML = '<p class="text-center text-muted">No hay equipos creados.</p>';
    } else {
        let html = '<div class="list-group">';
        Object.entries(teams).forEach(([teamId, team]) => {
            html += `
                <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                    <div class="flex-grow-1 view-matches-btn" style="cursor: pointer;" data-team-id="${teamId}">
                        <span class="fw-bold">${team.nombre || 'Equipo sin nombre'}</span>
                    </div>
                    <div class="d-flex align-items-center">
                        <span class="badge bg-primary rounded-pill me-2 view-matches-btn" style="cursor: pointer;" data-team-id="${teamId}">
                            <i class="bi bi-chevron-right"></i>
                        </span>
                        <button class="btn btn-sm btn-danger delete-team-btn" data-team-id="${teamId}" data-uid="${uid}">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        modalContent.innerHTML = html;

        // Add listeners for teams
        modalContent.querySelectorAll('.view-matches-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const teamId = e.target.closest('.view-matches-btn').dataset.teamId;
                showMatches(teams[teamId], teamId, uid);
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
            await db.ref(`usuarios/${uid}/equipos/${teamId}`).remove();
            // Refresh stats and close modal or refresh modal
            // Ideally refresh modal, but we need to fetch data again.
            // Simplest is to reload stats and close modal.
            detailsModal.hide();
            loadStats();
        } catch (error) {
            console.error('Error deleting team:', error);
            alert('Error borrando equipo: ' + error.message);
        }
    }
}

function showMatches(team, teamId, uid) {
    modalTitle.textContent = `Partidos de ${team.nombre || 'Equipo'}`;
    modalBackBtn.style.display = 'block';

    // Setup back button
    modalBackBtn.onclick = () => {
        // Go back to teams list
        if (currentUserData && currentUid) {
            // We need the UID, which we have in closure or we can pass it
            // Actually showTeams needs (userData, uid)
            // We stored currentUserData in loadStats, but we need the UID too.
            // Let's find the UID from currentUserData if possible, or just pass it around.
            // In loadStats: showTeams(users[uid], uid);
            showTeams(currentUserData, currentUid);
        }
    };

    const competitions = team.competiciones || {};
    let matchesList = [];

    Object.entries(competitions).forEach(([compId, comp]) => {
        const matches = comp.partidos || {};
        Object.entries(matches).forEach(([matchId, match]) => {
            matchesList.push({
                id: matchId,
                rival: match.nombreRival || 'Rival desconocido',
                fecha: match.fechaHora || 'Sin fecha',
                competicion: comp.nombre || 'Amistoso',
                teamId: teamId,
                uid: uid,
                compId: compId
            });
        });
    });

    if (matchesList.length === 0) {
        modalContent.innerHTML = '<p class="text-center text-muted">No hay partidos registrados para este equipo.</p>';
    } else {
        // Sort by date (optional, but good)
        matchesList.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

        let html = '<div class="table-responsive"><table class="table table-sm table-striped align-middle">';
        html += '<thead><tr><th>Fecha</th><th>Rival</th><th>Competición</th><th>Acciones</th></tr></thead><tbody>';

        matchesList.forEach(match => {
            // Format date if possible
            let displayDate = match.fecha;
            try {
                const dateObj = new Date(match.fecha);
                if (!isNaN(dateObj)) {
                    displayDate = dateObj.toLocaleDateString();
                }
            } catch (e) { }

            html += `
                <tr>
                    <td>${displayDate}</td>
                    <td>${match.rival}</td>
                    <td><small class="text-muted">${match.competicion}</small></td>
                    <td>
                        <button class="btn btn-sm btn-danger delete-match-btn" data-match-id="${match.id}" data-uid="${match.uid}" data-team-id="${match.teamId}" data-comp-id="${match.compId}">
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
    const uid = btn.dataset.uid;
    const teamId = btn.dataset.teamId;
    const compId = btn.dataset.compId;

    if (confirm('¿Estás seguro de que quieres borrar este partido?')) {
        try {
            // Delete from user's team
            await db.ref(`usuarios/${uid}/equipos/${teamId}/competiciones/${compId}/partidos/${matchId}`).remove();
            const userSnap = await db.ref(`usuarios/${uid}`).once('value');
            const updatedUserData = userSnap.val();
            if (updatedUserData && updatedUserData.equipos && updatedUserData.equipos[teamId]) {
                showMatches(updatedUserData.equipos[teamId], teamId, uid);
                // Also update currentUserData for back navigation consistency
                currentUserData = updatedUserData;
            } else {
                // If the team itself was deleted (unlikely from match delete), or no matches left, go back to teams list
                showTeams(updatedUserData, uid);
                currentUserData = updatedUserData;
            }

        } catch (error) {
            console.error('Error deleting match:', error);
            alert('Error borrando partido: ' + error.message);
        }
    }
}
