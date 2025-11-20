firebase.initializeApp(window.firebaseConfig);

const auth = firebase.auth();
const db = firebase.database();

const competitionNameSpan = document.getElementById('competitionName');

const menuCompeticion = document.getElementById('menuCompeticion');
const seccionRivales = document.getElementById('seccion-rivales');
const seccionPartidos = document.getElementById('seccion-partidos');

const addRivalForm = document.getElementById('addRivalForm');
const inputNombreRival = document.getElementById('inputNombreRival');
const rivalesList = document.getElementById('rivalesList');

const addPartidoForm = document.getElementById('addPartidoForm');
const inputFechaHora = document.getElementById('inputFechaHora');
const inputRivalSelect = document.getElementById('inputRivalSelect');
const inputLocalVisitante = document.getElementById('inputLocalVisitante');
const inputPabellon = document.getElementById('inputPabellon');
const partidosList = document.getElementById('partidosList');

const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const confirmDeleteModal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'));

let currentUser = null;
let currentTeamId = null;
let currentCompeticionId = null;

let elementoABorrar = null; // { tipo: 'rival'|'partido', id: string }


auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "index.html";
  } else {
    currentUser = user;
    loadParamsUrl();
  }
});

menuCompeticion.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const seccion = e.target.getAttribute('data-seccion');
    menuCompeticion.querySelectorAll('a').forEach(a => a.classList.remove('active'));
    e.target.classList.add('active');
    seccionRivales.style.display = seccion === 'rivales' ? 'block' : 'none';
    seccionPartidos.style.display = seccion === 'partidos' ? 'block' : 'none';
  });
});

function loadParamsUrl() {
  const params = new URLSearchParams(window.location.search);
  const idEquipo = params.get('idEquipo');
  const idCompeticion = params.get('idCompeticion');
  if (!idEquipo || !idCompeticion) {
    alert('No se especificó equipo o competición');
    window.location.href = 'index.html';
    return;
  }
  currentTeamId = idEquipo;
  currentCompeticionId = idCompeticion;
  loadCompeticionData();
}

function loadCompeticionData() {
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}`)
    .once('value')
    .then(snap => {
      if (!snap.exists()) {
        alert('Competición no encontrada o sin permiso');
        window.location.href = `equipo.html?id=${currentTeamId}`;
        return;
      }
      const competicion = snap.val();
      competitionNameSpan.textContent = competicion.nombre || 'Competición';
      loadRivales();
      loadPartidos();
    });
}

// Añadir rival
addRivalForm.addEventListener('submit', e => {
  e.preventDefault();
  const nombre = inputNombreRival.value.trim();
  if (!nombre) return alert('Introduce nombre de rival');

  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/rivales`)
    .push({ nombre })
    .then(() => {
      inputNombreRival.value = '';
      const modal = bootstrap.Modal.getOrCreateInstance(addRivalForm.closest('.modal'));
      modal.hide();
    });
});

