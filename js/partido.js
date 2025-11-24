firebase.initializeApp(window.firebaseConfig);

let currentUser = null,
  currentTeamId = null,
  currentCompeticionId = null,
  currentPartidoId = null;

const db = firebase.database();
const auth = firebase.auth();

const matchService = new MatchService(db);
const playerService = new PlayerService(db);

let partido = null;


let duracionParte = 10 * 60; // por defecto 10 minutos
let totalPartes = 4; // por defecto 4 cuartos
let parteActual = 1;
let segundosRestantes = duracionParte;
let intervalo = null;
let contadorActivo = false;
let partidoIniciado = false;
let partidoTerminado = false;

// Dom elements
const selectConfiguracion = document.getElementById('selectConfiguracion');
const selectCuarto = document.getElementById('selectCuarto');
const btnEmpezar = document.getElementById('btnEmpezar');
const btnStartPause = document.getElementById('btnStartPause');
const btnTerminarCuarto = document.getElementById('btnTerminarCuarto');
const btnTerminar = document.getElementById('btnTerminar');

function inicializarTemporizador() {
  actualizarDisplay();
  btnStartPause.disabled = false;
  btnTerminarCuarto.disabled = true;
  btnTerminar.disabled = true;
}


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

  // Recuperar TODO el objeto partido
  matchService.get(currentUser.uid, currentTeamId, currentCompeticionId, currentPartidoId)
    .then(snap => {
      if (!snap.exists()) {
        alert('No se encontró el partido');
        window.location.href = 'index.html';
        return;
      }

      partido = snap.val();

      // Inicializar variables globales:
      // Convocados como Set (claves del objeto convocados)
      partido.convocados = partido.convocados ? new Set(Object.keys(partido.convocados)) : new Set();

      // Jugadores en pista como Set
      partido.jugadoresEnPista = partido.jugadoresEnPista ? new Set(Object.keys(partido.jugadoresEnPista)) : new Set();

      // Estadísticas jugadores
      partido.estadisticasJugadores = partido.estadisticasJugadores || {};

      // Cargar plantilla jugadores (única consulta aparte)
      return playerService.getSquad(currentUser.uid, currentTeamId)
        .then(snapshot => {
          plantillaJugadores = [];
          snapshot.forEach(child => {
            plantillaJugadores.push({ id: child.key, ...child.val() });
          });

          // Renderizar todo en la UI
          renderListaJugadoresPlantilla();
          renderListaJugadoresConvocados();
          renderListaJugadoresConvocadosModal();
          renderListaJugadoresPista();

          ajustarBotonesSegunEstado();

          document.getElementById('nombreEquipoMarcador').textContent = partido.nombreEquipo;
          document.getElementById('nombreRivalMarcador').textContent = partido.nombreRival;
          document.getElementById('faltasEquipo').textContent = partido.faltasEquipo;
          document.getElementById('faltasRival').textContent = partido.faltasRival;
          document.getElementById('marcadorEquipo').textContent = partido.puntosEquipo;
          document.getElementById('marcadorRival').textContent = partido.puntosRival;
          actualizarFaltasEquipo();

          prepararBotonesRival();
          prepararFormularioConvocar();
          prepararFormularioPista();
          inicializarTemporizador();

          // Configurar temporizador y eventos
          botonesTemporizador();
          configurarPartido(selectConfiguracion.value);
        });
    })
    .catch(error => {
      console.error('Error cargando partido:', error);
      alert('No se pudo cargar los datos del partido');
      window.location.href = 'index.html';
    });

  selectConfiguracion.addEventListener('change', (e) => configurarPartido(e.target.value));
  selectCuarto.addEventListener('change', (e) => cambiarCuarto(e.target.value));
});








function configurarPartido(opcion) {
  if (opcion === '6x8') {
    duracionParte = 8 * 60;
    totalPartes = 6;
  } else if (opcion === '4x10') {
    duracionParte = 10 * 60;
    totalPartes = 4;
  }
  parteActual = 1;
  segundosRestantes = duracionParte;
  pausarContador();
  actualizarDisplay();

  // Actualiza selector de cuartos
  selectCuarto.innerHTML = '';
  for (let i = 1; i <= totalPartes; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = i;
    selectCuarto.appendChild(option);
  }
  selectCuarto.value = parteActual;
}



function ajustarBotonesSegunEstado() {

  if (partido.estado == null) {
    partido.estado = 'pendiente';
  }

  if (partido.estado === 'pendiente') {
    btnStartPause.disabled = false;
    btnTerminarCuarto.disabled = true;
    btnTerminar.disabled = true;
    partidoIniciado = false;
    partidoTerminado = false;
  } else if (partido.estado === 'en curso') {
    btnStartPause.disabled = false;
    btnTerminarCuarto.disabled = false;
    btnTerminar.disabled = false;
    partidoIniciado = true;
    partidoTerminado = false;
  } else if (partido.estado === 'finalizado') {
    btnStartPause.disabled = true;
    btnTerminarCuarto.disabled = true;
    btnTerminar.disabled = true;
    partidoIniciado = false;
    partidoTerminado = true;
  }
}

