class PartidoApp extends BaseApp {
  constructor() {
    super();
    this.dataService = null;

    // Estado centralizado único que contiene toda la información del partido
    this.partido = null;
    this.plantillaJugadores = [];

    this.selectConfiguracion = document.getElementById('selectConfiguracion');
    this.selectCuarto = document.getElementById('selectCuarto');
    this.btnStartPause = document.getElementById('btnStartPause');
    this.btnTerminarCuarto = document.getElementById('btnTerminarCuarto');
    this.btnTerminar = document.getElementById('btnTerminar');
    this.contadorInterval = null;
    this.contadorActivo = false;
  }

  onUserLoggedIn(user) {
    const teamId = this.getParam('idEquipo');
    const competitionId = this.getParam('idCompeticion');
    const matchId = this.getParam('idPartido');

    if (!teamId || !competitionId || !matchId) {
      alert('Faltan parámetros en la URL');
      window.location.href = 'index.html';
      return;
    }

    this.dataService = new DataService(this.db, user.uid, teamId, competitionId, matchId);
    this.initMatch();
  }

  async initMatch() {
    try {
      this.partido = await this.dataService.cargarPartido();
      console.log(this.partido);

      if (!this.partido) throw new Error('Partido no encontrado');

      this.plantillaJugadores = await this.dataService.cargarPlantilla();
      // Ajustar configuración partido y temporizador según datos cargados
      this.configuracionPartido = this.partido.configuracion || '4x10';
      this.configurarPartido(this.configuracionPartido, false);

      this.parteActual = this.partido.parteActual || 1;
      console.log(this.partido.parteActual);
      console.log(this.parteActual);
      this.segundosRestantes = this.partido.duracionParte || (this.configuracionPartido === '6x8' ? 8 * 60 : 10 * 60);

      this.estadoPartido = this.partido.estado || 'no empezado';

      this.calcularTiempoRestante();
      this.renderizarTodo();
      this.prepararEventos();
      this.inicializarTemporizador();
    } catch (error) {
      console.error(error);
      alert('Error cargando los datos del partido');
    }
  }
  calcularTiempoRestante() {
    console.log(this.parteActual);
    console.log(this.partido.parteActual);
    // Aquí actualizar cuarto y segundos al último evento si existen eventos
    const eventosArray = this.partido.eventos ? Object.values(this.partido.eventos) : [];
    if (eventosArray.length > 0) {
      eventosArray.sort((a, b) => {
        if (a.cuarto === b.cuarto) {
          return b.tiempoSegundos - a.tiempoSegundos; // más reciente primero
        } else {
          return b.cuarto - a.cuarto; // cuarto mayor primero
        }
      });
      const ultimaJugada = eventosArray[0];
      console.log(ultimaJugada);
      this.partido.parteActual = ultimaJugada.cuarto || this.partido.parteActual || 1;
      const duracionParte = this.partido.duracionParte || (this.configuracionPartido === '6x8' ? 8 * 60 : 10 * 60);
      this.segundosRestantes = duracionParte - (ultimaJugada.tiempoSegundos || 0);
      if (this.segundosRestantes < 0) this.segundosRestantes = 0;
    } else {
      this.partido.parteActual = this.partido.parteActual || 1;
      this.segundosRestantes = this.partido.duracionParte || (this.configuracionPartido === '6x8' ? 8 * 60 : 10 * 60);
    }
    console.log(this.parteActual);
    console.log(this.partido.parteActual);

  }

  configurarPartido(opcion, guardarEnFirebase = true) {
    if (opcion === '6x8') {
      this.partido.duracionParte = 8 * 60;
      this.partido.totalPartes = 6;
      this.partido.configuracion = '6x8';
    }
    else {
      this.partido.duracionParte = 10 * 60;
      this.partido.totalPartes = 4;
      this.partido.configuracion = '4x10';
    }

    //
    this.segundosRestantes = this.partido.duracionParte;
    this.estadoPartido = 'no empezado';

    this.pausarContador();
    this.actualizarDisplay();

    if (this.selectCuarto) {
      this.selectCuarto.innerHTML = '';
      for (let i = 1; i <= this.partido.totalPartes; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        this.selectCuarto.appendChild(option);
      }

      this.selectCuarto.value = this.partido.parteActual;
    }

    if (guardarEnFirebase) {
      this.dataService.guardarPartido(this.partido).catch(console.error);
    }
  }

