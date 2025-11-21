
firebase.initializeApp(window.firebaseConfig);

const db = firebase.database();






const params = new URLSearchParams(window.location.search);
const id = params.get('id');


if (!id) {
    alert('Faltan parámetros para cargar partido');
    window.location.href = 'index.html';
}


db.ref(`partidosGlobales/${id}/`).get().then(snapshot => {

    if (!snapshot.exists()) {
        console.log('No hay partidos en esta fecha.');
    }


    const partido = snapshot.val();
    partido.id = snapshot.key;
    


    if (partido.esLocal) {
      document.getElementById('nombrePartido').textContent =  partido.nombreEquipo + " vs " + partido.nombreRival;


        document.getElementById('nombreEquipoMarcador').textContent = partido.nombreEquipo;
        document.getElementById('marcadorEquipo').textContent = partido.puntosEquipo;
        document.getElementById('faltasEquipo').textContent = partido.faltasEquipo;

        document.getElementById('nombreEquipoRival').textContent = partido.nombreRival;
        document.getElementById('marcadorRival').textContent = partido.puntosRival;
        document.getElementById('faltasRival').textContent = partido.faltasRival;
    } else {
      document.getElementById('nombrePartido').textContent =  partido.nombreRival + " vs " + partido.nombreEquipo;

        document.getElementById('nombreEquipoMarcador').textContent = partido.nombreRival;
        document.getElementById('marcadorEquipo').textContent = partido.puntosRival;
        document.getElementById('faltasEquipo').textContent = partido.faltasRival;

        document.getElementById('nombreEquipoRival').textContent = partido.nombreEquipo;
        document.getElementById('marcadorRival').textContent = partido.puntosEquipo;
        document.getElementById('faltasRival').textContent = partido.faltasEquipo;

    }
    renderListaJugadoresConvocados(partido);

const divEstado = document.getElementById('divEstado');const parrafo = document.createElement('p');
parrafo.classList.add('text-center', 'h4', 'fw-bold', 'text-primary'); // título centrado, negrita y color azul primario

switch (partido.estado) {
  case 'pendiente':
    if (partido.fechaHora) {
      const fecha = new Date(partido.fechaHora);
      const opciones = { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
      };
      const fechaFormateada = fecha.toLocaleString('es-ES', opciones);
      parrafo.textContent = `Partido empieza el ${fechaFormateada}`;
    } else {
      parrafo.textContent = "Fecha del partido no disponible";
    }
    divEstado.innerHTML = '';
    divEstado.appendChild(parrafo);
    break;
  case 'en curso':
    parrafo.textContent = "En vivo...";
    parrafo.classList.remove('text-primary');
    parrafo.classList.add('text-success'); // cambio a verde
    divEstado.innerHTML = '';
    divEstado.appendChild(parrafo);
    setInterval(() => {
        location.reload();
      }, 30000);
           break;
  case 'finalizado':
    parrafo.textContent = "El partido ha finalizado.";
    parrafo.classList.remove('text-danger');
    parrafo.classList.add('text-success'); // cambio a verde
    divEstado.innerHTML = '';
    divEstado.appendChild(parrafo);
    break;
  default:
    // otro estado
}


}).catch(error => {
    console.error(error);
});

let ordenActual = { columna: null, ascendente: false };

function renderListaJugadoresConvocados(partido) {
  const contenedor = document.getElementById('tablaEstadisticasContainer');
  if (!contenedor) return;

  contenedor.innerHTML = '';

  const table = document.createElement('table');
  table.className = 'table table-striped table-bordered table-sm';

  // Cabecera con click para ordenar
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const columnas = ['Nombre', 'Pts.', 'Asist.', 'Reb.', 'Rob.', 'Tap.', 'Fal.'];
  const clavesStats = [null, 'puntos', 'asistencias', 'rebotes', 'robos', 'tapones', 'faltas'];

  columnas.forEach((texto, idx) => {
    const th = document.createElement('th');
    th.textContent = texto;
    th.style.cursor = 'pointer';
    th.onclick = () => {
      if (idx === 0) {
        // Nombre siempre orden ascendente
        ordenActual = { columna: 'nombre', ascendente: true };
      } else {
        // Otras columnas orden descendente siempre en primer click
        if (ordenActual.columna === clavesStats[idx] && !ordenActual.ascendente) {
          ordenActual.ascendente = true; // si ya descendente, ahora ascendente
        } else {
          ordenActual = { columna: clavesStats[idx], ascendente: false };
        }
      }
      renderListaJugadoresConvocados(partido);
    };
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  // Obtener jugadores y ordenar según estado
  let jugadores = Object.keys(partido.convocados);

  jugadores.sort((a, b) => {
    if (!ordenActual.columna) return 0;
    const convA = partido.convocados[a];
    const convB = partido.convocados[b];

    if (ordenActual.columna === 'nombre') {
      const nombreA = convA.nombre.toLowerCase();
      const nombreB = convB.nombre.toLowerCase();
      if (nombreA < nombreB) return ordenActual.ascendente ? -1 : 1;
      if (nombreA > nombreB) return ordenActual.ascendente ? 1 : -1;
      return 0;
    } else {
      const statsA = partido.estadisticasJugadores[a] || {};
      const statsB = partido.estadisticasJugadores[b] || {};
      const valA = statsA[ordenActual.columna] || 0;
      const valB = statsB[ordenActual.columna] || 0;

      if (valA < valB) return ordenActual.ascendente ? -1 : 1;
      if (valA > valB) return ordenActual.ascendente ? 1 : -1;
      return 0;
    }
  });

  jugadores.forEach(j => {
    const row = document.createElement('tr');
    const stats = partido.estadisticasJugadores[j] || {};
    const jugadorConvocado = partido.convocados[j]; 

    let enpista = "";

    if (partido.jugadoresEnPista && partido.jugadoresEnPista[j]) {
      enpista = "* ";
    }
    
    const tdNombre = document.createElement('td');
    tdNombre.textContent = enpista + jugadorConvocado.nombre + " (#" + jugadorConvocado.dorsal + ")";
    row.appendChild(tdNombre);

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
