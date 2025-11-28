document.addEventListener('DOMContentLoaded', () => {
    const adminsContainer = document.getElementById('adminsContainer');
    const diceBearManager = new DiceBearManager();
    const db = firebase.database();

    loadAdmins();

    async function loadAdmins() {
        try {
            const snapshot = await db.ref('public_admins').once('value');

            if (!snapshot.exists()) {
                adminsContainer.innerHTML = '<div class="col text-center"><p class="text-muted">No hay información del equipo disponible.</p></div>';
                return;
            }

            adminsContainer.innerHTML = '';
            const admins = snapshot.val();

            Object.keys(admins).forEach(uid => {
                const admin = admins[uid];
                const avatarUrl = diceBearManager.getImageForProfile(uid, admin.avatarConfig);

                const col = document.createElement('div');
                col.className = 'col';
                col.innerHTML = `
                    <div class="card h-100 shadow-sm border-0 text-center py-4">
                        <div class="mb-3">
                            <img src="${avatarUrl}" alt="${admin.name}" class="rounded-circle" style="width: 180px; height: 180px; object-fit: cover; background-color: #f8f9fa;">
                        </div>
                        <div class="card-body">
                            <h5 class="card-title fw-bold mb-0">${escapeHtml(admin.name)}</h5>
                            <p class="text-muted small mb-0">Administrador</p>
                        </div>
                    </div>
                `;
                adminsContainer.appendChild(col);
            });

        } catch (error) {
            console.error('Error loading admins:', error);
            adminsContainer.innerHTML = '<div class="col text-center"><p class="text-danger">Error al cargar el equipo.</p></div>';
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});