  renderizarTodo() {
    this.renderListaJugadoresPlantilla();
    this.renderListaJugadoresConvocados();
    this.renderListaJugadoresPista();
    this.renderEventosEnVivo();
    this.actualizarDisplay();
    this.actualizarBotonesPorEstado();
    this.actualizarMarcadoryFaltas();
  }


  prepararEventos() {
    this.selectConfiguracion?.addEventListener('change', e => this.configurarPartido(e.target.value));

    this.selectCuarto?.addEventListener('change', e => {
      this.partido.parteActual = parseInt(e.target.value);
      this.segundosRestantes = this.partido.duracionParte;
      this.guardarPartido();
      this.actualizarDisplay();
    });

    document.getElementById('formConvocarJugadores')?.addEventListener('submit', e => {
      e.preventDefault();
      this.guardarConvocadosModal();
    });

    document.getElementById('formElegirPista')?.addEventListener('submit', e => {
      e.preventDefault();
      this.guardarJugadoresEnPista();
    });

    this.btnStartPause?.addEventListener('click', () => this.toggleTemporizador());
    this.btnTerminarCuarto?.addEventListener('click', () => this.terminarCuarto());
    this.btnTerminar?.addEventListener('click', () => this.terminarPartido());



    const btnPuntoRival1 = document.getElementById('btnPuntoRival1');
    const btnPuntoRival2 = document.getElementById('btnPuntoRival2');
    const btnPuntoRival3 = document.getElementById('btnPuntoRival3');
    const btnFaltasRival = document.getElementById('btnFaltasRival');

    if (btnPuntoRival1) {
      btnPuntoRival1.addEventListener('click', () => this.agregarEstadistica('', 'puntos', 1));
    }
    if (btnPuntoRival2) {
      btnPuntoRival2.addEventListener('click', () => this.agregarEstadistica('', 'puntos', 2));
    }
    if (btnPuntoRival3) {
      btnPuntoRival3.addEventListener('click', () => this.agregarEstadistica('', 'puntos', 3));
    }
    if (btnFaltasRival) {
      btnFaltasRival.addEventListener('click', () => this.agregarEstadistica('', 'faltas', 1));
    }
  } renderEventosEnVivo() {
    const cont = document.getElementById('listaEventosEnVivo');
    if (!cont || !this.partido || !this.partido.eventos) return;

    cont.innerHTML = '';

    const eventosArray = Object.values(this.partido.eventos);

    // Orden descendente por cuarto y tiempo para mostrar primero los cuartos más altos y luego jugadas más recientes
    eventosArray.sort((a, b) => {
      if (a.cuarto === b.cuarto) {
        // Por tiempo descendente (más actual primero)
        return b.tiempoSegundos - a.tiempoSegundos;
      } else {
        // Por cuarto descendente (cuarto mayor primero)
        return b.cuarto - a.cuarto;
      }
    });

    let ultimoCuarto = null;
    eventosArray.forEach(evento => {
      if (evento.cuarto !== ultimoCuarto) {
        const header = document.createElement('h5');
        header.className = 'mt-3 mb-2';
        header.textContent = `Cuarto ${evento.cuarto}`;
        cont.appendChild(header);
        ultimoCuarto = evento.cuarto;
      }

      const item = document.createElement('div');
      item.className = 'list-group-item d-flex justify-content-between align-items-center';

      // Resaltar eventos rival (dorsal negativo)
      if (evento.dorsal < 0) {
        item.classList.add('bg-light', 'text-danger', 'fw-bold');
      }

      // Calcular tiempo restante para finalizar el cuarto
      const tiempoRestanteSeg = (this.partido.duracionParte || 600) - evento.tiempoSegundos;
      const minutos = Math.floor(tiempoRestanteSeg / 60);
      const segundos = tiempoRestanteSeg % 60;
      const tiempoStr = `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;

      const jugadorStr = evento.nombre || 'Desconocido';
      const dorsalStr = evento.dorsal > 0 ? `#${evento.dorsal}` : '';

      item.innerHTML = `
        <div>
          <span>${jugadorStr} ${dorsalStr}</span>
          <div><small>${evento.detalle || ''}</small></div>
        </div>
        <small class="text-muted fw-monospace">${tiempoStr}</small>
      `;
      cont.appendChild(item);
    });
  }



