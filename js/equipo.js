firebase.initializeApp(window.firebaseConfig);

const auth = firebase.auth();
const db = firebase.database();

const teamNameSpan = document.getElementById('teamName');

// Plantilla
const inputJugadorNombre = document.getElementById('inputJugadorNombre');
const inputJugadorDorsal = document.getElementById('inputJugadorDorsal');
const addPlayerForm = document.getElementById('addPlayerForm');
const playersList = document.getElementById('playersList');

// Competiciones
const nuevoCompeticionBtn = document.getElementById('nuevoCompeticionBtn');
const competicionesList = document.getElementById('competicionesList');
const addCompeticionForm = document.getElementById('addCompeticionForm');
const inputNombreCompeticion = document.getElementById('inputNombreCompeticion');

const menuEquipo = document.getElementById('menuEquipo');
const seccionPlantilla = document.getElementById('seccion-plantilla');
const seccionCompeticiones = document.getElementById('seccion-competiciones');

let currentUser = null;
let currentTeamId = null;


auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "index.html";
  } else {
    currentUser = user;
    loadTeamFromUrl();
  }
});

menuEquipo.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const seccion = e.target.getAttribute('data-seccion');
    menuEquipo.querySelectorAll('a').forEach(a => a.classList.remove('active'));
    e.target.classList.add('active');
    seccionPlantilla.style.display = seccion === 'plantilla' ? 'block' : 'none';
    seccionCompeticiones.style.display = seccion === 'competiciones' ? 'block' : 'none';
  });
});

function loadTeamFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) {
    alert('No se especificó equipo');
    window.location.href = 'index.html';
    return;
  }
  currentTeamId = id;
  loadTeamData();
}

function loadTeamData() {
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}`).once('value').then(snap => {
    if (!snap.exists()) {
      alert('Equipo no encontrado o no tienes permiso');
      window.location.href = 'index.html';
      return;
    }
    const team = snap.val();
    teamNameSpan.textContent = team.nombre;
    loadPlantilla();
    loadCompeticiones();
  });
}

// Plantilla jugadores
addPlayerForm.addEventListener('submit', e => {
  e.preventDefault();
  const nombre = inputJugadorNombre.value.trim();
  const dorsal = inputJugadorDorsal.value.trim();
  if (!nombre || !dorsal) return alert('Introduce nombre y dorsal');

  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/plantilla`).push({ nombre, dorsal })
    .then(() => {
      inputJugadorNombre.value = '';
      inputJugadorDorsal.value = '';
      bootstrap.Modal.getInstance(addPlayerForm.closest('.modal')).hide();
    });
});

function loadPlantilla() {
  playersList.innerHTML = '';
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/plantilla`).on('value', snapshot => {
    playersList.innerHTML = '';
    if (!snapshot.exists()) return;

    snapshot.forEach(jugadorSnap => {
      const jugador = jugadorSnap.val();
      const key = jugadorSnap.key;

      const li = document.createElement('li');
      li.classList.add('list-group-item');

      li.textContent = `${jugador.dorsal} - ${jugador.nombre}`;
      playersList.appendChild(li);
    });
  });
}

// Gestión competiciones

nuevoCompeticionBtn.addEventListener('click', () => {
  const modal = new bootstrap.Modal(document.getElementById('addCompeticionModal'));
  inputNombreCompeticion.value = '';
  modal.show();
});

addCompeticionForm.addEventListener('submit', e => {
  e.preventDefault();
  const nombre = inputNombreCompeticion.value.trim();
  if (!nombre) return alert('Introduce nombre de competición');

  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones`).push({ nombre })
    .then(() => {
      inputNombreCompeticion.value = '';
      bootstrap.Modal.getInstance(addCompeticionForm.closest('.modal')).hide();
    });
});

function loadCompeticiones() {
  competicionesList.innerHTML = '';
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones`).on('value', snapshot => {
    competicionesList.innerHTML = '';
    if (!snapshot.exists()) {
      competicionesList.innerHTML = '<li class="list-group-item">No hay competiciones creadas</li>';
      return;
    }
    snapshot.forEach(compSnap => {
      const competicion = compSnap.val();
      const key = compSnap.key;

      const li = document.createElement('li');
      li.classList.add('list-group-item', 'd-flex', 'justify-content-between', 'align-items-center');

      li.textContent = competicion.nombre;

      const btnAbrir = document.createElement('a');
      btnAbrir.href = `competicion.html?idEquipo=${currentTeamId}&idCompeticion=${key}`;
      btnAbrir.classList.add('btn', 'btn-sm', 'btn-primary');
      btnAbrir.textContent = 'Abrir';
      li.appendChild(btnAbrir);

      competicionesList.appendChild(li);
    });
  });
}