function guardarEstadoPartido(estado) {
  partido.estado = estado;
  matchService.updateStatus(currentUser.uid, currentTeamId, currentCompeticionId, currentPartidoId, estado)
    .catch(err => console.error('Error guardando estado partido:', err));
}


// Temporizador funciones
function actualizarDisplay() {
  selectCuarto.value = parteActual;
  const min = Math.floor(segundosRestantes / 60);
  const seg = segundosRestantes % 60;
  document.getElementById('contador').textContent = `${min.toString().padStart(2, '0')}:${seg.toString().padStart(2, '0')}`;
}

function cambiarCuarto(nuevoCuarto) {
  parteActual = parseInt(nuevoCuarto);
  segundosRestantes = duracionParte;
  pausarContador();
  actualizarDisplay();
}

function tick() {
  if (segundosRestantes > 0) {
    segundosRestantes--;
    actualizarDisplay();
  } else {
    pausarContador();
    alert('Fin del cuarto');
  }
}

function iniciarContador() {
  if (partidoTerminado) return;
  if (!contadorActivo) {
    intervalo = setInterval(tick, 1000);
    contadorActivo = true;
    btnStartPause.innerHTML = '<i class="bi bi-pause-fill"></i>';
  }
}

function pausarContador() {
  if (contadorActivo) {
    clearInterval(intervalo);
    intervalo = null;
    contadorActivo = false;
    btnStartPause.innerHTML = '<i class="bi bi-play-fill"></i>';
  }
}


let ordenActual = { columna: null, ascendente: true };

