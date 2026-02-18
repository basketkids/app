class IndexApp extends BaseApp {
    constructor() {
        super();
        this.teamService = new TeamService(); // No db arg needed
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

        const fetchNotifications = async () => {
            const { data, error } = await this.supabase
                .from('notifications')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .order('created_at', { ascending: false }); // Supabase uses created_at

            if (data) {
                this.renderNotifications(data);
            }
        };

        // Initial fetch
        fetchNotifications();

        // Subscription
        this.supabase
            .channel('public:notifications')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${this.currentUser.id}` },
                () => fetchNotifications()
            )
            .subscribe();
    }

    renderNotifications(notifications) {
        // notifications is an array
        const list = document.getElementById('listNotifications');
        const badge = document.getElementById('badgeNotifications');
        if (!list) return;

        list.innerHTML = '';
        const count = notifications.length;

        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline-block' : 'none';
        }

        if (count === 0) {
            list.innerHTML = '<li class="list-group-item text-center text-muted">No tienes notificaciones</li>';
            return;
        }

        notifications.forEach(notif => {
            const li = document.createElement('li');
            li.className = 'modern-list-item';

            const divContent = document.createElement('div');
            const date = new Date(notif.created_at || notif.timestamp).toLocaleDateString();

            if (notif.type === 'new_follower') {
                divContent.innerHTML = `
                    <div class="fw-bold">Nuevo seguidor</div>
                    <div class="small">Un usuario ha comenzado a seguir a tu equipo.</div>
                    <div class="text-muted small" style="font-size: 0.75rem;">${date}</div>
                `;
            } else if (notif.type === 'scorer_request') {
                const requesterName = notif.data?.requesterName || 'Usuario';
                divContent.innerHTML = `
                    <div class="fw-bold">Solicitud de anotador</div>
                    <div class="small">${requesterName} quiere anotar en un partido.</div>
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
                btnApprove.onclick = () => this.approveScorerRequest(notif.id, notif);
                divActions.appendChild(btnApprove);
            }

            const btnDismiss = document.createElement('button');
            btnDismiss.className = 'btn btn-sm btn-outline-secondary';
            btnDismiss.innerHTML = '<i class="bi bi-x-lg"></i>';
            btnDismiss.title = 'Descartar';
            btnDismiss.onclick = () => this.dismissNotification(notif.id);
            divActions.appendChild(btnDismiss);

            li.appendChild(divActions);
            list.appendChild(li);
        });
    }

    async approveScorerRequest(notificationId, notif) {
        const requesterName = notif.data?.requesterName || 'el usuario';
        if (!confirm(`¿Aprobar a ${requesterName} como estadista?`)) return;

        const { teamId, requesterUid, compId, matchId } = notif.data;

        try {
            // 1. Add as statistician (insert into team_members or similar logic?)
            // Legacy: db.ref(...members...).set({ role: 'statistician' })
            // Supabase: insert into team_members
            const { error: memberError } = await this.supabase
                .from('team_members')
                .upsert({
                    team_id: teamId,
                    user_id: requesterUid,
                    role: 'statistician'
                });

            if (memberError) throw memberError;

            // 2. Remove the original request from the match
            // Legacy: db.ref(...requests...).remove()
            // Supabase: in match_events? Or match_requests table? 
            // The schema has 'match_events' but no 'requests' table.
            // Maybe requests are stored in a separate table or jsonb?
            // "requests" in Firebase path .../partidos/.../requests
            // I should create a 'match_requests' table or assume it's handled.
            // For now, removing the notification is the main thing.

            // 3. Dismiss notification
            await this.dismissNotification(notificationId);

            alert(`${requesterName} ha sido aprobado.`);
        } catch (error) {
            console.error('Error approving request:', error);
            alert('Error al aprobar la solicitud: ' + error.message);
        }
    }

    async dismissNotification(notificationId) {
        try {
            await this.supabase
                .from('notifications')
                .delete()
                .eq('id', notificationId);
        } catch (error) {
            console.error('Error dismissing notification:', error);
        }
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
        this.teamService.getAll(this.currentUser.uid, teams => {
            this.teamsList.innerHTML = ''; // Limpiar antes de repoblar
            if (teams && teams.length > 0) {
                teams.forEach(equipo => {
                    // Map Supabase fields to renderTeamItem
                    // renderTeamItem expects object with { nombre } and key
                    // Supabase returns { name, id }
                    const mappedTeam = { nombre: equipo.name };
                    this.renderTeamItem(mappedTeam, equipo.id);
                });
            } else {
                this.teamsList.innerHTML = '<li class="modern-list-item justify-content-center text-muted">No tienes equipos creados</li>';
            }
        });

        // 2. Listar equipos seguidos
        this.listFollowedTeams();
    }

    async listFollowedTeams() {
        const followedList = document.getElementById('followedTeamsList');
        if (!followedList) return;

        // Fetch followed teams
        // Join with teams table
        const { data: followed, error } = await this.supabase
            .from('team_followers')
            .select(`
                team_id,
                teams (
                    id,
                    name,
                    owner_id
                )
            `)
            .eq('user_id', this.currentUser.uid);

        followedList.innerHTML = '';

        if (error || !followed || followed.length === 0) {
            followedList.innerHTML = '<li class="modern-list-item justify-content-center text-muted">No sigues a ningún equipo</li>';
            return;
        }

        followed.forEach(item => {
            if (item.teams) {
                const teamData = {
                    id: item.teams.id,
                    name: item.teams.name,
                    ownerUid: item.teams.owner_id
                };
                this.renderFollowedTeamItem(teamData, followedList);
            }
        });
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
        btnVer.href = `equipo.html?idEquipo=${team.id}&ownerUid=${team.ownerUid}`;
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
