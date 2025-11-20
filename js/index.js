firebase.initializeApp(window.firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

const teamsList = document.getElementById('teamsList');
const inputEquipoModal = document.getElementById('inputEquipoModal');
const addTeamForm = document.getElementById('addTeamForm');

const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

let currentUser = null;
let equipoIdABorrar = null;

addTeamForm.addEventListener('submit', e => {
    e.preventDefault();

    if (!currentUser) {
        alert('Debes iniciar sesión');
        return;
    }

    const nombre = inputEquipoModal.value.trim();
    if (!nombre) {
        alert('Introduce un nombre válido');
        return;
    }

    const nuevoRef = db.ref(`usuarios/${currentUser.uid}/equipos`).push();
    nuevoRef.set({ nombre })
        .then(() => {
            inputEquipoModal.value = '';
            const modalEl = document.getElementById('addTeamModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        })
        .catch(err => alert('Error: ' + err.message));
});

confirmDeleteBtn.addEventListener('click', () => {
    if (!currentUser || !equipoIdABorrar) return;

    db.ref(`usuarios/${currentUser.uid}/equipos/${equipoIdABorrar}`).remove()
        .then(() => {
            equipoIdABorrar = null;
            const modalEl = document.getElementById('confirmDeleteModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        })
        .catch(err => alert('Error al borrar equipo: ' + err.message));
});

auth.onAuthStateChanged(user => {
    currentUser = user;
    if (user) {
        listarEquipos();
    } else {
        window.location.href = 'public/';
    }
});

function listarEquipos() {
    teamsList.innerHTML = '';
    if (!currentUser) return;
    db.ref(`usuarios/${currentUser.uid}/equipos`).on('value', snapshot => {
        teamsList.innerHTML = '';
        if (!snapshot.exists()) {
            teamsList.innerHTML = '<li class="list-group-item">No tienes equipos creados</li>';
            return;
        }
        snapshot.forEach(equipoSnap => {
            const equipo = equipoSnap.val();




            const li = document.createElement('s');
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
            btnGestionar.href = `equipo.html?idEquipo=${equipoSnap.key}`;
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
                equipoIdABorrar = equipoSnap.key;
            };
            botonesContainer.appendChild(btnBorrar);

            // Añadir los botones al li
            li.appendChild(botonesContainer);
            teamsList.appendChild(li);
        });
    });
}
