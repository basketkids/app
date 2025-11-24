class DataService {
  constructor(db, userId, teamId, competitionId, matchId) {
    this.db = db;
    this.userId = userId;
    this.teamId = teamId;
    this.competitionId = competitionId;
    this.matchId = matchId;
  }

  // Referencia Firebase al nodo del partido específico
  get partidoRef() {
    return this.db.ref(`usuarios/${this.userId}/equipos/${this.teamId}/competiciones/${this.competitionId}/partidos/${this.matchId}`);
  }

  /**
   * Carga todos los datos del partido.
   * Retorna un objeto partido con estructura aproximada:
   * {
   *   convocados: { jugadorId: { dorsal: number, nombre: string }, ... },
   *   jugadoresEnPista: { jugadorId: true, ... },
   *   estadisticasJugadores: { jugadorId: { puntos: number, asistencias: number, ... }, ... },
   *   configuracion: "4x10" | "6x8",
   *   parteActual: number,
   *   estado: "no empezado" | "en curso" | "finalizado",
   *   puntosEquipo: number,
   *   puntosRival: number,
   *   faltasEquipo: number,
   *   faltasRival: number,
   *   eventos: { ... } // nodo con lista cronológica de eventos
   * }
   */
  cargarPartido() {
    return this.partidoRef.once('value').then(snap => {
      if (snap.exists()) {
        let partido = snap.val();

        // Validar campos clave y asignar valores por defecto si faltan
        partido.convocados = partido.convocados || {};
        partido.jugadoresEnPista = partido.jugadoresEnPista || {};
        partido.estadisticasJugadores = partido.estadisticasJugadores || {};

        partido.configuracion = partido.configuracion || '4x10';
        partido.parteActual = partido.parteActual || 1;
        partido.duracionParte = partido.duracionParte || (partido.configuracion === '6x8' ? 8 * 60 : 10 * 60);
        partido.totalPartes = partido.totalPartes || (partido.configuracion === '6x8' ? 6 : 4);

        partido.estado = partido.estado || 'no empezado';

        partido.puntosEquipo = partido.puntosEquipo || 0;
        partido.puntosRival = partido.puntosRival || 0;
        partido.faltasEquipo = partido.faltasEquipo || 0;
        partido.faltasRival = partido.faltasRival || 0;

        partido.eventos = partido.eventos || {};

        return partido;
      } else {
        return null;
      }
    });
  }

  /**
   * Carga la plantilla de jugadores como array:
   * [
   *   { id: string, dorsal: number, nombre: string, ... },
   *   ...
   * ]
   */
  cargarPlantilla() {
    return this.db.ref(`usuarios/${this.userId}/equipos/${this.teamId}/plantilla`).once('value').then(snap => {
      const lista = [];
      snap.forEach(child => {
        lista.push({ id: child.key, ...child.val() });
      });
      return lista;
    });
  }

  /**
   * Guarda el objeto completo del partido.
   * @param {Object} partidoObj - Objeto completo del partido con toda la estructura.
   */
  guardarPartido(partidoObj) {
    return this.partidoRef.set(partidoObj)
      .then(() => this._sincronizarPartidoGlobal());
  }

  /**
   * Guarda datos simples en ruta relativa dentro del partido y sincroniza globalmente.
   * @param {string} path - Camino relativo (ej: "convocados", "estado", etc).
   * @param {Object} data - Datos JSON serializables a guardar.
   */
  guardarDatos(path, data) {
    return this.partidoRef.child(path).set(data)
      .then(() => this._sincronizarPartidoGlobal());
  }

  /**
   * Agrega un evento al partido (canasta, falta, cambio pista, estadistica)
   * Y actualiza las estadísticas y marcadores automáticamente.
   * @param {Object} evento - Evento que contiene:
   *  tipo, jugadorId, nombre, dorsal, cuarto, tiempoSegundos, detalle,
   *  puntos?, estadisticaTipo?, cantidad?
   */
  pushEvento(evento) {
    console.log('Guardando evento:', evento);
    const eventosRef = this.partidoRef.child('eventos');
    // console.log('Guardando evento:',evento);
    return eventosRef.push(evento)
      .then(() => this._procesarEvento(evento))
      .then(() => this._sincronizarPartidoGlobal());;
  }

  // Procesa internamente un evento para actualizar estadísticas y marcadores
  _procesarEvento(evento) {
    if (evento.tipo === 'finCuarto' || evento.tipo === 'inicioCuarto') {
      return Promise.resolve();
    }

    if (evento.dorsal >= 0) {
      const estadisticasRef = this.partidoRef.child('estadisticasJugadores');

      switch (evento.tipo) {
        case 'puntos':

          return estadisticasRef.once('value').then(snap => {
            const stats = snap.val() || {};
            if (!stats[evento.jugadorId]) stats[evento.jugadorId] = this._inicializarEstadisticas();
            stats[evento.jugadorId].puntos = (stats[evento.jugadorId].puntos || 0) + (evento.cantidad || 0);
            return estadisticasRef.set(stats).then(() => this._actualizarMarcador(evento));

          });

        case 'cambioPista':
          return Promise.resolve();

        default:
          // console.log("otros")
          return estadisticasRef.once('value').then(snap => {
            const stats = snap.val() || {};
            if (!stats[evento.jugadorId]) stats[evento.jugadorId] = this._inicializarEstadisticas();
            if (evento.estadisticaTipo && evento.cantidad)
              stats[evento.jugadorId][evento.estadisticaTipo] = (stats[evento.jugadorId][evento.estadisticaTipo] || 0) + evento.cantidad;
            return estadisticasRef.set(stats).then(() => this._actualizarFaltas(evento));
          });
      }
    } else {
      if (evento.tipo == "puntos") {
        this._actualizarMarcador(evento);

      } else {
        this._actualizarFaltas(evento);

      }
    }

  }

  // Actualiza marcador según evento
  _actualizarMarcador(evento) {
    if (evento.dorsal === -1) {
      const puntosRivalRef = this.partidoRef.child('puntosRival');
      return puntosRivalRef.transaction(v => (v || 0) + (evento.cantidad || 0));
    } else {
      const puntosEquipoRef = this.partidoRef.child('puntosEquipo');
      console.log("holoolaaaa" + puntosEquipoRef);
      return puntosEquipoRef.transaction(v => (v || 0) + (evento.cantidad || 0));
    }
  }

  // Actualiza faltas según evento
  _actualizarFaltas(evento) {
    if (evento.dorsal === -1) {
      const faltasRivalRef = this.partidoRef.child('faltasRival');
      return faltasRivalRef.transaction(v => (v || 0) + 1);
    } else {
      const faltasEquipoRef = this.partidoRef.child('faltasEquipo');
      return faltasEquipoRef.transaction(v => (v || 0) + 1);
    }
  }

  // Inicializa estructura de estadísticas para un jugador
  _inicializarEstadisticas() {
    return { puntos: 0, asistencias: 0, rebotes: 0, robos: 0, tapones: 0, faltas: 0 };
  }

  // Sincroniza el partido actual dentro del nodo global 'partidosGlobales'
  _sincronizarPartidoGlobal() {
    console.log("sincronizandoooo")
    const refGlobal = this.db.ref(`partidosGlobales/${this.matchId}`);
    return this.partidoRef.once('value')
      .then(snapshot => {
        if (!snapshot.exists()) return refGlobal.remove();
        return refGlobal.set(snapshot.val());
      });
  }
}



class PartidosGlobalesDataService {
  constructor(db) {
    this.db = db; // instancia de Firebase database
    this.rootPath = 'partidosGlobales'; // nodo raíz para partidos globales
  }

  // Obtener partido global por ID, devuelve Promise con datos
  getPartidoGlobal(partidoId) {
    const partidoRef = this.db.ref(`${this.rootPath}/${partidoId}`);
    return partidoRef.once('value')
      .then(snapshot => {
        if (snapshot.exists()) {
          return snapshot.val();
        } else {
          throw new Error('Partido global no encontrado');
        }
      });
  }
}