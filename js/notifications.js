document.addEventListener('DOMContentLoaded', () => {
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            loadNotifications(user.uid);
            setupDeleteAll(user.uid);
        } else {
            window.location.href = 'index.html';
        }
    });
});

function setupDeleteAll(uid) {
    const btn = document.getElementById('deleteAllBtn');
    if (btn) {
        btn.onclick = () => {
            if (confirm('¿Estás seguro de que quieres borrar todas las notificaciones?')) {
                firebase.database().ref(`usuarios/${uid}/notifications`).remove()
                    .then(() => {
                        // UI update handled by on('value') listener
                    })
                    .catch(err => console.error('Error deleting all notifications:', err));
            }
        };
    }
}

function loadNotifications(uid) {
    const notificationsList = document.getElementById('notificationsList');
    const deleteAllBtn = document.getElementById('deleteAllBtn');
    const db = firebase.database();

    db.ref(`usuarios/${uid}/notifications`).orderByChild('timestamp').on('value', snapshot => {
        notificationsList.innerHTML = '';

        if (!snapshot.exists()) {
            notificationsList.innerHTML = '<div class="alert alert-info text-center">No tienes notificaciones.</div>';
            if (deleteAllBtn) deleteAllBtn.style.display = 'none';
            return;
        }

        if (deleteAllBtn) deleteAllBtn.style.display = 'block';

        const notifications = [];
        snapshot.forEach(child => {
            notifications.push({ id: child.key, ...child.val() });
        });

        // Sort by timestamp descending
        notifications.sort((a, b) => b.timestamp - a.timestamp);

        notifications.forEach(notif => {
            const item = document.createElement('div'); // Changed to div to handle nested buttons better
            item.className = `list-group-item list-group-item-action ${!notif.read ? 'active-notification' : ''} mb-2 border rounded shadow-sm d-flex align-items-center p-2`;
            item.style.cursor = 'pointer';
            item.style.transition = "transform 0.1s";
            item.onmouseover = () => item.style.transform = "scale(1.01)";
            item.onmouseout = () => item.style.transform = "scale(1)";

            // Main click handler
            item.onclick = (e) => handleNotificationClick(e, notif, uid);

            const date = new Date(notif.timestamp).toLocaleString();

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
            if (!message) {
                if (notif.type === 'new_follower') {
                    message = '¡Tienes un nuevo seguidor en tu equipo!';
                } else if (notif.type === 'scorer_request') {
                    message = `${notif.requesterName || 'Un usuario'} ha solicitado permiso para anotar en un partido.`;
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

            // Add delete listener specifically to the button
            const deleteBtn = item.querySelector('.delete-btn');
            deleteBtn.onclick = (e) => {
                e.stopPropagation(); // Prevent triggering the main click
                deleteNotification(uid, notif.id);
            };

            notificationsList.appendChild(item);
        });
    });
}

function deleteNotification(uid, notifId) {
    if (confirm('¿Borrar esta notificación?')) {
        firebase.database().ref(`usuarios/${uid}/notifications/${notifId}`).remove()
            .catch(err => console.error('Error deleting notification:', err));
    }
}

async function handleNotificationClick(e, notif, uid) {
    e.preventDefault();

    // Mark as read
    if (!notif.read) {
        await firebase.database().ref(`usuarios/${uid}/notifications/${notif.id}`).update({ read: true });
    }

    // Action based on type
    if (notif.link) {
        window.location.href = notif.link;
    } else if (notif.type === 'scorer_request' && notif.matchId) {
        if (notif.teamId && notif.compId && notif.matchId) {
            window.location.href = `partido.html?idEquipo=${notif.teamId}&idCompeticion=${notif.compId}&idPartido=${notif.matchId}`;
        } else {
            window.location.href = `public/partido.html?id=${notif.matchId}`;
        }
    } else if (notif.type === 'new_follower' && notif.teamId) {
        window.location.href = `equipo.html?idEquipo=${notif.teamId}&section=miembros`;
    } else if (notif.teamId) {
        window.location.href = `equipo.html?idEquipo=${notif.teamId}`;
    }
}
