class IndexApp extends BaseApp {
    constructor() {
        super();
        this.teamService = new TeamService(this.db);
        this.teamsList = document.getElementById('teamsList');
        this.inputEquipoModal = document.getElementById('inputEquipoModal');
        this.addTeamForm = document.getElementById('addTeamForm');
        this.confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        this.equipoIdABorrar = null;
    }

    onUserLoggedIn(user) {
        this.listarEquipos();
        this.loadNotifications();
        this.setupEventListeners();
    }

    loadNotifications() {
        if (!this.currentUser) return;

        const notificationsRef = this.db.ref(`usuarios/${this.currentUser.uid}/notifications`);
        notificationsRef.on('value', snapshot => {
            const notifications = snapshot.val() || {};
            this.renderNotifications(notifications);
        });
    }

    renderNotifications(notifications) {
        const list = document.getElementById('listNotifications');
        const badge = document.getElementById('badgeNotifications');
        if (!list) return;

        list.innerHTML = '';
        const entries = Object.entries(notifications).sort((a, b) => b[1].timestamp - a[1].timestamp);
        const count = entries.length;

        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline-block' : 'none';
        }

        if (count === 0) {
            list.innerHTML = '<li class="list-group-item text-center text-muted">No tienes notificaciones</li>';
            return;
        }

