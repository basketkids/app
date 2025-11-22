

firebase.initializeApp(window.firebaseConfig);

const db = firebase.database();

let fechaActual = new Date();

function formatoFechaISO(date) {
  return date.toISOString().slice(0, 10);
}



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




function cargarPartidosPorFecha(fechaISO) {
  const contenedor = document.getElementById('partidosPorFecha');
  contenedor.innerHTML = 'Cargando partidos...';

  db.ref('partidosGlobales').once('value').then(snapshot => {
    contenedor.innerHTML = '';
    if (!snapshot.exists()) {
      contenedor.textContent = 'No hay partidos en esta fecha.';
      return;
    }

    const partidosFiltrados = [];
    snapshot.forEach(partidoSnap => {
      const partido = partidoSnap.val();
      partido.id = partidoSnap.key;

      console.log(partido.id);
      const fechaPartido = partido.fechaHora ? partido.fechaHora.slice(0, 10) : '';
      console.log(fechaPartido);
      if (fechaPartido === fechaISO) {
        partidosFiltrados.push(partido);
      }
    });

    if (partidosFiltrados.length === 0) {
      contenedor.textContent = 'No hay partidos en esta fecha.';
      return;
    }

    partidosFiltrados.forEach(partido => {
      mostrarPartidos(partido, contenedor);

    });
  }).catch(error => {
    contenedor.textContent = 'Error cargando partidos.';
    console.error(error);
  });
}

function mostrarPartidos(partido, contenedor) {
  const li = document.createElement('li');
  li.classList.add('list-group-item', 'd-flex', 'justify-content-between', 'align-items-center');
  // Elimina 'flex-column' para que las columnas sean horizontales

  // Contenedor columna izquierda (info partido)
  const infoCol = document.createElement('div');
  infoCol.style.flexGrow = '1'; // Ocupa todo espacio disponible
  infoCol.classList.add('d-flex', 'flex-column', 'text-start');

  // Fecha y hora
  const fechaObj = new Date(partido.fechaHora);
  const fechaStr = fechaObj.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const horaStr = fechaObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const divFechaHora = document.createElement('div');
  divFechaHora.style.fontSize = '0.85em';
  divFechaHora.style.lineHeight = '1.1em';
  divFechaHora.style.marginBottom = '0.3rem';
  divFechaHora.textContent = `${fechaStr}\n${horaStr}`;

  // Equipos local y visitante
  const nombreEquipo = partido.nombreEquipo;
  let local = partido.esLocal ? nombreEquipo : partido.nombreRival || 'Rival';
  let visitante = partido.esLocal ? (partido.nombreRival || 'Rival') : nombreEquipo;
  const divEquipos = document.createElement('div');
  divEquipos.style.fontWeight = '600';
  divEquipos.textContent = `${local} vs ${visitante}`;

  // Marcador y estado (en fila)
  const divMarcador = document.createElement('div');
  divMarcador.classList.add('d-flex', 'align-items-center', 'gap-2', 'mt-2');
  const puntosEquipo = partido.puntosEquipo ?? 0;
  const puntosRival = partido.puntosRival ?? 0;
  const marcadorSpan = document.createElement('span');
  marcadorSpan.style.fontWeight = 'bold';
  if (partido.esLocal) {
    marcadorSpan.textContent = `${puntosEquipo} - ${puntosRival}`;
  } else {
    marcadorSpan.textContent = `${puntosRival} - ${puntosEquipo}`;
  }

  const iconEstado = document.createElement('i');
  iconEstado.style.fontSize = '1.2em';
  iconEstado.style.display = 'inline-block';
  switch (partido.estado) {
    case 'pendiente':
      iconEstado.classList.add('bi', 'bi-clock', 'text-secondary');
      iconEstado.title = 'Partido aún no ha empezado';
      break;
    case 'en curso':
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

  // Añadir partes al contenedor info columna
  infoCol.appendChild(divFechaHora);
  infoCol.appendChild(divEquipos);
  infoCol.appendChild(divMarcador);

  // Contenedor columna derecha (botones)
  const botonesContainer = document.createElement('div');
  botonesContainer.classList.add('d-flex', 'gap-2', 'justify-content-end');

  // Botón gestionar partido
  const boton = document.createElement('a');
  boton.href = `partido.html?id=${partido.id}`;
  boton.className = 'btn btn-success btn-sm';
  boton.title = 'Ver jugador';
  boton.innerHTML = '<i class="bi bi-eye"></i>';
  botonesContainer.appendChild(boton);

  // Añadir columnas al li
  li.appendChild(infoCol);
  li.appendChild(botonesContainer);

  // Finalmente añadir el li al contenedor padre
  contenedor.appendChild(li);
}


function configurarBuscadorFechas() {
  const btnPrev = document.getElementById('btnFechaAnterior');
  const btnNext = document.getElementById('btnFechaSiguiente');
  const lblFecha = document.getElementById('labelFecha');

  function actualizar() {
    const fechaISO = formatoFechaISO(fechaActual);
    lblFecha.textContent = fechaISO;
    cargarPartidosPorFecha(fechaISO);
  }

  btnPrev.onclick = () => {
    fechaActual.setDate(fechaActual.getDate() - 1);
    actualizar();
  };

  btnNext.onclick = () => {
    fechaActual.setDate(fechaActual.getDate() + 1);
    actualizar();
  };

  actualizar();
}

window.addEventListener('DOMContentLoaded', () => {
  configurarBuscadorFechas();
});