// Listar rivales
function loadRivales() {
  rivalesList.innerHTML = '';
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/rivales`)
    .on('value', snapshot => {
      rivalesList.innerHTML = '';
      if (!snapshot.exists()) {
        rivalesList.innerHTML = '<li class="list-group-item">No hay rivales añadidos</li>';
        inputRivalSelect.innerHTML = '<option value="">Selecciona rival</option>';
        return;
      }
      inputRivalSelect.innerHTML = '<option value="">Selecciona rival</option>';
      snapshot.forEach(rivalSnap => {
        const rival = rivalSnap.val();
        const id = rivalSnap.key;

        // Añadir opciones desplegable
        const option = document.createElement('option');
        option.value = id;
        option.textContent = rival.nombre;
        inputRivalSelect.appendChild(option);

        //Lista visual de rivales
        const li = document.createElement('li');
        li.classList.add('list-group-item', 'd-flex', 'justify-content-between', 'align-items-center');
        li.textContent = rival.nombre;

        const btnBorrar = document.createElement('button');
        btnBorrar.classList.add('btn', 'btn-sm', 'btn-danger');
        btnBorrar.title = 'Borrar rival';
        btnBorrar.innerHTML = '<i class="bi bi-trash-fill"></i>';
        btnBorrar.onclick = () => {
          elementoABorrar = { tipo: 'rival', id };
          confirmDeleteModal.show();
        };
        li.appendChild(btnBorrar);

        rivalesList.appendChild(li);
      });
    });
}



// Listar partidos
function loadPartidos() {
  partidosList.innerHTML = '';
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/partidos`)
    .on('value', snapshot => {
      partidosList.innerHTML = '';
      if (!snapshot.exists()) {
        partidosList.innerHTML = '<li class="list-group-item">No hay partidos añadidos</li>';
        return;
      }

      db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/nombre`).once('value').then(nombreSnap => {
        const nombreEquipo = nombreSnap.exists() ? nombreSnap.val() : 'Mi equipo';

        snapshot.forEach(partidoSnap => {
          const partido = partidoSnap.val();
          const id = partidoSnap.key;

          const li = document.createElement('li');
          li.classList.add('list-group-item', 'd-flex', 'justify-content-between', 'align-items-center', 'flex-column', 'text-start');

          // Fecha y hora en dos líneas con letra pequeña, alineado a la izquierda
          const fechaObj = new Date(partido.fechaHora);
          const fechaStr = fechaObj.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
          const horaStr = fechaObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

          const divFechaHora = document.createElement('div');
          divFechaHora.style.fontSize = '0.85em';
          divFechaHora.style.lineHeight = '1.1em';
          divFechaHora.style.marginBottom = '0.3rem';
          divFechaHora.textContent = `${fechaStr}\n${horaStr}`.replace('\n', '\n'); // For newline

          // Equipos local y visitante
          let local = partido.esLocal ? nombreEquipo : partido.nombreRival || 'Rival';
          let visitante = partido.esLocal ? (partido.nombreRival || 'Rival') : nombreEquipo;

          const divEquipos = document.createElement('div');
          divEquipos.style.fontWeight = '600';
          divEquipos.textContent = `${local} vs ${visitante}`;

          // Contenedor para marcador e icono estado
          const divMarcador = document.createElement('div');
          divMarcador.classList.add('d-flex', 'align-items-center', 'gap-2', 'mt-2');

          // Marcador
          const puntosEquipo = partido.puntosEquipo ?? 0;
          const puntosRival = partido.puntosRival ?? 0;
          const marcadorSpan = document.createElement('span');
          marcadorSpan.style.fontWeight = 'bold';
          marcadorSpan.textContent = `${puntosEquipo} - ${puntosRival}`;

          // Icono estado partido
          const iconEstado = document.createElement('i');
          iconEstado.style.fontSize = '1.2em';
          iconEstado.style.display = 'inline-block';

          switch (partido.estado) {
            case 'pendiente':
              iconEstado.classList.add('bi', 'bi-clock', 'text-secondary');
              iconEstado.title = 'Partido aún no ha empezado';
              break;
            case 'jugando':
              iconEstado.classList.add('bi', 'bi-record-circle-fill', 'text-danger', 'blink');
              iconEstado.title = 'Partido en curso';
              break;
            case 'finalizado':
              iconEstado.classList.add('bi', 'bi-check-circle-fill', 'text-success');
              iconEstado.title = 'Partido finalizado';
              break;
            default:
              iconEstado.classList.add('bi', 'bi-question-circle-fill', 'text-muted');
              iconEstado.title = 'Estado desconocido';
          }

          divMarcador.appendChild(iconEstado);
          divMarcador.appendChild(marcadorSpan);

          li.appendChild(divFechaHora);
          li.appendChild(divEquipos);
          li.appendChild(divMarcador);

          // Contenedor botones (gestionar, borrar) alineados a derecha (última fila)
          const botonesContainer = document.createElement('div');
          botonesContainer.classList.add('d-flex', 'gap-2', 'mt-2', 'justify-content-end', 'w-100');

          // Botón gestionar partido
          const btnGestionar = document.createElement('a');
          btnGestionar.href = `partido.html?idEquipo=${currentTeamId}&idCompeticion=${currentCompeticionId}&idPartido=${id}`;
          btnGestionar.classList.add('btn', 'btn-sm', 'btn-warning');
          btnGestionar.title = 'Gestionar partido';
          btnGestionar.innerHTML = '<i class="bi bi-pencil-fill"></i>';
          botonesContainer.appendChild(btnGestionar);

          // Botón borrar partido
          const btnBorrar = document.createElement('button');
          btnBorrar.classList.add('btn', 'btn-sm', 'btn-danger');
          btnBorrar.title = 'Borrar partido';
          btnBorrar.innerHTML = '<i class="bi bi-trash-fill"></i>';
          btnBorrar.onclick = () => {
            elementoABorrar = { tipo: 'partido', id };
            confirmDeleteModal.show();
          };
          botonesContainer.appendChild(btnBorrar);

          li.appendChild(botonesContainer);

          partidosList.appendChild(li);
        });
      });
    });
}

// Confirmar borrar rival o partido
confirmDeleteBtn.onclick = () => {
  if (!elementoABorrar) return;
  const path = `usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}`;
  if (elementoABorrar.tipo === 'rival') {
    db.ref(`${path}/rivales/${elementoABorrar.id}`).remove()
      .then(() => {
        elementoABorrar = null;
        confirmDeleteModal.hide();
      }).catch(err => alert('Error al borrar rival: ' + err.message));
  } else if (elementoABorrar.tipo === 'partido') {
    db.ref(`${path}/partidos/${elementoABorrar.id}`).remove()
      .then(() => {
        db.ref(`partidosGlobales/${elementoABorrar.id}`).remove().then(()=>{
          elementoABorrar = null;
          confirmDeleteModal.hide();
        }).catch(err => alert('Error al borrar partido: ' + err.message));
      
      }).catch(err => alert('Error al borrar partido: ' + err.message));
  }
};
addPartidoForm.addEventListener('submit', e => {
  e.preventDefault();

  const fechaHoraStr = inputFechaHora.value;
  const rivalId = inputRivalSelect.value;
  const esLocal = inputLocalVisitante.value === 'local';
  const pabellon = inputPabellon.value.trim();

  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/nombre`).once('value').then(equipoSnap => {
    const nombreEquipo = equipoSnap.exists() ? equipoSnap.val() : 'Equipo desconocido';
    if (!fechaHoraStr || !rivalId || !pabellon) {
      alert('Rellena todos los campos para crear el partido');
      return;
    }

    db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/rivales/${rivalId}`)
      .once('value')
      .then(rivalSnap => {
        if (!rivalSnap.exists()) {
          alert('Rival no válido');
          return;
        }
        const nombreRival = rivalSnap.val().nombre;

        // Primero creamos la referencia con .push()
        const partidosRef = db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/partidos`);
        const nuevoPartidoRef = partidosRef.push();

        // Ahora guardamos los datos con .set()
        nuevoPartidoRef.set({
          fechaHora: fechaHoraStr,
          rivalId,
          nombreRival,
          nombreEquipo,
          esLocal,
          pabellon,
          alineacion: {},
          estadisticas: {},
          puntosEquipo: 0,
          puntosRival: 0,
          faltasRival: 0,
          estado: 'pendiente'
        }).then(() => {
          const partidoId = nuevoPartidoRef.key;  // Aquí sí obtienes el ID generado
          sincronizarPartidoGlobal(currentUser.uid, currentTeamId, currentCompeticionId, partidoId);

          // Limpieza formulario y cierre modal
          inputFechaHora.value = '';
          inputRivalSelect.value = '';
          inputLocalVisitante.value = 'local';
          inputPabellon.value = '';
          const modal = bootstrap.Modal.getOrCreateInstance(addPartidoForm.closest('.modal'));
          modal.hide();
        });
      });
  });

});
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
