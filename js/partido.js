firebase.initializeApp(window.firebaseConfig);

let currentUser = null,
  currentTeamId = null,
  currentCompeticionId = null,
  currentPartidoId = null;

const db = firebase.database();
const auth = firebase.auth();

let plantillaJugadores = [];
let convocados = new Set();
let jugadoresEnPista = new Set();

let estadisticasJugadores = {};
let marcadorRival = 0;
let faltasRival = 0;
let faltasEquipo = 0;

let duracionParte = 10 * 60; // por defecto 10 minutos
let totalPartes = 4; // por defecto 4 cuartos
let parteActual = 1;
let segundosRestantes = duracionParte;
let intervalo = null;
let contadorActivo = false;
let partidoIniciado = false;
let partidoTerminado = false;
let estadoPartido = "no empezado"; // "no empezado", "en curso", "finalizado"

// Dom elements
const selectConfiguracion = document.getElementById('selectConfiguracion');
const selectCuarto = document.getElementById('selectCuarto');
const btnEmpezar = document.getElementById('btnEmpezar');
const btnStartPause = document.getElementById('btnStartPause');
const btnTerminarCuarto = document.getElementById('btnTerminarCuarto');
const btnTerminar = document.getElementById('btnTerminar');

function inicializarTemporizador() {
  actualizarDisplay();
  btnStartPause.disabled = true;
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
  cargarConvocados();

  cargarPlantilla();
  cargarJugadoresEnPista();
  cargarEstadisticas();
  cargarMarcadorRival();
  cargarFaltasRival();
  cargarFaltasEquipo();
  cargarEstadoPartido();
  cargarNombreEquipo();
  prepararBotonesRival();
  prepararFormularioConvocar();
  prepararFormularioPista();

  inicializarTemporizador();

  // Eventos temporizador
  botonesTemporizador();

  selectConfiguracion.addEventListener('change', (e) => configurarPartido(e.target.value));
  selectCuarto.addEventListener('change', (e) => cambiarCuarto(e.target.value));

  configurarPartido(selectConfiguracion.value);
});
function cargarNombreEquipo() {
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/nombre`)
    .once('value')
    .then(snap => {
      if (snap.exists()) {
        const nombre = snap.val();
        document.getElementById('nombreEquipoMarcador').textContent = nombre;
      }
    })
    .catch(err => console.error('Error cargando nombre de equipo:', err));
}

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

function cargarEstadoPartido() {
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/partidos/${currentPartidoId}/estado`).once('value').then(snap => {
    if (snap.exists()) estadoPartido = snap.val();
    else estadoPartido = 'no empezado';
    ajustarBotonesSegunEstado();
  });
}

function ajustarBotonesSegunEstado() {

  if (estadoPartido === 'no empezado') {
    btnEmpezar.disabled = false;
    btnStartPause.disabled = true;
    btnTerminarCuarto.disabled = true;
    btnTerminar.disabled = true;
    partidoIniciado = false;
    partidoTerminado = false;
  } else if (estadoPartido === 'en curso') {
    btnEmpezar.disabled = true;
    btnStartPause.disabled = false;
    btnTerminarCuarto.disabled = false;
    btnTerminar.disabled = false;
    partidoIniciado = true;
    partidoTerminado = false;
  } else if (estadoPartido === 'finalizado') {
    btnEmpezar.disabled = false;
    btnStartPause.disabled = true;
    btnTerminarCuarto.disabled = true;
    btnTerminar.disabled = true;
    partidoIniciado = false;
    partidoTerminado = true;
  }
}

