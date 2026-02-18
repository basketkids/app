document.addEventListener('DOMContentLoaded', () => {
    const sb = window.supabaseClient;

    // Check auth
    sb.auth.onAuthStateChange((event, session) => {
        if (session) {
            loadNotifications(session.user.id);
            setupDeleteAll(session.user.id);
        } else {
            // Check if we are just loading
            // If strictly needed to be logged in:
            window.location.href = 'index.html';
        }
    });
});

function setupDeleteAll(uid) {
    const btn = document.getElementById('deleteAllBtn');
    const sb = window.supabaseClient;
    if (btn) {
        btn.onclick = async () => {
            if (confirm('¿Estás seguro de que quieres borrar todas las notificaciones?')) {
                const { error } = await sb
                    .from('notifications')
                    .delete()
                    .eq('user_id', uid);

                if (error) console.error('Error deleting all notifications:', error);
                else {
                    // UI will update via realtime or manual reload? 
                    // Let's manually reload list for simplicity/certainty
                    loadNotifications(uid);
                }
            }
        };
    }
}

function loadNotifications(uid) {
    const notificationsList = document.getElementById('notificationsList');
    const deleteAllBtn = document.getElementById('deleteAllBtn');
    const sb = window.supabaseClient;

    // Initial Load
    const fetchAndRender = async () => {
        const { data, error } = await sb
            .from('notifications')
            .select('*')
            .eq('user_id', uid)
            .order('created_at', { ascending: false });

        if (error) {
            console.error(error);
            return;
        }
        renderNotifications(data || [], uid);
    };

    fetchAndRender();

    // Subscribe to changes
    sb.channel('my-notifications')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
            (payload) => {
                fetchAndRender();
            }
        )
        .subscribe();
}

function renderNotifications(notifications, uid) {
    const notificationsList = document.getElementById('notificationsList');
    const deleteAllBtn = document.getElementById('deleteAllBtn');

    notificationsList.innerHTML = '';

    if (notifications.length === 0) {
        notificationsList.innerHTML = '<div class="alert alert-info text-center">No tienes notificaciones.</div>';
        if (deleteAllBtn) deleteAllBtn.style.display = 'none';
        return;
    }

    if (deleteAllBtn) deleteAllBtn.style.display = 'block';

    notifications.forEach(notif => {
        const item = document.createElement('div');
        item.className = `list-group-item list-group-item-action ${!notif.read ? 'active-notification' : ''} mb-2 border rounded shadow-sm d-flex align-items-center p-2`;
        item.style.cursor = 'pointer';
        item.style.transition = "transform 0.1s";
        item.onmouseover = () => item.style.transform = "scale(1.01)";
        item.onmouseout = () => item.style.transform = "scale(1)";

        item.onclick = (e) => handleNotificationClick(e, notif, uid);

        const date = new Date(notif.created_at).toLocaleString();

        let icon = '<i class="bi bi-info-circle-fill text-primary me-3 fs-4"></i>';
        let titleClass = 'text-primary';

        if (notif.type === 'new_follower') {
            icon = '<i class="bi bi-person-plus-fill text-success me-3 fs-4"></i>';
            titleClass = 'text-success';
        } else if (notif.type === 'scorer_request') {
            icon = '<i class="bi bi-pencil-square text-warning me-3 fs-4"></i>';
            titleClass = 'text-warning';
        } else if (notif.type === 'stats_update') {
            icon = '<i class="bi bi-bar-chart-fill text-info me-3 fs-4"></i>';
            titleClass = 'text-info';
        }

        let message = notif.message || '';
        // If message not set, construct from type/data
        if (!message && notif.data) {
            const d = notif.data;
            if (notif.type === 'new_follower') { // Legacy support if data structure varies
                message = '¡Tienes un nuevo seguidor en tu equipo!';
            } else if (notif.type === 'scorer_request') {
                message = `${d.requesterName || 'Un usuario'} ha solicitado permiso para anotar en un partido.`;
            }
        }

        item.innerHTML = `
    ${icon}
    <div class="flex-grow-1">
      <div class="d-flex w-100 justify-content-between align-items-center mb-1">
        <h5 class="mb-0 fw-bold ${titleClass}">${notif.title || 'Notificación'}</h5>
        <small class="text-muted ms-2"><i class="bi bi-clock"></i> ${date}</small>
      </div>
      <p class="mb-1 text-dark">${message}</p>
      ${!notif.read ? '<span class="badge bg-danger rounded-pill">Nueva</span>' : ''}
    </div>
    <button class="btn btn-link text-danger ms-3 delete-btn" title="Borrar notificación">
        <i class="bi bi-trash"></i>
    </button>
  `;

        const deleteBtn = item.querySelector('.delete-btn');
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteNotification(uid, notif.id);
        };

        notificationsList.appendChild(item);
    });
}

async function deleteNotification(uid, notifId) {
    if (confirm('¿Borrar esta notificación?')) {
        const sb = window.supabaseClient;
        const { error } = await sb
            .from('notifications')
            .delete()
            .eq('id', notifId);

        if (error) console.error('Error deleting notification:', error);
    }
}

async function handleNotificationClick(e, notif, uid) {
    e.preventDefault();
    const sb = window.supabaseClient;

    if (!notif.read) {
        await sb
            .from('notifications')
            .update({ read: true })
            .eq('id', notif.id);
    }

    // Access 'data' JSON column 
    const data = notif.data || {};

    if (data.link) {
        window.location.href = data.link;
    } else if (notif.type === 'scorer_request' && data.matchId) {
        if (data.teamId && data.compId && data.matchId) {
            window.location.href = `partido.html?idEquipo=${data.teamId}&idCompeticion=${data.compId}&idPartido=${data.matchId}`;
        } else {
            // Fallback
            window.location.href = `partido.html`;
        }
    } else if (notif.type === 'new_follower' && data.teamId) {
        window.location.href = `equipo.html?idEquipo=${data.teamId}&section=miembros`;
    } else if (data.teamId) {
        window.location.href = `equipo.html?idEquipo=${data.teamId}`;
    }
}
