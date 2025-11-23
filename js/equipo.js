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
  const id = params.get('idEquipo');
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
function calcularPuntosFantasy(stats) {
  if (!stats) return 0;
  return (stats.puntos || 0) * 1 +
    (stats.rebotes || 0) * 1 +
    (stats.asistencias || 0) * 2 +
    (stats.tapones || 0) * 3 +
    (stats.robos || 0) * 3 -
    (stats.faltas || 0) * 1;
}

async function loadPlantilla() {
  playersList.innerHTML = '';
  const jugadoresSnap = await db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/plantilla`).once('value');
  if (!jugadoresSnap.exists()) {
    playersList.innerHTML = '<li class="list-group-item">No hay jugadores añadidos</li>';
    return;
  }

  const jugadoresArray = [];
  jugadoresSnap.forEach(jugadorSnap => {
    const jugador = jugadorSnap.val();
    const key = jugadorSnap.key;
    jugadoresArray.push({ key, ...jugador });
  });

  // Ordenar por dorsal numérico ascendente
  jugadoresArray.sort((a, b) => (a.dorsal || 0) - (b.dorsal || 0));

  // Cargar medias globales de estadísticas de todos los jugadores
  const mediasGlobales = await calcularMediasEquipoDiccionario(currentTeamId);

  // Crear tabla responsive para escritorio/tablet
  const table = document.createElement('table');
  table.className = 'table table-striped table-bordered table-sm d-none d-md-table';

  // Encabezado tabla
  const thead = document.createElement('thead');
  const trHead = document.createElement('tr');
  ['Dorsal', 'Nombre', 'Pts/Juego', 'Partidos', 'Asist.', 'Rebotes', 'Robos', 'Tapones', 'Faltas', 'Valoración', 'Acciones'].forEach(thText => {
    const th = document.createElement('th');
    th.textContent = thText;
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  jugadoresArray.forEach(jugador => {
    const stats = mediasGlobales[jugador.key] || null;

    const tr = document.createElement('tr');

    // Columna dorsal
    const tdDorsal = document.createElement('td');
    tdDorsal.textContent = jugador.dorsal || '';
    tr.appendChild(tdDorsal);

    // Columna nombre
    const tdNombre = document.createElement('td');
    tdNombre.textContent = jugador.nombre || '';
    tr.appendChild(tdNombre);

    if (stats) {
      // Mostrar medias calculadas
      const tdPts = document.createElement('td');
      tdPts.textContent = stats.puntos.toFixed(2);
      tr.appendChild(tdPts);

      const tdPartidos = document.createElement('td');
      tdPartidos.textContent = stats.partidosJugados;
      tr.appendChild(tdPartidos);

      const tdAsist = document.createElement('td');
      tdAsist.textContent = stats.asistencias.toFixed(2);
      tr.appendChild(tdAsist);

      const tdReb = document.createElement('td');
      tdReb.textContent = stats.rebotes.toFixed(2);
      tr.appendChild(tdReb);

      const tdRobos = document.createElement('td');
      tdRobos.textContent = stats.robos.toFixed(2);
      tr.appendChild(tdRobos);

      const tdTap = document.createElement('td');
      tdTap.textContent = stats.tapones.toFixed(2);
      tr.appendChild(tdTap);

      const tdFaltas = document.createElement('td');
      tdFaltas.textContent = stats.faltas.toFixed(2);
      tr.appendChild(tdFaltas);

      const tdVal = document.createElement('td');
      tdVal.textContent = stats.valoracionFantasy.toFixed(2);
      tr.appendChild(tdVal);
    } else {
      // Si no hay stats, dejar vacíos o con 0
      ['tdPts', 'tdPartidos', 'tdAsist', 'tdReb', 'tdRobos', 'tdTap', 'tdFaltas', 'tdVal'].forEach(() => {
        const td = document.createElement('td');
        td.textContent = '-';
        tr.appendChild(td);
      });
    }

    // Acciones (botones)
    const tdAcciones = document.createElement('td');
    tdAcciones.className = 'd-flex gap-2';

    const btnEditar = document.createElement('a');
    btnEditar.className = 'btn btn-primary btn-sm';
    btnEditar.href = `jugadores.html?idJugador=${encodeURIComponent(jugador.key)}&idEquipo=${encodeURIComponent(currentTeamId)}`;
    btnEditar.title = 'Editar jugador';
    btnEditar.innerHTML = '<i class="bi bi-pencil"></i>';

    const btnBorrar = document.createElement('button');
    btnBorrar.className = 'btn btn-danger btn-sm';
    btnBorrar.title = 'Borrar jugador';
    btnBorrar.innerHTML = '<i class="bi bi-trash"></i>';
    btnBorrar.addEventListener('click', () => {
      confirmarBorradoJugador(jugador.key, jugador.nombre);
    });

    tdAcciones.appendChild(btnEditar);
    tdAcciones.appendChild(btnBorrar);

    tr.appendChild(tdAcciones);
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  playersList.innerHTML = '';
  playersList.appendChild(table);

  // Vista móvil vertical (pantallas pequeñas < md)
  // Mostrar sólo valoración, puntos y botones (editar, borrar)
  const listaMovil = document.createElement('ul');
  listaMovil.className = 'list-group d-block d-md-none';

  jugadoresArray.forEach(jugador => {
    const stats = mediasGlobales[jugador.key] || null;

    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between align-items-center';

    const divInfo = document.createElement('div');
    if (stats) {
      divInfo.innerHTML = `<strong>${jugador.nombre} (#${jugador.dorsal})</strong><br/>Pts: ${stats.puntos.toFixed(2)} | Val: ${stats.valoracionFantasy.toFixed(2)}`;
    } else {
      divInfo.innerHTML = `<strong>${jugador.nombre} (#${jugador.dorsal})</strong><br/>Sin estadísticas`;
    }

    const divBotones = document.createElement('div');

    const btnEditar = document.createElement('a');
    btnEditar.className = 'btn btn-primary btn-sm me-1';
    btnEditar.href = `jugadores.html?idJugador=${encodeURIComponent(jugador.key)}&idEquipo=${encodeURIComponent(currentTeamId)}`;
    btnEditar.title = 'Editar jugador';
    btnEditar.innerHTML = '<i class="bi bi-pencil"></i>';

    const btnBorrar = document.createElement('button');
    btnBorrar.className = 'btn btn-danger btn-sm';
    btnBorrar.title = 'Borrar jugador';
    btnBorrar.innerHTML = '<i class="bi bi-trash"></i>';
    btnBorrar.addEventListener('click', () => {
      confirmarBorradoJugador(jugador.key, jugador.nombre);
    });

    divBotones.appendChild(btnEditar);
    divBotones.appendChild(btnBorrar);

    li.appendChild(divInfo);
    li.appendChild(divBotones);

    listaMovil.appendChild(li);
  });

  playersList.appendChild(listaMovil);
}