        entries.forEach(([key, notif]) => {
            const li = document.createElement('li');
            li.className = 'modern-list-item';

            const divContent = document.createElement('div');
            const date = new Date(notif.timestamp).toLocaleDateString();

            if (notif.type === 'new_follower') {
                divContent.innerHTML = `
                    <div class="fw-bold">Nuevo seguidor</div>
                    <div class="small">Un usuario ha comenzado a seguir a tu equipo.</div>
                    <div class="text-muted small" style="font-size: 0.75rem;">${date}</div>
                `;
            } else if (notif.type === 'scorer_request') {
                divContent.innerHTML = `
                    <div class="fw-bold">Solicitud de anotador</div>
                    <div class="small">${notif.requesterName} quiere anotar en un partido.</div>
                    <div class="text-muted small" style="font-size: 0.75rem;">${date}</div>
                `;
            } else {
                divContent.textContent = 'Notificación desconocida';
            }
            li.appendChild(divContent);

            const divActions = document.createElement('div');
            divActions.className = 'd-flex gap-2';

            if (notif.type === 'scorer_request') {
                const btnApprove = document.createElement('button');
                btnApprove.className = 'btn btn-sm btn-success';
                btnApprove.innerHTML = '<i class="bi bi-check-lg"></i>';
                btnApprove.title = 'Aprobar';
                btnApprove.onclick = () => this.approveScorerRequest(key, notif);
                divActions.appendChild(btnApprove);
            }

            const btnDismiss = document.createElement('button');
            btnDismiss.className = 'btn btn-sm btn-outline-secondary';
            btnDismiss.innerHTML = '<i class="bi bi-x-lg"></i>';
            btnDismiss.title = 'Descartar';
            btnDismiss.onclick = () => this.dismissNotification(key);
            divActions.appendChild(btnDismiss);

            li.appendChild(divActions);
            list.appendChild(li);
        });
    }

    async approveScorerRequest(notificationId, notif) {
        if (!confirm(`¿Aprobar a ${notif.requesterName} como estadista?`)) return;

        try {
            // 1. Add as statistician
            await this.db.ref(`usuarios/${this.currentUser.uid}/equipos/${notif.teamId}/members/${notif.requesterUid}`).set({
                role: 'statistician',
                addedAt: firebase.database.ServerValue.TIMESTAMP
            });

            // 2. Remove the original request from the match
            await this.db.ref(`usuarios/${this.currentUser.uid}/equipos/${notif.teamId}/competiciones/${notif.compId}/partidos/${notif.matchId}/requests/${notif.requesterUid}`).remove();

            // 3. Dismiss notification
            await this.dismissNotification(notificationId);

            alert(`${notif.requesterName} ha sido aprobado.`);
        } catch (error) {
            console.error('Error approving request:', error);
            alert('Error al aprobar la solicitud');
        }
    }

    async dismissNotification(notificationId) {
        try {
            await this.db.ref(`usuarios/${this.currentUser.uid}/notifications/${notificationId}`).remove();
        } catch (error) {
            console.error('Error dismissing notification:', error);
        }
    }

    handleNoUser() {
        // On index page, if no user, we might want to show login button or redirect to public
        // But original code redirected to public/ if no user
        window.location.href = 'public/';
    }

    setupEventListeners() {
        this.addTeamForm.addEventListener('submit', e => this.handleAddTeam(e));
        this.confirmDeleteBtn.addEventListener('click', () => this.handleDeleteTeam());
    }

    handleAddTeam(e) {
        e.preventDefault();
        if (!this.currentUser) return;

        const nombre = this.inputEquipoModal.value.trim();
        if (!nombre) {
            alert('Introduce un nombre válido');
            return;
        }

        this.teamService.create(this.currentUser.uid, nombre)
            .then(() => {
                this.inputEquipoModal.value = '';
                const modalEl = document.getElementById('addTeamModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
            })
            .catch(err => alert('Error: ' + err.message));
    }

    handleDeleteTeam() {
        if (!this.currentUser || !this.equipoIdABorrar) return;

        this.teamService.delete(this.currentUser.uid, this.equipoIdABorrar)
            .then(() => {
                this.equipoIdABorrar = null;
                const modalEl = document.getElementById('confirmDeleteModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
            })
            .catch(err => alert('Error al borrar equipo: ' + err.message));
    }

    listarEquipos() {
        this.teamsList.innerHTML = '';
        if (!this.currentUser) return;

        // 1. Listar equipos propios
        this.teamService.getAll(this.currentUser.uid, snapshot => {
            this.teamsList.innerHTML = ''; // Limpiar antes de repoblar
            if (snapshot.exists()) {
                snapshot.forEach(equipoSnap => {
                    const equipo = equipoSnap.val();
                    this.renderTeamItem(equipo, equipoSnap.key);
                });
            } else {
                this.teamsList.innerHTML = '<li class="modern-list-item justify-content-center text-muted">No tienes equipos creados</li>';
            }
        });

        // 2. Listar equipos seguidos
        const followedList = document.getElementById('followedTeamsList');
        if (followedList) {
            followedList.innerHTML = '';
            this.db.ref(`usuarios/${this.currentUser.uid}/following`).on('value', async snapshot => {
                followedList.innerHTML = '';
                if (!snapshot.exists()) {
                    followedList.innerHTML = '<li class="modern-list-item justify-content-center text-muted">No sigues a ningún equipo</li>';
                    return;
                }

                const promises = [];
                snapshot.forEach(child => {
                    const teamId = child.key;
                    const data = child.val();
                    const ownerUid = data.ownerUid;

                    if (ownerUid) {
                        const p = this.teamService.getName(ownerUid, teamId).then(nameSnap => {
                            return {
                                id: teamId,
                                name: nameSnap.val() || 'Equipo sin nombre',
                                ownerUid: ownerUid
                            };
                        }).catch(() => null);
                        promises.push(p);
                    }
                });

                const teams = await Promise.all(promises);
                teams.filter(t => t).forEach(team => {
                    this.renderFollowedTeamItem(team, followedList);
                });
            });
        }
    }

    renderFollowedTeamItem(team, container) {
        const li = document.createElement('li');
        li.classList.add('modern-list-item');
        li.style.cursor = 'pointer';
        li.onclick = () => {
            window.location.href = `equipo.html?idEquipo=${team.id}&ownerUid=${team.ownerUid}`;
        };

        const spanNombre = document.createElement('span');
        spanNombre.textContent = team.name;
        li.appendChild(spanNombre);

        const btnVer = document.createElement('a');
        btnVer.href = `equipo.html?idEquipo=${team.id}&ownerUid=${team.ownerUid}`; // View as read-only
        btnVer.classList.add('btn', 'btn-sm', 'btn-info');
        btnVer.innerHTML = '<i class="bi bi-eye-fill"></i>';
        btnVer.onclick = (e) => e.stopPropagation();

        li.appendChild(btnVer);
        container.appendChild(li);
    }

    renderTeamItem(equipo, key) {
        const li = document.createElement('li');
        li.classList.add('modern-list-item');
        li.style.cursor = 'pointer';
        li.onclick = () => {
            window.location.href = `equipo.html?idEquipo=${key}`;
        };

        // Contenido del equipo (nombre)
        const spanNombre = document.createElement('span');
        spanNombre.textContent = equipo.nombre;
        li.appendChild(spanNombre);

        // Contenedor para los botones (alineados a la derecha)
        const botonesContainer = document.createElement('div');
        botonesContainer.classList.add('d-flex', 'gap-2', 'justify-content-end');

        // Botón gestionar
        const btnGestionar = document.createElement('a');
        btnGestionar.href = `equipo.html?idEquipo=${key}`;
        btnGestionar.classList.add('btn', 'btn-sm', 'btn-warning');
        btnGestionar.title = 'Gestionar equipo';
        btnGestionar.innerHTML = '<i class="bi bi-pencil-fill"></i>';
        btnGestionar.onclick = (e) => e.stopPropagation();
        botonesContainer.appendChild(btnGestionar);

        // Botón borrar
        const btnBorrar = document.createElement('button');
        btnBorrar.classList.add('btn', 'btn-sm', 'btn-danger');
        btnBorrar.title = 'Borrar equipo';
        btnBorrar.dataset.bsToggle = 'modal';
        btnBorrar.dataset.bsTarget = '#confirmDeleteModal';
        btnBorrar.innerHTML = '<i class="bi bi-trash-fill"></i>';
        btnBorrar.onclick = (e) => {
            e.stopPropagation();
            this.equipoIdABorrar = key;
        };
        botonesContainer.appendChild(btnBorrar);

        // Añadir los botones al li
        li.appendChild(botonesContainer);
        this.teamsList.appendChild(li);
    }
}