function renderListaJugadoresConvocados() {
  const contenedor = document.getElementById('tablaEstadisticasContainer');
  if (!contenedor) return;

  contenedor.innerHTML = '';

  const table = document.createElement('table');
  table.className = 'table table-striped table-bordered table-sm';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  const columnas = [
    { nombre: 'Nombre', key: 'nombre' },
    { nombre: 'Puntos', key: 'puntos' },
    { nombre: 'Asist.', key: 'asistencias' },
    { nombre: 'Rebotes', key: 'rebotes' },
    { nombre: 'Robos', key: 'robos' },
    { nombre: 'Tapones', key: 'tapones' },
    { nombre: 'Faltas', key: 'faltas' }
  ];

  columnas.forEach(({ nombre, key }) => {
    const th = document.createElement('th');
    th.textContent = nombre;
    th.style.cursor = 'pointer';
    th.onclick = () => {
      ordenarTablaPorColumna(key);
      renderListaJugadoresConvocados();
    };
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  let jugadores = plantillaJugadores.filter(i => partido.convocados.has(i.id));

  if (ordenActual.columna) {
    jugadores.sort((a, b) => {
      const statsA = partido.estadisticasJugadores[a.id] || {};
      const statsB = partido.estadisticasJugadores[b.id] || {};

      let valA, valB;

      if (ordenActual.columna === 'nombre') {
        valA = a.nombre.toLowerCase();
        valB = b.nombre.toLowerCase();
      } else {
        valA = statsA[ordenActual.columna] || 0;
        valB = statsB[ordenActual.columna] || 0;
      }

      if (valA < valB) return ordenActual.ascendente ? -1 : 1;
      if (valA > valB) return ordenActual.ascendente ? 1 : -1;
      return 0;
    });
  }

  jugadores.forEach(j => {
    const row = document.createElement('tr');

    const tdNombre = document.createElement('td');
    tdNombre.textContent = `${j.nombre} (#${j.dorsal})`;
    tdNombre.style.fontWeight = '600';
    row.appendChild(tdNombre);

    const columnasStats = ['puntos', 'asistencias', 'rebotes', 'robos', 'tapones', 'faltas'];
    columnasStats.forEach(key => {
      const td = document.createElement('td');
      td.textContent = (partido.estadisticasJugadores[j.id] && partido.estadisticasJugadores[j.id][key]) || 0;
      row.appendChild(td);
    });

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  contenedor.appendChild(table);
}

function ordenarTablaPorColumna(columna) {
  if (ordenActual.columna === columna) {
    ordenActual.ascendente = !ordenActual.ascendente;
  } else {
    ordenActual.columna = columna;
    // Si es la columna 'nombre', orden ascendente inicialmente; para las demás, descendente
    ordenActual.ascendente = (columna === 'nombre');
  }
}



// Botones puntos y faltas rival y equipo
function prepararBotonesRival() {
  document.getElementById('btnPuntoRival1').onclick = () => modificarMarcadorRival(1);
  document.getElementById('btnPuntoRival2').onclick = () => modificarMarcadorRival(2);
  document.getElementById('btnPuntoRival3').onclick = () => modificarMarcadorRival(3);
  document.getElementById('btnFaltasRival').onclick = () => modificarFaltasRival(1);
}

function modificarMarcadorRival(cant) {
  marcadorRival += cant;
  matchService.updateField(currentUser.uid, currentTeamId, currentCompeticionId, currentPartidoId, 'puntosRival', marcadorRival);
  document.getElementById('marcadorRival').textContent = marcadorRival;
}

function modificarFaltasRival(cant) {
  faltasRival += cant;
  matchService.updateField(currentUser.uid, currentTeamId, currentCompeticionId, currentPartidoId, 'faltasRival', faltasRival);
  document.getElementById('faltasRival').textContent = `F: ${faltasRival}`;
}

function modificarFaltasEquipo(cant) {
  faltasEquipo += cant;
  matchService.updateField(currentUser.uid, currentTeamId, currentCompeticionId, currentPartidoId, 'faltasEquipo', faltasEquipo);
  document.getElementById('faltasEquipo').textContent = `F: ${faltasEquipo}`;
}



// **** Modal convocar jugadores (lista plantilla) ****
function renderListaJugadoresPlantilla() {
  const ul = document.getElementById('listaJugadoresPlantilla');
  ul.innerHTML = '';
  plantillaJugadores.forEach(j => {
    const li = document.createElement('li');
    li.className = 'list-group-item';
    const label = document.createElement('label');
    label.className = 'form-check-label d-flex align-items-center gap-2';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'form-check-input';
    checkbox.checked = partido.convocados.has(j.id);
    checkbox.onchange = () => {
      if (checkbox.checked) partido.convocados.add(j.id);
      else partido.convocados.delete(j.id);
    };
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(` ${j.nombre} (#${j.dorsal})`));
    li.appendChild(label);
    ul.appendChild(li);
  });
}

function prepararFormularioConvocar() {
  document.getElementById('formConvocarJugadores').addEventListener('submit', e => {
    e.preventDefault();
    guardarConvocadosModal();
  });
}
function guardarConvocadosModal() {
  const data = {};
  partido.convocados.forEach(id => {
    const jugador = plantillaJugadores.find(j => j.id === id); // Asumiendo que tienes un objeto jugadoresInfo con datos de los jugadores
    if (jugador) {
      data[id] = {
        dorsal: jugador.dorsal || null,
        nombre: jugador.nombre || ''
      };
    }
  });

  matchService.updateConvocados(currentUser.uid, currentTeamId, currentCompeticionId, currentPartidoId, data)
    .then(() => {
      bootstrap.Modal.getOrCreateInstance(document.getElementById('modalConvocarJugadores')).hide();

      renderListaJugadoresConvocados();
      renderListaJugadoresConvocadosModal();
    });
}



// **** Modal elegir jugadores en pista (de convocados) ****
function renderListaJugadoresConvocadosModal() {
  const ul = document.getElementById('listaJugadoresConvocadosModal');
  if (!ul) return;
  ul.innerHTML = '';

  plantillaJugadores.filter(j => partido.convocados.has(j.id)).forEach(j => {

    const li = document.createElement('li');
    li.className = 'list-group-item';
    const label = document.createElement('label');
    label.className = 'form-check-label d-flex align-items-center gap-2';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'form-check-input';
    checkbox.checked = partido.jugadoresEnPista.has(j.id);
    checkbox.onchange = () => {
      if (checkbox.checked) {
        if (partido.jugadoresEnPista.size >= 5) {
          checkbox.checked = false;
          alert('Solo 5 jugadores pueden estar en pista');
          return;
        }
        partido.jugadoresEnPista.add(j.id);
      } else {
        partido.jugadoresEnPista.delete(j.id);
      }
    };
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(` ${j.nombre} (##${j.dorsal})`));
    li.appendChild(label);
    ul.appendChild(li);
  });
}

function prepararFormularioPista() {
  document.getElementById('formElegirPista').addEventListener('submit', e => {
    e.preventDefault();
    guardarJugadoresEnPista();
  });
}

function guardarJugadoresEnPista() {
  const data = {};
  partido.jugadoresEnPista.forEach(id => (data[id] = true));
  matchService.updatePista(currentUser.uid, currentTeamId, currentCompeticionId, currentPartidoId, data)
    .then(() => {
      bootstrap.Modal.getOrCreateInstance(document.getElementById('modalElegirPista')).hide();

      renderListaJugadoresPista();
      renderListaJugadoresConvocadosModal();
    });
}

// **** Render jugadores en pista y añadir estadísticas ****

function renderListaJugadoresPista() {
  const ul = document.getElementById('listaJugadoresPista');
  ul.innerHTML = '';
  plantillaJugadores.filter(j => partido.jugadoresEnPista.has(j.id)).forEach(j => {
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex flex-column';
    const nombre = document.createElement('div');
    nombre.textContent = `${j.nombre} (#${j.dorsal})`;
    nombre.style.fontWeight = '600';
    const stats = partido.estadisticasJugadores[j.id] || {};
    const textoStats = document.createElement('small');
    textoStats.className = 'ms-3 text-muted';
    textoStats.textContent = `Pts:${stats.puntos || 0} A:${stats.asistencias || 0} R:${stats.rebotes || 0} S:${stats.robos || 0} T:${stats.tapones || 0} F:${stats.faltas || 0}`;

    nombre.appendChild(textoStats);
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

    [
      ['A', 'asistencias'],
      ['R', 'rebotes'],
      ['S', 'robos'],
      ['T', 'tapones'],
      ['F', 'faltas'],
    ].forEach(([label, key]) => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-sm btn-outline-success stat-btn';

      if (key == 'faltas') {
        btn.className = 'btn btn-sm btn-outline-danger stat-btn';

      }
      btn.textContent = label;
      btn.title = `Añadir ${label}`;
      btn.type = 'button';
      btn.onclick = () => agregarEstadistica(j.id, key, 1);
      contStats.appendChild(btn);
    });

    li.appendChild(contStats);



    ul.appendChild(li);
  });
}

function agregarEstadistica(jugadorId, tipo, cantidad) {
  if (!partido.estadisticasJugadores[jugadorId]) {
    partido.estadisticasJugadores[jugadorId] = {
      puntos: 0,
      asistencias: 0,
      rebotes: 0,
      robos: 0,
      tapones: 0,
      faltas: 0,
    }


  };
  partido.estadisticasJugadores[jugadorId][tipo] += cantidad;

  matchService.updateStats(currentUser.uid, currentTeamId, currentCompeticionId, currentPartidoId, partido.estadisticasJugadores)
    .then(() => {

      actualizarFaltasEquipo();
      actualizarMarcadorEquipo();
      renderListaJugadoresPista();
      renderListaJugadoresConvocados();
    })
    .catch((err) => alert('Error guardando estadísticas: ' + err.message));
}

function actualizarMarcadorEquipo() {
  let total = 0;
  Object.values(partido.estadisticasJugadores).forEach((stats) => {
    total += stats.puntos || 0;
  });
  // Guardar y mostrar marcador equipo
  matchService.updateField(currentUser.uid, currentTeamId, currentCompeticionId, currentPartidoId, 'puntosEquipo', total);
  document.getElementById('marcadorEquipo').textContent = total;
}

function actualizarFaltasEquipo() {
  let totalFaltas = 0;
  plantillaJugadores
    .filter((j) => partido.convocados.has(j.id))
    .forEach((j) => {
      const stats = partido.estadisticasJugadores[j.id] || {};
      totalFaltas += stats.faltas || 0;
    });
  document.getElementById('faltasEquipo').textContent = `F: ${totalFaltas}`;
  // Guardar faltas equipo
  matchService.updateField(currentUser.uid, currentTeamId, currentCompeticionId, currentPartidoId, 'faltasEquipo', totalFaltas);
}
function botonesTemporizador() {

  // Botón empezar ya tiene event listener en el código general, pero aquí te pongo ejemplo


  btnStartPause.addEventListener('click', () => {

    if (partido.estado !== 'en curso') {
      partido.estado = 'en curso';
      guardarEstadoPartido('en curso');
      partidoIniciado = true;
      partidoTerminado = false;
      parteActual = 1;
      segundosRestantes = duracionParte;
      actualizarDisplay();
      btnStartPause.disabled = false;
      btnTerminarCuarto.disabled = false;
      btnTerminar.disabled = false;

      iniciarContador();
      return;
    };

    if (contadorActivo) {
      pausarContador();
    } else {
      iniciarContador();
    }
  });


  btnTerminarCuarto.addEventListener('click', () => {
    if (partido.estado !== 'en curso') return;
    pausarContador();
    if (parteActual < totalPartes) {
      parteActual++;
      segundosRestantes = duracionParte;
      actualizarDisplay();
      iniciarContador();
    } else {
      alert('Este es el último cuarto, termina el partido con el botón Terminar Partido.');
    }
  });

  btnTerminar.addEventListener('click', () => {
    if (partido.estado !== 'en curso') return;
    pausarContador();
    guardarEstadoPartido('finalizado');
    partidoIniciado = false;
    partidoTerminado = true;

    btnStartPause.disabled = true;
    btnTerminarCuarto.disabled = true;
    btnTerminar.disabled = true;

    alert('El partido ha finalizado.');
  });
}