async function calcularMediasEquipoDiccionario(equipoID) {
  const equipoPath = `usuarios/${currentUser.uid}/equipos/${equipoID}/competiciones`;
  const competicionesSnap = await db.ref(equipoPath).once('value');

  const mediasPorJugador = {};

  competicionesSnap.forEach(compSnap => {
    const partidosSnap = compSnap.child('partidos');
    if (partidosSnap.exists()) {
      partidosSnap.forEach(partidoSnap => {
        const estadisticasJugadoresSnap = partidoSnap.child('estadisticasJugadores');
        if (estadisticasJugadoresSnap.exists()) {
          estadisticasJugadoresSnap.forEach(jugadorSnap => {
            const jugadorId = jugadorSnap.key;
            const stats = jugadorSnap.val();
            if (!mediasPorJugador[jugadorId]) {
              mediasPorJugador[jugadorId] = {
                puntos: 0,
                asistencias: 0,
                rebotes: 0,
                robos: 0,
                tapones: 0,
                faltas: 0,
                partidosJugados: 0
              };
            }
            mediasPorJugador[jugadorId].puntos += stats.puntos || 0;
            mediasPorJugador[jugadorId].asistencias += stats.asistencias || 0;
            mediasPorJugador[jugadorId].rebotes += stats.rebotes || 0;
            mediasPorJugador[jugadorId].robos += stats.robos || 0;
            mediasPorJugador[jugadorId].tapones += stats.tapones || 0;
            mediasPorJugador[jugadorId].faltas += stats.faltas || 0;
            mediasPorJugador[jugadorId].partidosJugados++;
          });
        }
      });
    }
  });

  // Calcular medias dividiendo por partidos jugados
  for (const jugadorId in mediasPorJugador) {
    const acc = mediasPorJugador[jugadorId];
    if (acc.partidosJugados === 0) {
      mediasPorJugador[jugadorId] = null; // o un objeto vacío si prefieres
      continue;
    }
    mediasPorJugador[jugadorId] = {
      puntos: acc.puntos / acc.partidosJugados,
      asistencias: acc.asistencias / acc.partidosJugados,
      rebotes: acc.rebotes / acc.partidosJugados,
      robos: acc.robos / acc.partidosJugados,
      tapones: acc.tapones / acc.partidosJugados,
      faltas: acc.faltas / acc.partidosJugados,
      partidosJugados: acc.partidosJugados,
      valoracionFantasy: calcularPuntosFantasy({
        puntos: acc.puntos / acc.partidosJugados,
        asistencias: acc.asistencias / acc.partidosJugados,
        rebotes: acc.rebotes / acc.partidosJugados,
        robos: acc.robos / acc.partidosJugados,
        tapones: acc.tapones / acc.partidosJugados,
        faltas: acc.faltas / acc.partidosJugados,
      })
    };
  }

  return mediasPorJugador;
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
const confirmDeleteModal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'));
const nombreJugadorConfirm = document.getElementById('nombreJugadorConfirm');
const btnConfirmDelete = document.getElementById('btnConfirmDelete');

let jugadorAEliminar = null;

function confirmarBorradoJugador(key, nombre) {
  jugadorAEliminar = key;
  nombreJugadorConfirm.textContent = nombre;
  confirmDeleteModal.show();
}

btnConfirmDelete.addEventListener('click', () => {
  if (!jugadorAEliminar) return;
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/plantilla/${jugadorAEliminar}`).remove()
    .then(() => {
      jugadorAEliminar = null;
      confirmDeleteModal.hide();
    })
    .catch(error => {
      alert('Error al borrar jugador: ' + error.message);
    });
});
