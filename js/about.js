document.addEventListener('DOMContentLoaded', () => {
    const adminsContainer = document.getElementById('adminsContainer');
    const diceBearManager = new DiceBearManager();
    const sb = window.supabaseClient;

    loadAdmins();

    async function loadAdmins() {
        try {
            // In Supabase, we query 'profiles' where is_admin is true.
            // Ensure RLS allows reading these profiles publicly!
            const { data: admins, error } = await sb
                .from('profiles')
                .select('*')
                .eq('is_admin', true);

            if (error) throw error;

            if (!admins || admins.length === 0) {
                adminsContainer.innerHTML = '<div class="col text-center"><p class="text-muted">No hay información del equipo disponible.</p></div>';
                return;
            }

            adminsContainer.innerHTML = '';

            admins.forEach(admin => {
                // Use profile fields.
                // admin.photo_url or use DiceBear with ID/config
                const avatarUrl = admin.photo_url || diceBearManager.getImageForProfile(admin.id, null);
                const name = admin.display_name || admin.email || 'Admin';

                const col = document.createElement('div');
                col.className = 'col';
                col.innerHTML = `
                    <div class="card h-100 shadow-sm border-0 text-center py-4">
                        <div class="mb-3">
                            <img src="${avatarUrl}" alt="${escapeHtml(name)}" class="rounded-circle" style="width: 180px; height: 180px; object-fit: cover; background-color: #f8f9fa;">
                        </div>
                        <div class="card-body">
                            <h5 class="card-title fw-bold mb-0">${escapeHtml(name)}</h5>
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
        if (typeof Sanitizer !== 'undefined') return Sanitizer.escape(text);
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});
