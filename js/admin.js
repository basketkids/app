// Initialize Firebase (if not already done in load-header, but good to be safe)
if (!firebase.apps.length) {
    firebase.initializeApp(window.firebaseConfig);
}

const db = firebase.database();
const auth = firebase.auth();
const usersTableBody = document.getElementById('usersTableBody');

// Check if user is admin
auth.onAuthStateChanged(async user => {
    if (user) {
        try {
            const profileSnap = await db.ref(`usuarios/${user.uid}/profile`).once('value');
            const profile = profileSnap.val();

            if (!profile || !profile.admin) {
                // Not admin, redirect
                window.location.href = 'index.html';
                return;
            }

            // Is admin, load users
            loadUsers();

        } catch (error) {
            console.error('Error checking admin status:', error);
            window.location.href = 'index.html';
        }
    } else {
        // Not logged in
        window.location.href = 'login.html';
    }
});

async function loadUsers() {
    try {
        const usersSnap = await db.ref('usuarios').once('value');
        const users = usersSnap.val();

        usersTableBody.innerHTML = '';

        if (!users) {
            usersTableBody.innerHTML = '<tr><td colspan="4" class="text-center">No hay usuarios registrados.</td></tr>';
            return;
        }

        // Convert to array for sorting
        const usersArray = Object.keys(users).map(uid => ({
            uid,
            ...users[uid]
        }));

        // Sort: Admins first, then Alphabetical by name
        usersArray.sort((a, b) => {
            const adminA = (a.profile && a.profile.admin) ? 1 : 0;
            const adminB = (b.profile && b.profile.admin) ? 1 : 0;

            // Higher admin value comes first
            if (adminA !== adminB) return adminB - adminA;

            // If same admin status, sort by name
            const nameA = (a.profile && (a.profile.displayName || a.profile.nombre)) || 'Usuario';
            const nameB = (b.profile && (b.profile.displayName || b.profile.nombre)) || 'Usuario';

            return nameA.localeCompare(nameB);
        });

        usersArray.forEach(user => {
            const uid = user.uid;
            const profile = user.profile || {};
            const email = profile.email || 'Sin email'; // Assuming email is stored in profile or we can't get it easily from Auth here without Admin SDK
            // Note: Client SDK can't list Auth users. We rely on data stored in Realtime DB under 'usuarios'.
            // If email is not in 'usuarios/{uid}/profile', we might display 'ID: {uid}' or similar.
            // Assuming the app saves email to profile on registration. If not, we might only see names.

            // Fallback for display name
            const displayName = profile.displayName || profile.nombre || 'Usuario sin nombre';
            const isAdmin = profile.admin === true;
            const isCurrentUser = (uid === auth.currentUser.uid);

            // Cannot delete admins or yourself
            const canDelete = !isAdmin && !isCurrentUser;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="d-flex align-items-center">
                        <div class="ms-2">
                            <h6 class="mb-0">${displayName}</h6>
                            <small class="text-muted">ID: ${uid.substring(0, 8)}...</small>
                        </div>
                    </div>
                </td>
                <td>${email}</td>
                <td class="text-center">
                    ${isAdmin ? '<span class="badge bg-success">Sí</span>' : '<span class="badge bg-secondary">No</span>'}
                </td>
                <td class="text-end">
                    <button class="btn btn-sm ${isAdmin ? 'btn-outline-danger' : 'btn-outline-primary'} toggle-admin-btn me-2" 
                            data-uid="${uid}" 
                            data-admin="${isAdmin}"
                            ${isCurrentUser ? 'disabled' : ''}>
                        ${isAdmin ? 'Quitar Admin' : 'Hacer Admin'}
                    </button>
                    <button class="btn btn-sm btn-danger delete-user-btn" 
                            data-uid="${uid}" 
                            ${!canDelete ? 'disabled title="No puedes borrar a un administrador ni a ti mismo"' : ''}>
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
            usersTableBody.appendChild(tr);
        });

        // Add event listeners to buttons
        document.querySelectorAll('.toggle-admin-btn').forEach(btn => {
            btn.addEventListener('click', handleToggleAdmin);
        });

        document.querySelectorAll('.delete-user-btn').forEach(btn => {
            if (!btn.disabled) {
                btn.addEventListener('click', handleDeleteUser);
            }
        });

    } catch (error) {
        console.error('Error loading users:', error);
        usersTableBody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Error cargando usuarios: ${error.message}</td></tr>`;
    }
}

async function handleToggleAdmin(e) {
    const btn = e.target;
    const uid = btn.dataset.uid;
    const currentStatus = btn.dataset.admin === 'true';
    const newStatus = !currentStatus;

    if (uid === auth.currentUser.uid) {
        alert('No puedes cambiar tus propios permisos de administrador.');
        return;
    }

    if (confirm(`¿Estás seguro de que quieres ${newStatus ? 'dar' : 'quitar'} permisos de administrador a este usuario?`)) {
        try {
            await db.ref(`usuarios/${uid}/profile/admin`).set(newStatus);
            // Reload list to reflect changes
            loadUsers();
        } catch (error) {
            console.error('Error updating admin status:', error);
            alert('Error actualizando permisos: ' + error.message);
        }
    }
}

async function handleDeleteUser(e) {
    const btn = e.target.closest('button');
    if (btn.disabled) return;

    const uid = btn.dataset.uid;

    if (confirm('¿Estás seguro de que quieres borrar este usuario? Esta acción eliminará todos sus datos (equipos, partidos, perfil) de la base de datos. NO se puede deshacer.')) {
        try {
            await db.ref(`usuarios/${uid}`).remove();
            // Reload list
            loadUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('Error borrando usuario: ' + error.message);
        }
    }
}
