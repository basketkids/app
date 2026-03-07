// Initialize Supabase
const sb = window.supabaseClient;

const usersTableBody = document.getElementById('usersTableBody');
let currentUser = null;

// Check if user is admin
async function checkAdmin() {
    const { data: { user } } = await sb.auth.getUser();

    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    currentUser = user;

    try {
        const { data: profile, error } = await sb
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error || !profile || !profile.is_admin) {
            console.error('User is not admin or profile fetch error:', error);
            window.location.href = 'index.html';
            return;
        }

        // Is admin, load users
        loadUsers();

    } catch (error) {
        console.error('Error checking admin status:', error);
        window.location.href = 'index.html';
    }
}

// Start check
checkAdmin();


async function loadUsers() {
    try {
        const { data: users, error } = await sb
            .from('profiles')
            .select('*');

        usersTableBody.innerHTML = '';

        if (error) {
            throw error;
        }

        if (!users || users.length === 0) {
            usersTableBody.innerHTML = '<tr><td colspan="4" class="text-center">No hay usuarios registrados.</td></tr>';
            return;
        }

        // Sort: Admins first, then Alphabetical by name
        users.sort((a, b) => {
            const adminA = a.is_admin ? 1 : 0;
            const adminB = b.is_admin ? 1 : 0;

            if (adminA !== adminB) return adminB - adminA;

            const nameA = a.display_name || 'Usuario';
            const nameB = b.display_name || 'Usuario';

            return nameA.localeCompare(nameB);
        });

        users.forEach(user => {
            const uid = user.id;
            const email = user.email || 'Sin email';
            const displayName = user.display_name || 'Usuario sin nombre'; // Sanitizer? Supabase handles JSON/Text safely usually, but if inserting HTML...
            // Element.textContent protects against XSS, so we use that or standard DOM creation.
            // innerHTML below needs care.

            const safeName = displayName.replace(/</g, "&lt;").replace(/>/g, "&gt;");

            const isAdmin = user.is_admin === true;
            const isCurrentUser = (currentUser && uid === currentUser.id);
            const canDelete = !isAdmin && !isCurrentUser;

            const tr = document.createElement('tr');

            tr.innerHTML = `
                <td>
                    <div class="d-flex align-items-center">
                        <div class="ms-2">
                            <h6 class="mb-0">${safeName}</h6>
                            <small class="text-muted d-md-none">${uid.substring(0, 8)}...</small>
                            <small class="text-muted d-none d-md-block">ID: ${uid}</small>
                        </div>
                    </div>
                </td>
                <td class="d-none d-md-table-cell">${email}</td>
                <td class="text-center">
                    ${isAdmin ? '<span class="badge bg-success">Sí</span>' : '<span class="badge bg-secondary">No</span>'}
                </td>
                <td class="text-end">
                    <button class="btn btn-sm ${isAdmin ? 'btn-outline-danger' : 'btn-outline-primary'} toggle-admin-btn me-2" 
                            data-uid="${uid}" 
                            data-admin="${isAdmin}"
                            ${isCurrentUser ? 'disabled' : ''}>
                        ${isAdmin ? 'Quitar' : 'Hacer Admin'} 
                    </button>
                    <button class="btn btn-sm btn-outline-secondary edit-name-btn me-2" 
                            data-uid="${uid}" 
                            data-current-name="${safeName}">
                        <i class="bi bi-pencil"></i>
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

        // Add event listeners
        document.querySelectorAll('.toggle-admin-btn').forEach(btn => btn.addEventListener('click', handleToggleAdmin));
        document.querySelectorAll('.delete-user-btn').forEach(btn => {
            if (!btn.disabled) btn.addEventListener('click', handleDeleteUser);
        });
        document.querySelectorAll('.edit-name-btn').forEach(btn => btn.addEventListener('click', handleEditName));

    } catch (error) {
        console.error('Error loading users:', error);
        usersTableBody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Error cargando usuarios: ${error.message}</td></tr>`;
    }
}

async function handleToggleAdmin(e) {
    const btn = e.target.closest('button'); // e.target might be icon? No icon here but safe
    const uid = btn.dataset.uid;
    const currentStatus = btn.dataset.admin === 'true';
    const newStatus = !currentStatus;

    if (currentUser && uid === currentUser.id) {
        alert('No puedes cambiar tus propios permisos de administrador.');
        return;
    }

    if (confirm(`¿Estás seguro de que quieres ${newStatus ? 'dar' : 'quitar'} permisos de administrador a este usuario?`)) {
        try {
            const { error } = await sb
                .from('profiles')
                .update({ is_admin: newStatus })
                .eq('id', uid);

            if (error) throw error;

            // Reload
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

    if (confirm('¿Estás seguro de que quieres borrar este usuario? Esta acción eliminará su perfil y datos asociados.')) {
        try {
            // Delete profile (Cascade should handle teams, matches etc if configured)
            // Schema has "on delete cascade" for most things linked to profiles?
            // "owner_id text references public.profiles(id) on delete cascade" -> YES.

            const { error } = await sb
                .from('profiles')
                .delete()
                .eq('id', uid);

            if (error) throw error;

            loadUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('Error borrando usuario: ' + error.message);
        }
    }
}

async function handleEditName(e) {
    const btn = e.target.closest('button');
    const uid = btn.dataset.uid;
    const currentName = btn.dataset.currentName;

    const newName = prompt('Introduce el nuevo nombre para el usuario:', currentName);

    if (newName && newName.trim() !== '' && newName !== currentName) {
        try {
            // Sanitizer not imported? Use basic check.
            const finalName = newName.trim();

            const { error } = await sb
                .from('profiles')
                .update({ display_name: finalName })
                .eq('id', uid);

            if (error) throw error;

            alert('Nombre actualizado correctamente.');
            loadUsers();
        } catch (error) {
            console.error('Error updating name:', error);
            alert('Error al actualizar el nombre: ' + error.message);
        }
    }
}