function guardarEstadoPartido(estado) {
  estadoPartido = estado;
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/partidos/${currentPartidoId}/estado`)
    .set(estado).then(()=>{
      sincronizarPartidoGlobal(currentUser.uid,currentTeamId,currentCompeticionId,currentPartidoId);
    })
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

// Carga jugadores, convocados, estadisticas y render
function cargarPlantilla() {
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/plantilla`)
    .once('value')
    .then(snapshot => {
      plantillaJugadores = [];
      snapshot.forEach(child => {
        // Obtiene el ID y datos de cada jugador
        const jugador = { id: child.key, ...child.val() };
        plantillaJugadores.push(jugador);
      });
      // Llama a la función para mostrar la plantilla en la UI (por ejemplo, en el modal de convocados)
      renderListaJugadoresPlantilla();
    })
    .catch(error => {
      console.error('Error al cargar la plantilla:', error);
      alert('No se pudo cargar la plantilla de jugadores');
    });
}

function cargarConvocados() {
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/partidos/${currentPartidoId}/convocados`)
    .once('value')
    .then(snap => {
      convocados = new Set();
      if (snap.exists()) Object.keys(snap.val()).forEach(id => convocados.add(id));
      renderListaJugadoresConvocados();
      renderListaJugadoresConvocadosModal();
    });
}

function cargarJugadoresEnPista() {
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/partidos/${currentPartidoId}/jugadoresEnPista`)
    .once('value')
    .then(snap => {
      jugadoresEnPista = new Set();
      if (snap.exists()) Object.keys(snap.val()).forEach(id => jugadoresEnPista.add(id));
      renderListaJugadoresPista();
      renderListaJugadoresConvocadosModal();
    });
}
function renderListaJugadoresConvocados() {
  const contenedor = document.getElementById('tablaEstadisticasContainer');
  if (!contenedor) return;
  
  // Limpiamos el contenido previo
  contenedor.innerHTML = '';

  // Crear tabla
  const table = document.createElement('table');
  table.className = 'table table-striped table-bordered table-sm';

  // Cabecera
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['Nombre',  'Puntos', 'Asist.', 'Rebotes', 'Robos', 'Tapones', 'Faltas'].forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Cuerpo
  const tbody = document.createElement('tbody');

  plantillaJugadores.filter(j => convocados.has(j.id)).forEach(j => {
    const row = document.createElement('tr');

    const stats = estadisticasJugadores[j.id] || {};

    // Nombre columna
    const tdNombre = document.createElement('td');
    tdNombre.textContent = j.nombre + " (#" +j.dorsal+ ")";
    row.appendChild(tdNombre);

    // // Dorsal
    // const tdDorsal = document.createElement('td');
    // tdDorsal.textContent = j.dorsal || '';
    // row.appendChild(tdDorsal);

    // Estadísticas
    const columnasStats = ['puntos', 'asistencias', 'rebotes', 'robos', 'tapones', 'faltas'];
    columnasStats.forEach(key => {
      const td = document.createElement('td');
      td.textContent = stats[key] || 0;
      row.appendChild(td);
    });

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  contenedor.appendChild(table);
}

function cargarEstadisticas() {
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/partidos/${currentPartidoId}/estadisticasJugadores`)
    .on('value', snap => {
      estadisticasJugadores = snap.exists() ? snap.val() : {};
      renderListaJugadoresConvocados();
      renderListaJugadoresPista();
      actualizarMarcadorEquipo();
      actualizarFaltasEquipo();
    });
}

function cargarMarcadorRival() {
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/partidos/${currentPartidoId}/puntosRival`)
    .on('value', snap => {
      marcadorRival = snap.exists() ? snap.val() : 0;
      document.getElementById('marcadorRival').textContent = marcadorRival;
    });
}

function cargarFaltasRival() {
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/partidos/${currentPartidoId}/faltasRival`)
    .on('value', snap => {
      faltasRival = snap.exists() ? snap.val() : 0;
      document.getElementById('faltasRival').textContent =  `F: ${faltasRival}`;
    });
}

function cargarFaltasEquipo() {
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/partidos/${currentPartidoId}/faltasEquipo`)
    .on('value', snap => {
      faltasEquipo = snap.exists() ? snap.val() : 0;
      document.getElementById('faltasEquipo').textContent = `F: ${faltasEquipo}`;
    });
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
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/partidos/${currentPartidoId}/puntosRival`)
    .set(marcadorRival).then(()=>{
      sincronizarPartidoGlobal(currentUser.uid,currentTeamId,currentCompeticionId,currentPartidoId);
    });
  document.getElementById('marcadorRival').textContent = marcadorRival;
}

function modificarFaltasRival(cant) {
  faltasRival += cant;
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/partidos/${currentPartidoId}/faltasRival`)
    .set(faltasRival).then(()=>{
      sincronizarPartidoGlobal(currentUser.uid,currentTeamId,currentCompeticionId,currentPartidoId);
    });
  document.getElementById('faltasRival').textContent = `F: ${faltasRival}`;
}

