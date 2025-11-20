
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

    console.log(partido);

    if (partido.esLocal) {
        document.getElementById('nombreEquipoMarcador').textContent = partido.nombreEquipo;
        document.getElementById('marcadorEquipo').textContent = partido.puntosEquipo;
        document.getElementById('faltasEquipo').textContent = partido.faltasEquipo;

        document.getElementById('nombreEquipoRival').textContent = partido.nombreRival;
        document.getElementById('marcadorRival').textContent = partido.puntosRival;
        document.getElementById('faltasRival').textContent = partido.faltasRival;
    } else {

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
    setInterval(() => {
        location.reload();
      }, 30000);
           break;
  case 'finalizado':
    parrafo.textContent = "El partido ha finalizado.";
    parrafo.classList.remove('text-primary');
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

function renderListaJugadoresConvocados(partido) {
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
    ['Nombre', 'Puntos', 'Asist.', 'Rebotes', 'Robos', 'Tapones', 'Faltas'].forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Cuerpo
    const tbody = document.createElement('tbody');
    console.log(partido.convocados);
    Object.keys(partido.convocados).forEach(j => {
        const row = document.createElement('tr');
        const stats = partido.estadisticasJugadores[j] || {};
        // Nombre columna
        const tdNombre = document.createElement('td');
        const jugadorConvocado = partido.convocados[j]; // OBJETO {nombre: ..., dorsal: ...}


        let enpista = "";

        if (partido.jugadoresEnPista && partido.jugadoresEnPista[j]) {
          enpista = "* ";
        }
        
        tdNombre.textContent = enpista + jugadorConvocado.nombre + " (#" + jugadorConvocado.dorsal + ")";
        
        row.appendChild(tdNombre);


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
