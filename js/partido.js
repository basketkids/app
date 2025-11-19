let currentUser = null;
let currentTeamId = null;
let currentCompeticionId = null;
let currentPartidoId = null;
firebase.initializeApp(window.firebaseConfig);

const db = firebase.database();
const auth = firebase.auth();

let plantillaJugadores = [];
let convocados = new Set();
let jugadoresEnPista = new Set();

let estadisticasJugadores = {};
let marcadorRival = 0;
let faltasRival = 0;

auth.onAuthStateChanged(user => {
  if (!user) {
    alert('Por favor inicia sesión');
    window.location.href = 'index.html';
    return;
  }
  currentUser = user;
  const params = new URLSearchParams(window.location.search);
  currentTeamId = params.get('idEquipo');
  currentCompeticionId = params.get('idCompeticion');
  currentPartidoId = params.get('idPartido');

  if (!currentTeamId || !currentCompeticionId || !currentPartidoId) {
    alert('Faltan parámetros para cargar partido');
    window.location.href = 'index.html';
    return;
  }

  cargarPlantilla();
  cargarConvocados();
  cargarEstadisticas();
  cargarJugadoresEnPista();
  cargarMarcadorRival();
  cargarFaltasRival();

  prepararBotonesRival();
  prepararFormularioConvocar();
});

function cargarPlantilla() {
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/plantilla`)
    .once('value')
    .then(snapshot => {
      plantillaJugadores = [];
      snapshot.forEach(child => {
        plantillaJugadores.push({ id: child.key, ...child.val() });
      });
      renderListaJugadoresEquipo(); // Para mostrar la lista en el modal y en la UI
    });
}

function cargarConvocados() {
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/partidos/${currentPartidoId}/convocados`).once('value').then(snap => {
    convocados = new Set();
    if (snap.exists()) Object.keys(snap.val()).forEach(id => convocados.add(id));
    renderListaJugadoresConvocados();
  });
}

function cargarJugadoresEnPista() {
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/partidos/${currentPartidoId}/jugadoresEnPista`).once('value').then(snap => {
    jugadoresEnPista = new Set();
    if (snap.exists()) Object.keys(snap.val()).forEach(id => jugadoresEnPista.add(id));
    renderListaJugadoresPista();
  });
}

function cargarEstadisticas() {
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/partidos/${currentPartidoId}/estadisticasJugadores`).on('value', snap => {
    estadisticasJugadores = snap.exists() ? snap.val() : {};
    renderListaJugadoresConvocados();
    renderListaJugadoresPista();
    actualizarMarcadorEquipo();
  });
}

function cargarMarcadorRival() {
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/partidos/${currentPartidoId}/puntosRival`).on('value', snap => {
    marcadorRival = snap.exists() ? snap.val() : 0;
    document.getElementById('marcadorRival').textContent = marcadorRival;
  });
}

function cargarFaltasRival() {
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/partidos/${currentPartidoId}/faltasRival`).on('value', snap => {
    faltasRival = snap.exists() ? snap.val() : 0;
    document.getElementById('faltasRival').textContent = faltasRival;
  });
}

function prepararBotonesRival() {
  document.getElementById('btnPuntoRival1').onclick = () => modificarMarcadorRival(1);
  document.getElementById('btnPuntoRival2').onclick = () => modificarMarcadorRival(2);
  document.getElementById('btnPuntoRival3').onclick = () => modificarMarcadorRival(3);
  document.getElementById('btnFaltasRival').onclick = () => modificarFaltasRival(1);
}

function modificarMarcadorRival(cant) {
  marcadorRival += cant;
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/partidos/${currentPartidoId}/puntosRival`)
    .set(marcadorRival);
  document.getElementById('marcadorRival').textContent = marcadorRival;
}

function modificarFaltasRival(cant) {
  faltasRival += cant;
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/partidos/${currentPartidoId}/faltasRival`)
    .set(faltasRival);
  document.getElementById('faltasRival').textContent = faltasRival;
}

function prepararFormularioConvocar() {
  document.getElementById('formConvocarJugadores').addEventListener('submit', e => {
    e.preventDefault();
    guardarConvocadosModal();
  });
}

