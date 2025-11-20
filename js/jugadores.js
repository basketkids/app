firebase.initializeApp(window.firebaseConfig);

const db = firebase.database();
const auth = firebase.auth();

let currentUser = null;
let jugadorId = null;
let currentTeamId = null;

auth.onAuthStateChanged(user => {
  if (!user) {
    alert('Por favor inicia sesión');
    window.location.href = 'index.html';
    return;
  }
  currentUser = user;

  // Obtener parámetros URL
  const params = new URLSearchParams(window.location.search);
  jugadorId = params.get('idJugador');
  currentTeamId = params.get('idEquipo');

  if (!jugadorId || !currentTeamId) {
    alert('Faltan parámetros para cargar jugador');
    window.location.href = 'index.html';
    return;
  }

  cargarDatosJugador();
  cargarInfoEquipo();
  cargarEstadisticasTotales();

  // Preparar formulario
  document.getElementById('formEditarJugador').addEventListener('submit', guardarCambiosJugador);
});

function cargarDatosJugador() {
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/plantilla/${jugadorId}`)
    .once('value')
    .then(snap => {
      if (snap.exists()) {
        const data = snap.val();
        document.getElementById('inputNombre').value = data.nombre || '';
        document.getElementById('inputDorsal').value = data.dorsal || '';
      } else {
        alert('Jugador no encontrado');
        window.location.href = 'index.html';
      }
    })
    .catch(console.error);
}

function cargarInfoEquipo() {
  // Cargar nombre equipo
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/nombre`)
    .once('value')
    .then(snap => {
      const nombreEquipo = snap.exists() ? snap.val() : 'Equipo desconocido';
      // Cargar competiciones equipo
      db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones`).once('value').then(cSnap => {
        let competiciones = [];
        if (cSnap.exists()) {
          competiciones = Object.values(cSnap.val()).map(c => c.nombre || 'Nombre desconocido');
        }
        const cont = document.getElementById('infoEquipo');
        cont.innerHTML = `
          <p><strong>Equipo:</strong> ${nombreEquipo}</p>
          <p><strong>Competiciones:</strong> ${competiciones.join(', ') || 'Sin competiciones'}</p>
        `;
      });
    })
    .catch(console.error);
}
async function cargarEstadisticasTotales() {
    try {
      const totales = {
        partidos: 0,
        puntos: 0,
        rebotes: 0,
        asistencias: 0,
        faltas: 0,
        tapones: 0,
        robos: 0
      };
  
      // Obtener todas las competiciones del equipo
      const competicionesSnap = await db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones`).once('value');
      if (!competicionesSnap.exists()) {
        mostrarEstadisticas(totales);
        return;
      }
  
      const competiciones = competicionesSnap.val();
  
      // Recorrer las competiciones una a una
      for (const competicionId in competiciones) {
        // Obtener partidos de esa competición
        const partidosSnap = await db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${competicionId}/partidos`).once('value');
        if (!partidosSnap.exists()) continue;
  
        const partidos = partidosSnap.val();
  
        // Para cada partido sumar estadísticas del jugador si existen
        for (const partidoId in partidos) {
          const statsSnap = await db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/competiciones/${competicionId}/partidos/${partidoId}/estadisticasJugadores/${jugadorId}`).once('value');
          if (statsSnap.exists()) {
            totales.partidos++;
            const stats = statsSnap.val();
            totales.puntos += stats.puntos || 0;
            totales.rebotes += stats.rebotes || 0;
            totales.asistencias += stats.asistencias || 0;
            totales.faltas += stats.faltas || 0;
            totales.tapones += stats.tapones || 0;
            totales.robos += stats.robos || 0;
          }
        }
      }
  
      mostrarEstadisticas(totales);
    } catch (error) {
      console.error('Error cargando estadísticas totales:', error);
    }
  }
  
  function mostrarEstadisticas(totales) {
    const cont = document.getElementById('statsTotales');
  
    // Calcular promedios por partido (evitar división por cero)
    const partidos = totales.partidos || 1;
    const promedio = {
      puntos: (totales.puntos / partidos).toFixed(2),
      rebotes: (totales.rebotes / partidos).toFixed(2),
      asistencias: (totales.asistencias / partidos).toFixed(2),
      faltas: (totales.faltas / partidos).toFixed(2),
      tapones: (totales.tapones / partidos).toFixed(2),
      robos: (totales.robos / partidos).toFixed(2)
    };
  
    cont.innerHTML = `
      <h5>Totales</h5>
      <table class="table table-bordered table-sm mb-4">
        <thead>
          <tr>
            <th>Estadística</th>
            <th>Total</th>
            <th>Promedio</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Partidos jugados</td><td>${totales.partidos}</td><td>${totales.partidos}</td></tr>
          <tr><td>Puntos</td><td>${totales.puntos}</td><td>${promedio.puntos}</td></tr>
          <tr><td>Rebotes</td><td>${totales.rebotes}</td><td>${promedio.rebotes}</td></tr>
          <tr><td>Asistencias</td><td>${totales.asistencias}</td><td>${promedio.asistencias}</td></tr>
          <tr><td>Faltas</td><td>${totales.faltas}</td><td>${promedio.faltas}</td></tr>
          <tr><td>Tapones</td><td>${totales.tapones}</td><td>${promedio.tapones}</td></tr>
          <tr><td>Robos</td><td>${totales.robos}</td><td>${promedio.robos}</td></tr>
        </tbody>
      </table>
  
    `;
  }
  

function guardarCambiosJugador(e) {
  e.preventDefault();
  const nuevoNombre = document.getElementById('inputNombre').value.trim();
  const nuevoDorsal = parseInt(document.getElementById('inputDorsal').value);
  if (!nuevoNombre || !nuevoDorsal) {
    alert('Por favor completa todos los campos');
    return;
  }
  db.ref(`usuarios/${currentUser.uid}/equipos/${currentTeamId}/plantilla/${jugadorId}`)
    .update({ nombre: nuevoNombre, dorsal: nuevoDorsal })
    .then(() => alert('Datos actualizados correctamente'))
    .catch(err => {
      alert('Error al actualizar: ' + err.message);
      console.error(err);
    });
}
