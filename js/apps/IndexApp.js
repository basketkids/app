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
        this.setupEventListeners();
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

        this.teamService.getAll(this.currentUser.uid, snapshot => {
            this.teamsList.innerHTML = '';
            if (!snapshot.exists()) {
                this.teamsList.innerHTML = '<li class="list-group-item">No tienes equipos creados</li>';
                return;
            }
            snapshot.forEach(equipoSnap => {
                const equipo = equipoSnap.val();
                this.renderTeamItem(equipo, equipoSnap.key);
            });
        });
    }

    renderTeamItem(equipo, key) {
        const li = document.createElement('li');
        li.classList.add('list-group-item', 'd-flex', 'justify-content-between', 'align-items-center');

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
        botonesContainer.appendChild(btnGestionar);

        // Botón borrar
        const btnBorrar = document.createElement('button');
        btnBorrar.classList.add('btn', 'btn-sm', 'btn-danger');
        btnBorrar.title = 'Borrar equipo';
        btnBorrar.dataset.bsToggle = 'modal';
        btnBorrar.dataset.bsTarget = '#confirmDeleteModal';
        btnBorrar.innerHTML = '<i class="bi bi-trash-fill"></i>';
        btnBorrar.onclick = () => {
            this.equipoIdABorrar = key;
        };
        botonesContainer.appendChild(btnBorrar);

        // Añadir los botones al li
        li.appendChild(botonesContainer);
        this.teamsList.appendChild(li);
    }
}