function renderListaJugadoresEquipo() {
  const ul = document.getElementById('listaJugadoresEquipo');
  ul.innerHTML = '';

  plantillaJugadores.forEach(j => {
    const li = document.createElement('li');
    li.className = 'list-group-item';

    const label = document.createElement('label');
    label.className = 'form-check-label d-flex align-items-center gap-2';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'form-check-input';
    checkbox.checked = convocados.has(j.id);

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) convocados.add(j.id);
      else convocados.delete(j.id);
    });

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(` ${j.nombre} (#${j.dorsal})`));
    li.appendChild(label);
    ul.appendChild(li);
  });
}

function guardarConvocadosModal() {
  const data = {};
  convocados.forEach(id => data[id] = true);
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/partidos/${currentPartidoId}/convocados`)
    .set(data)
    .then(() => {
      const modalEl = document.getElementById('modalConvocarJugadores');
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
      renderListaJugadoresConvocados();
    });
}

function renderListaJugadoresConvocados() {
  const ul = document.getElementById('listaJugadoresConvocados');
  ul.innerHTML = '';

  plantillaJugadores.filter(j => convocados.has(j.id)).forEach(j => {
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between align-items-center flex-wrap';

    const nombreSpan = document.createElement('span');
    nombreSpan.textContent = `${j.nombre} (#${j.dorsal})`;
    li.appendChild(nombreSpan);

    const stats = estadisticasJugadores[j.id] || {};
    const statsSpan = document.createElement('span');
    statsSpan.style.fontSize = '0.85em';
    statsSpan.style.color = '#555';
    statsSpan.textContent = `Pts:${stats.puntos || 0}, Asis:${stats.asistencias || 0}, Reb:${stats.rebotes || 0}, Rob:${stats.robos || 0}, Tap:${stats.tapones || 0}, Falt:${stats.faltas || 0}`;
    li.appendChild(statsSpan);

    ul.appendChild(li);
  });

  actualizarMarcadorEquipo();
}

function renderListaJugadoresPista() {
  const ul = document.getElementById('listaJugadoresPista');
  ul.innerHTML = '';

  plantillaJugadores.filter(j => jugadoresEnPista.has(j.id)).forEach(j => {
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex flex-column';

    const nombre = document.createElement('div');
    nombre.textContent = `${j.nombre} (#${j.dorsal})`;
    nombre.style.fontWeight = '600';
    li.appendChild(nombre);

    const contStats = document.createElement('div');
    contStats.className = 'd-flex flex-wrap gap-1 mt-2';

    [1, 2, 3].forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-sm btn-outline-primary stat-btn';
      btn.textContent = `+${p}`;
      btn.title = `Añadir ${p} punto${p > 1 ? 's' : ''}`;
      btn.type = 'button';
      btn.onclick = () => agregarEstadistica(j.id, 'puntos', p);
      contStats.appendChild(btn);
    });

    [['A', 'asistencias'], ['R', 'rebotes'], ['S', 'robos'], ['T', 'tapones'], ['F', 'faltas']].forEach(([label, key]) => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-sm btn-outline-secondary stat-btn';
      btn.textContent = label;
      btn.title = `Añadir ${label}`;
      btn.type = 'button';
      btn.onclick = () => agregarEstadistica(j.id, key, 1);
      contStats.appendChild(btn);
    });

    const stats = estadisticasJugadores[j.id] || {};
    const textoStats = document.createElement('small');
    textoStats.className = 'ms-3 text-muted';
    textoStats.textContent = `Pts:${stats.puntos || 0} Asis:${stats.asistencias || 0} Reb:${stats.rebotes || 0} Rob:${stats.robos || 0} Tap:${stats.tapones || 0} Falt:${stats.faltas || 0}`;

    li.appendChild(contStats);
    li.appendChild(textoStats);

    ul.appendChild(li);
  });
}

function agregarEstadistica(jugadorId, tipo, cantidad) {
  if (!estadisticasJugadores[jugadorId]) {
    estadisticasJugadores[jugadorId] = { puntos: 0, asistencias: 0, rebotes: 0, robos: 0, tapones: 0, faltas: 0 };
  }
  estadisticasJugadores[jugadorId][tipo] += cantidad;

  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/partidos/${currentPartidoId}/estadisticasJugadores`)
    .set(estadisticasJugadores)
    .catch(err => alert('Error guardando estadísticas: ' + err.message));

  renderListaJugadoresPista();
  renderListaJugadoresConvocados();
}

function actualizarMarcadorEquipo() {
  let total = 0;
  Object.values(estadisticasJugadores).forEach(stats => {
    total += stats.puntos || 0;
  });
  document.getElementById('marcadorEquipo').textContent = total;
}