function modificarFaltasEquipo(cant) {
  faltasEquipo += cant;
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/partidos/${currentPartidoId}/faltasEquipo`)
    .set(faltasEquipo).then(()=>{
      sincronizarPartidoGlobal(currentUser.uid,currentTeamId,currentCompeticionId,currentPartidoId);
    });
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
    checkbox.checked = convocados.has(j.id);
    checkbox.onchange = () => {
      if (checkbox.checked) convocados.add(j.id);
      else convocados.delete(j.id);
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
  convocados.forEach(id => (data[id] = true));
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/partidos/${currentPartidoId}/convocados`)
    .set(data)
    .then(() => {
      bootstrap.Modal.getOrCreateInstance(document.getElementById('modalConvocarJugadores')).hide();
      sincronizarPartidoGlobal(currentUser.uid,currentTeamId,currentCompeticionId,currentPartidoId);
      
      renderListaJugadoresConvocados();
      renderListaJugadoresConvocadosModal();
    });
}

// **** Modal elegir jugadores en pista (de convocados) ****
function renderListaJugadoresConvocadosModal() {
  const ul = document.getElementById('listaJugadoresConvocadosModal');
  if (!ul) return;
  ul.innerHTML = '';

  plantillaJugadores.filter(j => convocados.has(j.id)).forEach(j => {
    
    const li = document.createElement('li');
    li.className = 'list-group-item';
    const label = document.createElement('label');
    label.className = 'form-check-label d-flex align-items-center gap-2';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'form-check-input';
    checkbox.checked = jugadoresEnPista.has(j.id);
    checkbox.onchange = () => {
      if (checkbox.checked) {
        if (jugadoresEnPista.size >= 5) {
          checkbox.checked = false;
          alert('Solo 5 jugadores pueden estar en pista');
          return;
        }
        jugadoresEnPista.add(j.id);
      } else {
        jugadoresEnPista.delete(j.id);
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
  jugadoresEnPista.forEach(id => (data[id] = true));
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/partidos/${currentPartidoId}/jugadoresEnPista`)
    .set(data)
    .then(() => {
      bootstrap.Modal.getOrCreateInstance(document.getElementById('modalElegirPista')).hide();
      sincronizarPartidoGlobal(currentUser.uid,currentTeamId,currentCompeticionId,currentPartidoId);
    
      renderListaJugadoresPista();
      renderListaJugadoresConvocadosModal();
    });
}

// **** Render jugadores en pista y añadir estadísticas ****

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

    [
      ['A', 'asistencias'],
      ['R', 'rebotes'],
      ['S', 'robos'],
      ['T', 'tapones'],
      ['F', 'faltas'],
    ].forEach(([label, key]) => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-sm btn-outline-secondary stat-btn';
      btn.textContent = label;
      btn.title = `Añadir ${label}`;
      btn.type = 'button';
      btn.onclick = () => agregarEstadistica(j.id, key, 1);
      contStats.appendChild(btn);
    });

    li.appendChild(contStats);

    const stats = estadisticasJugadores[j.id] || {};
    const textoStats = document.createElement('small');
    textoStats.className = 'ms-3 text-muted';
    textoStats.textContent = `Pts:${stats.puntos || 0} Asis:${stats.asistencias || 0} Reb:${stats.rebotes || 0} Rob:${stats.robos || 0} Tap:${stats.tapones || 0} Falt:${stats.faltas || 0}`;

    li.appendChild(textoStats);

    ul.appendChild(li);
  });
}

function agregarEstadistica(jugadorId, tipo, cantidad) {
  if (!estadisticasJugadores[jugadorId])
    estadisticasJugadores[jugadorId] = {
      puntos: 0,
      asistencias: 0,
      rebotes: 0,
      robos: 0,
      tapones: 0,
      faltas: 0,
    };
  estadisticasJugadores[jugadorId][tipo] += cantidad;

  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/partidos/${currentPartidoId}/estadisticasJugadores`)
    .set(estadisticasJugadores)
    .then(() => {
      
      sincronizarPartidoGlobal(currentUser.uid,currentTeamId,currentCompeticionId,currentPartidoId);
  
      actualizarFaltasEquipo();
      actualizarMarcadorEquipo();
      renderListaJugadoresPista();
      renderListaJugadoresConvocados();
    })
    .catch((err) => alert('Error guardando estadísticas: ' + err.message));
}

function actualizarMarcadorEquipo() {
  let total = 0;
  Object.values(estadisticasJugadores).forEach((stats) => {
    total += stats.puntos || 0;
  });
  // Guardar y mostrar marcador equipo
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/partidos/${currentPartidoId}/puntosEquipo`)
    .set(total);
  document.getElementById('marcadorEquipo').textContent = total;
}

function actualizarFaltasEquipo() {
  let totalFaltas = 0;
  plantillaJugadores
    .filter((j) => convocados.has(j.id))
    .forEach((j) => {
      const stats = estadisticasJugadores[j.id] || {};
      totalFaltas += stats.faltas || 0;
    });
  document.getElementById('faltasEquipo').textContent = `Faltas: ${totalFaltas}`;
  // Guardar faltas equipo
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/partidos/${currentPartidoId}/faltasEquipo`)
    .set(totalFaltas);
}
function botonesTemporizador() {

  // Botón empezar ya tiene event listener en el código general, pero aquí te pongo ejemplo
  btnEmpezar.addEventListener('click', () => {
   
    
      guardarEstadoPartido('en curso');
      partidoIniciado = true;
      partidoTerminado = false;
      parteActual = 1;
      segundosRestantes = duracionParte;
      actualizarDisplay();
  
      btnEmpezar.disabled = true;
      btnStartPause.disabled = false;
      btnTerminarCuarto.disabled = false;
      btnTerminar.disabled = false;
  
      iniciarContador();
  
  });

  btnStartPause.addEventListener('click', () => {
    if (estadoPartido !== 'en curso') return;
    if (contadorActivo) {
      pausarContador();
    } else {
      iniciarContador();
    }
  });

  btnTerminarCuarto.addEventListener('click', () => {
    if (estadoPartido !== 'en curso') return;
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
    if (estadoPartido !== 'en curso') return;
    pausarContador();
    guardarEstadoPartido('finalizado');
    partidoIniciado = false;
    partidoTerminado = true;

    btnEmpezar.disabled = false;
    btnStartPause.disabled = true;
    btnTerminarCuarto.disabled = true;
    btnTerminar.disabled = true;

    alert('El partido ha finalizado.');
  });
}


function sincronizarPartidoGlobal(userId, equipoId, competicionId, partidoId) {
  console.log("sincronizar:", userId, equipoId, competicionId, partidoId);
  const refPartido = db.ref(`usuarios/${userId}/equipos/${equipoId}/competiciones/${competicionId}/partidos/${partidoId}`);
  const refGlobal = db.ref(`partidosGlobales/${partidoId}`);
  return db.ref(`usuarios/${userId}/equipos/${equipoId}/nombre`).once('value').then(nombreSnap => {
    return refPartido.once('value').then(snapshot => {
      if (!snapshot.exists()) {
        console.log("El partido fue eliminado, borrando de global");
        return refGlobal.remove();
      }
      const p = snapshot.val();
      return refGlobal.set(p);
    });
  }).catch(error => {
    console.error('Error al sincronizar partido global:', error);
  });
}