  renderListaJugadoresPlantilla() {
    const ul = document.getElementById('listaJugadoresPlantilla');
    if (!ul) return;
    ul.innerHTML = '';
    this.plantillaJugadores.forEach(j => {
      const li = document.createElement('li');
      li.className = 'list-group-item';

      const label = document.createElement('label');
      label.className = 'form-check-label d-flex align-items-center gap-2';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'form-check-input';
      checkbox.checked = this.partido.convocados && this.partido.convocados[j.id];
      checkbox.onchange = () => {
        if (!this.partido.convocados) this.partido.convocados = {};
        if (checkbox.checked) this.partido.convocados[j.id] = { dorsal: j.dorsal, nombre: j.nombre };
        else delete this.partido.convocados[j.id];
        this.guardarPartido();
      };

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(` ${j.nombre} (#${j.dorsal})`));
      li.appendChild(label);
      ul.appendChild(li);
    });
  }

  renderListaJugadoresConvocados() {
    const cont = document.getElementById('tablaEstadisticasContainer');
    if (!cont) return;
    cont.innerHTML = '';

    const table = document.createElement('table');
    table.className = 'table table-striped table-bordered table-sm';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Nombre', 'Puntos', 'Asist.', 'Rebotes', 'Robos', 'Tapones', 'Faltas'].forEach(text => {
      const th = document.createElement('th');
      th.textContent = text;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    if (this.partido.convocados) {
      Object.entries(this.partido.convocados).forEach(([id, jug]) => {
        const tr = document.createElement('tr');
        const tdNombre = document.createElement('td');
        tdNombre.style.fontWeight = '600';
        tdNombre.textContent = `${jug.nombre} (#${jug.dorsal})`;
        tr.appendChild(tdNombre);

        const stats = (this.partido.estadisticasJugadores && this.partido.estadisticasJugadores[id]) || {};
        ['puntos', 'asistencias', 'rebotes', 'robos', 'tapones', 'faltas'].forEach(k => {
          const td = document.createElement('td');
          td.textContent = stats[k] || 0;
          tr.appendChild(td);
        });

        tbody.appendChild(tr);
      });
    }

    table.appendChild(tbody);
    cont.appendChild(table);
    this.renderListaJugadoresConvocadosModal();
  }



  renderListaJugadoresPista() {
    const ul = document.getElementById('listaJugadoresPista');
    if (!ul) return;
    ul.innerHTML = '';
    if (!this.partido.jugadoresEnPista) return;

    Object.keys(this.partido.jugadoresEnPista).forEach(id => {
      const jugador = this.plantillaJugadores.find(j => j.id === id);
      if (!jugador) return;
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex flex-column';

      const nombre = document.createElement('div');
      nombre.textContent = `${jugador.nombre} (#${jugador.dorsal})`;
      nombre.style.fontWeight = '600';

      const stats = (this.partido.estadisticasJugadores && this.partido.estadisticasJugadores[id]) || {};
      const txtStats = document.createElement('small');
      txtStats.className = 'ms-3 text-muted';
      txtStats.textContent = `Pts:${stats.puntos || 0} A:${stats.asistencias || 0} R:${stats.rebotes || 0} S:${stats.robos || 0} T:${stats.tapones || 0} F:${stats.faltas || 0}`;
      nombre.appendChild(txtStats);
      li.appendChild(nombre);



      const contStats = document.createElement('div');
      contStats.className = 'd-flex flex-wrap gap-1 mt-2';

      [1, 2, 3].forEach(p => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-sm btn-outline-primary stat-btn';

        btn.textContent = `+${p}`;
        btn.title = `Añadir ${p} punto${p > 1 ? 's' : ''}`;
        btn.type = 'button';
        btn.onclick = () => this.agregarEstadistica(jugador.id, 'puntos', p);
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
        btn.onclick = () => this.agregarEstadistica(jugador.id, key, 1);
        contStats.appendChild(btn);
      });

      li.appendChild(contStats);


      ul.appendChild(li);
    });
    this.renderListaJugadoresConvocadosModal();
  }


  renderListaJugadoresConvocadosModal() {
    const ul = document.getElementById('listaJugadoresConvocadosModal');
    if (!ul) return;
    ul.innerHTML = '';

    // Usar directamente this.partido.convocados y this.partido.jugadoresEnPista
    if (!this.partido.convocados) return;

    this.plantillaJugadores
      .filter(j => this.partido.convocados.hasOwnProperty(j.id))
      .forEach(j => {
        const li = document.createElement('li');
        li.className = 'list-group-item';

        const label = document.createElement('label');
        label.className = 'form-check-label d-flex align-items-center gap-2';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'form-check-input';

        checkbox.checked = this.partido.jugadoresEnPista && this.partido.jugadoresEnPista.hasOwnProperty(j.id);

        checkbox.onchange = () => {
          if (!this.partido.jugadoresEnPista) this.partido.jugadoresEnPista = {};
          const pista = this.partido.jugadoresEnPista;

          const numEnPista = Object.keys(pista).length;

          if (checkbox.checked) {
            if (numEnPista >= 5) {
              checkbox.checked = false;
              alert('Solo 5 jugadores pueden estar en pista');
              return;
            }
            pista[j.id] = true;
          } else {
            delete pista[j.id];
          }
          this.dataService.guardarDatos('jugadoresEnPista', this.partido.jugadoresEnPista).catch(console.error);
        };

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(` ${j.nombre} (#${j.dorsal})`));
        li.appendChild(label);
        ul.appendChild(li);
      });
  }


  guardarConvocadosModal() {
    // Ya modificado instantáneamente en checkbox con guardarPartido()
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalConvocarJugadores')).hide();
    this.renderListaJugadoresConvocados();
  }

  guardarJugadoresEnPista() {
    // Para guardar jugadores en pista modificar partido y guardar
    if (!this.partido.jugadoresEnPista) this.partido.jugadoresEnPista = {};
    // Ejemplo: suponiendo UI de checkboxes similar a Plantilla
    // Después actualizar Firebase
    this.dataService.guardarPartido(this.partido).then(() => {
      bootstrap.Modal.getOrCreateInstance(document.getElementById('modalElegirPista')).hide();
      this.renderListaJugadoresPista();
    }).catch(e => alert("Error guardando jugadores en pista: " + e.message));
  }


  agregarEstadistica(jugadorId, tipo, cantidad) {
    // Estadísticas de equipo
    if (jugadorId != '') {
      if (!this.partido.estadisticasJugadores) this.partido.estadisticasJugadores = {};
      if (!this.partido.estadisticasJugadores[jugadorId]) {
        this.partido.estadisticasJugadores[jugadorId] = { puntos: 0, asistencias: 0, rebotes: 0, robos: 0, tapones: 0, faltas: 0 };
      }
      this.partido.estadisticasJugadores[jugadorId][tipo] += cantidad;
      if (tipo === "puntos") {
        this.partido.puntosEquipo += cantidad;
      }
    } else {
      // Estadísticas de rival
      if (tipo === "puntos") {

        this.partido.puntosRival += cantidad;
      } else if (tipo === "faltas") {
        console.log("goasas");
        this.partido.faltasRival = (this.partido.faltasRival || 0) + cantidad;
      }
    }

    const nombreEquipoRival = this.partido.nombreRival || 'Rival';
    const evento = {
      tipo: tipo,
      jugadorId: jugadorId,
      nombre: this.partido.convocados && this.partido.convocados[jugadorId]?.nombre || nombreEquipoRival,
      dorsal: this.partido.convocados && this.partido.convocados[jugadorId]?.dorsal || -1,
      cuarto: this.partido.parteActual || 1,
      tiempoSegundos: this.partido.duracionParte - this.segundosRestantes,
      detalle: `+ ${cantidad} ${tipo}`,
      estadisticaTipo: tipo,
      cantidad: cantidad
    };

    const key = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    this.partido.eventos[key] = evento;

    this.dataService.pushEvento(evento)
      .then(() => {
        this.actualizarMarcadoryFaltas();
        this.renderizarTodo();
      })
      .catch(e => console.error('Error agregando evento:', e));
  }




  registrarCambioPista(jugadorId, nombre, dorsal, accion) {
    const evento = {
      tipo: 'cambioPista',
      jugadorId, nombre, dorsal,
      cuarto: this.partido.parteActual || 1,
      tiempoSegundos: this.partido.duracionParte - this.segundosRestantes,
      detalle: `Jugador ${accion} a pista`
    };
    this.dataService.pushEvento(evento).catch(e => console.error('Error guardando evento:', e));
  }
  actualizarMarcadoryFaltas() {
    const fr = document.getElementById('faltasRival');
    if (fr) fr.textContent = `F: ${this.partido.faltasRival || 0}`;

    const fe = document.getElementById('faltasEquipo');
    if (fe) fe.textContent = `F: ${this.partido.faltasEquipo || 0}`;
    const me = document.getElementById('marcadorEquipo');
    if (me) me.textContent = this.partido.puntosEquipo || 0;
    const mr = document.getElementById('marcadorRival');
    if (mr) mr.textContent = this.partido.puntosRival || 0;

    this.actualizarLucesFaltas();
  }

  actualizarLucesFaltas() {
    const faltas = this.calcularFaltasCuarto();
    console.log(faltas);
    this.renderLuces('foulLightsEquipo', faltas.equipo);
    this.renderLuces('foulLightsRival', faltas.rival);
  }

  calcularFaltasCuarto() {
    let faltasEquipo = 0;
    let faltasRival = 0;
    const cuartoActual = this.partido.parteActual || 1;

    if (this.partido.eventos) {
      Object.values(this.partido.eventos).forEach(evento => {
        if (evento.cuarto === cuartoActual && evento.estadisticaTipo === 'faltas') {
          if (evento.dorsal >= 0) {
            faltasEquipo++;
          } else {
            faltasRival++;
          }
        }
      });
    }
    return { equipo: faltasEquipo, rival: faltasRival };
  }

  renderLuces(elementId, numFaltas) {
    const container = document.getElementById(elementId);
    if (!container) return;
    const dots = container.querySelectorAll('.foul-dot');
    dots.forEach((dot, index) => {
      if (index < numFaltas) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  }

  inicializarTemporizador() {
    this.actualizarDisplay();
    if (this.btnStartPause) {
      // Habilitar si estado es no empezado, para poder iniciar partido
      this.btnStartPause.disabled = false;
    }
    if (this.btnTerminarCuarto) this.btnTerminarCuarto.disabled = this.estadoPartido !== 'en curso';
    if (this.btnTerminar) this.btnTerminar.disabled = this.estadoPartido !== 'en curso';
  }

  tick() {
    if (this.segundosRestantes > 0) {
      this.segundosRestantes--;
      this.actualizarDisplay();
    } else {
      this.pausarContador();
      alert('Fin del cuarto');
    }
  }

  iniciarContador() {
    if (this.partidoTerminado) return;
    if (!this.contadorActivo) {
      this.contadorInterval = setInterval(() => this.tick(), 1000);
      this.contadorActivo = true;
      if (this.btnStartPause) this.btnStartPause.innerHTML = '<i class="bi bi-pause-fill"></i>';
    }
  }

  pausarContador() {
    if (this.contadorActivo) {
      clearInterval(this.contadorInterval);
      this.contadorInterval = null;
      this.contadorActivo = false;
      if (this.btnStartPause) this.btnStartPause.innerHTML = '<i class="bi bi-play-fill"></i>';
    }
  }

  actualizarDisplay() {
    if (this.selectCuarto) this.selectCuarto.value = this.partido.parteActual || 1;
    const min = Math.floor(this.segundosRestantes / 60);
    const seg = this.segundosRestantes % 60;
    const elem = document.getElementById('contador');
    if (elem) elem.textContent = `${min.toString().padStart(2, '0')}:${seg.toString().padStart(2, '0')}`;
  }

  toggleTemporizador() {
    if (this.estadoPartido !== 'en curso') {
      this.guardarEstadoPartido('en curso');
      this.partidoIniciado = true;
      this.partidoTerminado = false;
      this.partido.parteActual = 1;
      this.segundosRestantes = this.partido.duracionParte || (this.configuracionPartido === '6x8' ? 8 * 60 : 10 * 60);
      this.actualizarDisplay();
      if (this.btnStartPause) {
        this.btnStartPause.disabled = false;
        this.btnStartPause.innerHTML = '<i class="bi bi-pause-fill"></i>';
      }
      if (this.btnTerminarCuarto) this.btnTerminarCuarto.disabled = false;
      if (this.btnTerminar) this.btnTerminar.disabled = false;
      this.iniciarContador();
      return;
    }
    if (this.contadorActivo) this.pausarContador();
    else this.iniciarContador();
  }

  terminarCuarto() {
    console.log('Terminar cuarto');
    if (this.estadoPartido !== 'en curso') return;
    this.pausarContador();
    if ((this.partido.parteActual || 1) < (this.partido.totalPartes || 4)) {
      this.registrarEventoPartido('finCuarto', `Fin del Cuarto ${this.partido.parteActual}`);

      this.partido.parteActual++;
      this.segundosRestantes = this.partido.duracionParte;
      this.guardarPartido();
      console.log('Partido guardado');
      console.log(this.partido);

      this.registrarEventoPartido('inicioCuarto', `Inicio del Cuarto ${this.partido.parteActual}`);

      this.actualizarDisplay();
      this.renderEventosEnVivo();
      this.actualizarLucesFaltas();

      this.iniciarContador();
    } else {
      alert('Último cuarto, termine el partido con el botón Terminar Partido.');
    }
  }

  registrarEventoPartido(tipo, detalle) {
    console.log('Registrando evento', tipo, detalle);
    const evento = {
      tipo: tipo,
      cuarto: this.partido.parteActual || 1,
      tiempoSegundos: this.partido.duracionParte - this.segundosRestantes,
      detalle: detalle,
      dorsal: -2 // Special dorsal for system events
    };
    this.dataService.pushEvento(evento).catch(e => console.error('Error guardando evento:', e));
  }

  terminarPartido() {
    if (this.estadoPartido !== 'en curso') return;
    this.pausarContador();
    this.guardarEstadoPartido('finalizado');
    this.partidoIniciado = false;
    this.partidoTerminado = true;
    if (this.btnStartPause) this.btnStartPause.disabled = true;
    if (this.btnTerminarCuarto) this.btnTerminarCuarto.disabled = true;
    if (this.btnTerminar) this.btnTerminar.disabled = true;
    alert('El partido ha finalizado.');
  }

  guardarEstadoPartido(estado) {
    this.estadoPartido = estado;
    this.partido.estado = estado;
    this.guardarPartido();
    this.actualizarBotonesPorEstado();
  }

  guardarPartido() {
    console.log('Guardando partido', this.partido);
    this.dataService.guardarPartido(this.partido).catch(console.error);
  }

  actualizarBotonesPorEstado() {
    if (this.estadoPartido === 'no empezado') {
      if (this.btnStartPause) this.btnStartPause.disabled = true;
      if (this.btnTerminarCuarto) this.btnTerminarCuarto.disabled = true;
      if (this.btnTerminar) this.btnTerminar.disabled = true;
    } else if (this.estadoPartido === 'en curso') {
      if (this.btnStartPause) this.btnStartPause.disabled = false;
      if (this.btnTerminarCuarto) this.btnTerminarCuarto.disabled = false;
      if (this.btnTerminar) this.btnTerminar.disabled = false;
    } else if (this.estadoPartido === 'finalizado') {
      if (this.btnStartPause) this.btnStartPause.disabled = true;
      if (this.btnTerminarCuarto) this.btnTerminarCuarto.disabled = true;
      if (this.btnTerminar) this.btnTerminar.disabled = true;
    }
  }
}
