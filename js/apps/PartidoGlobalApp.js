class PartidosGlobalesApp {
  constructor(dataService) {
    this.dataService = dataService;
    this.partido = null;
    this.refrescoInterval = null;
    this.segundosRestantes = 0; // Para controlar display tiempo
    this.parteActual = 1;       // Para controlar el cuarto actual
  }

  cargarPartidoGlobal(partidoId) {
    return this.dataService.getPartidoGlobal(partidoId)
      .then(partido => {
        this.partido = partido;
        this.partido.id = partidoId;
        // console.log(this.partido.id);


        // Obtén el último evento válido para establecer cuarto y tiempo
        const eventosArray = partido.eventos ? Object.values(partido.eventos) : [];
        if (eventosArray.length > 0) {
          eventosArray.sort((a, b) => {
            if (a.cuarto === b.cuarto) return b.tiempoSegundos - a.tiempoSegundos;
            return b.cuarto - a.cuarto;
          });
          const ultimoEvento = eventosArray[0];

          this.parteActual = ultimoEvento.cuarto || 1;
          const duracionParte = partido.duracionParte || 600;
          this.segundosRestantes = duracionParte - (ultimoEvento.tiempoSegundos || 0);
          if (this.segundosRestantes < 0) this.segundosRestantes = 0;
        } else {
          this.parteActual = 1;
          this.segundosRestantes = this.partido.duracionParte || 600;
        }
        this.renderizarPartido();
        this.iniciarRefrescoSiEnCurso();
      })
      .catch(error => {
        console.error('Error cargando partido global:', error);
        this.mostrarError('No se pudo cargar el partido global.');
      });
  }

  renderizarPartido() {
    if (!this.partido) return;

    // Renderizar nombre del partido
    const nombreElem = document.getElementById('nombrePartido');
    if (nombreElem) nombreElem.textContent = this.partido.nombreEquipo + " vs " + this.partido.nombreRival;



    const ne = document.getElementById('nombreEquipoMarcador');
    if (ne) ne.textContent = this.partido.nombreEquipo;

    const nr = document.getElementById('nombreEquipoRival');
    if (nr) nr.textContent = this.partido.nombreRival;

    const estado = document.getElementById('divEstado');
    if (estado) estado.textContent = this.partido.estado;
    // Renderizar marcador equipo
    const marcadorEquipo = document.getElementById('marcadorEquipo');
    if (marcadorEquipo) marcadorEquipo.textContent = this.partido.puntosEquipo || 0;

    // Renderizar marcador rival
    const marcadorRival = document.getElementById('marcadorRival');
    if (marcadorRival) marcadorRival.textContent = this.partido.puntosRival || 0;

    // Renderizar faltas equipo
    //  console.log(this.partido)
    const faltasEquipo = document.getElementById('faltasEquipo');
    if (faltasEquipo) faltasEquipo.textContent = `F: ${this.partido.faltasEquipo || 0}`;

    // Renderizar faltas rival
    const faltasRival = document.getElementById('faltasRival');
    if (faltasRival) faltasRival.textContent = `F: ${this.partido.faltasRival || 0}`;

    this.actualizarLucesFaltas();
    this.actualizarDisplay();
    // Renderizar jugadores convocados
    this.renderizarEstadisticas();

    // Opcional: Renderizar lista básica de eventos en vivo
    this.renderEventosEnVivo();
  }

  renderizarEstadisticas() {
    const containerConvocados = document.getElementById('tablaEstadisticasContainer');
    if (!containerConvocados) return;

    containerConvocados.innerHTML = '';
    if (!this.partido.convocados) return;

    const columnas = ['Nombre', 'Puntos', 'Asist.', 'Rebotes', 'Robos', 'Tapones', 'Faltas', 'Val.'];
    // Campos clave para ordenar, en el mismo orden que columnas
    const campos = ['nombre', 'puntos', 'asistencias', 'rebotes', 'robos', 'tapones', 'faltas', 'Fantasy'];

    // Convertir convocados a array para poder ordenar
    const jugadoresArray = Object.entries(this.partido.convocados).map(([id, jug]) => {
      return { id, ...jug };
    });

    let ordenColumna = 0; // índice de la columna que se está ordenando
    let ascendente = true; // si es ascendente o descendente

    // Función para renderizar la tabla con los datos ordenados
    const renderTabla = (data, colIdx, asc) => {
      containerConvocados.innerHTML = '';

      const table = document.createElement('table');
      table.className = 'table table-striped table-bordered table-sm';

      const thead = document.createElement('thead');
      const trHead = document.createElement('tr');

      columnas.forEach((thText, i) => {
        const th = document.createElement('th');
        th.textContent = thText;
        th.style.cursor = 'pointer';
        // Añadimos indicativo de orden
        if (i === colIdx) {
          th.textContent += asc ? ' ↑' : ' ↓';
        }
        th.onclick = () => {
          if (ordenColumna === i) {
            ascendente = !ascendente; // invertir orden si es la misma columna
          } else {
            ordenColumna = i;
            //   console.log(i);
            // si es la primera columna (Nombre), orden asc al primer click, para el resto descendente
            ascendente = (i === 0);
          }
          ordenarYRenderizar();
        };
        trHead.appendChild(th);
      });

      thead.appendChild(trHead);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      data.forEach(jug => {
        const tr = document.createElement('tr');

        // Nombre + dorsal
        const tdNombre = document.createElement('td');
        tdNombre.style.fontWeight = '600';
        tdNombre.textContent = `${jug.nombre} (#${jug.dorsal})`;
        tr.appendChild(tdNombre);

        // Estadísticas
        const stats = (this.partido.estadisticasJugadores && this.partido.estadisticasJugadores[jug.id]) || {};
        ['puntos', 'asistencias', 'rebotes', 'robos', 'tapones', 'faltas'].forEach(stat => {
          const td = document.createElement('td');
          td.textContent = stats[stat] || 0;
          tr.appendChild(td);
        });

        const tdFanyasy = document.createElement('td');
        tdFanyasy.style.fontWeight = '600';
        tdFanyasy.textContent = this.calcularPuntosFantasy(this.partido.estadisticasJugadores[jug.id]);
        tr.appendChild(tdFanyasy);
        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
      containerConvocados.appendChild(table);
    };

    // Función que ordena según columna y dirección y llama render tabla
    const ordenarYRenderizar = () => {
      const campo = campos[ordenColumna];
      //  console.log(campo);
      jugadoresArray.sort((a, b) => {
        let valA, valB;

        if (campo === 'nombre') {
          valA = a.nombre.toLowerCase();
          valB = b.nombre.toLowerCase();
        } else if (campo === 'Fantasy') {
          //       console.log("sdfsdf")
          valA = this.calcularPuntosFantasy((this.partido.estadisticasJugadores[a.id]));
          valB = this.calcularPuntosFantasy((this.partido.estadisticasJugadores[b.id]));
        } else {
          const statsA = (this.partido.estadisticasJugadores && this.partido.estadisticasJugadores[a.id]) || {};
          const statsB = (this.partido.estadisticasJugadores && this.partido.estadisticasJugadores[b.id]) || {};
          valA = statsA[campo] || 0;
          valB = statsB[campo] || 0;
        }

        if (valA < valB) return ascendente ? -1 : 1;
        if (valA > valB) return ascendente ? 1 : -1;
        return 0;
      });

      renderTabla(jugadoresArray, ordenColumna, ascendente);
    };


    // Primero render
    ordenarYRenderizar();
  }

  calcularPuntosFantasy(stats) {
    if (!stats) return 0;

    const puntosPorPunto = 1;
    const puntosPorRebote = 1;
    const puntosPorAsistencia = 2;
    const puntosPorBloqueo = 3;
    const puntosPorRobo = 3;
    const puntosPorFalta = -1;

    const puntos =
      (stats.puntos || 0) * puntosPorPunto +
      (stats.rebotes || 0) * puntosPorRebote +
      (stats.asistencias || 0) * puntosPorAsistencia +
      (stats.tapones || 0) * puntosPorBloqueo +
      (stats.robos || 0) * puntosPorRobo +
      (stats.faltas || 0) * puntosPorFalta;

    return puntos;
  }

  actualizarDisplay() {
    if (this.partido.estado != "finalizado") {
      const numCuartoElem = document.getElementById('numCuarto');
      if (numCuartoElem) numCuartoElem.textContent = this.parteActual || 1;

      const elem = document.getElementById('contador');
      if (elem) {
        const min = Math.floor(this.segundosRestantes / 60);
        const seg = this.segundosRestantes % 60;
        elem.textContent = `${min.toString().padStart(2, '0')}:${seg.toString().padStart(2, '0')}`;
      }
    }
    else {
      const div = document.getElementById("cabeceramarcador")
      div.style = 'display:none !important';
    }
  }
  renderEventosEnVivo() {
    const cont = document.getElementById('listaEventosEnVivo');
    if (!cont || !this.partido || !this.partido.eventos) return;

    cont.innerHTML = '';

    const eventosArray = Object.values(this.partido.eventos);

    // Agrupar eventos por cuarto
    const eventosPorCuarto = {};
    eventosArray.forEach(evento => {
      if (!eventosPorCuarto[evento.cuarto]) {
        eventosPorCuarto[evento.cuarto] = [];
      }
      eventosPorCuarto[evento.cuarto].push(evento);
    });

    // Obtener los cuartos ordenados descendentemente para pestañas donde cuarto más alto primero
    const cuartos = Object.keys(eventosPorCuarto).map(Number).sort((a, b) => b - a);

    // Crear contenedor para pestañas nav y contenido tab panes
    const tabsNav = document.createElement('ul');
    tabsNav.className = 'nav nav-tabs';
    tabsNav.id = 'cuartosTabs';
    tabsNav.role = 'tablist';

    const tabsContent = document.createElement('div');
    tabsContent.className = 'tab-content mt-3';
    tabsContent.id = 'cuartosTabContent';

    cuartos.forEach((cuarto, index) => {
      // Pestaña: crea botón tab
      const tabId = `cuarto-tab-${cuarto}`;
      const paneId = `cuarto-pane-${cuarto}`;

      const liNav = document.createElement('li');
      liNav.className = 'nav-item';
      liNav.role = 'presentation';

      const button = document.createElement('button');
      button.className = 'nav-link' + (index === 0 ? ' active' : '');
      button.id = tabId;
      button.type = 'button';
      button.dataset.bsToggle = 'tab';
      button.dataset.bsTarget = `#${paneId}`;
      button.role = 'tab';
      button.ariaControls = paneId;
      button.ariaSelected = index === 0 ? 'true' : 'false';
      button.textContent = `Cuarto ${cuarto}`;

      liNav.appendChild(button);
      tabsNav.appendChild(liNav);

      // Contenido pestaña
      const pane = document.createElement('div');
      pane.className = 'tab-pane fade' + (index === 0 ? ' show active' : '');
      pane.id = paneId;
      pane.role = 'tabpanel';
      pane.ariaLabelledby = tabId;

      // Obtener eventos de este cuarto y ordenarlos por tiempo descendiente
      const eventosCuarto = eventosPorCuarto[cuarto].slice().sort((a, b) => b.tiempoSegundos - a.tiempoSegundos);

      // Extraer jugadores únicos del cuarto (sin rival, dorsal < 0)
      const jugadoresSet = new Map(); // key: jugadorId or nombre, value: jugador info
      eventosCuarto.forEach(ev => {
        if (ev.dorsal >= 0 && ev.jugadorId) {
          if (!jugadoresSet.has(ev.jugadorId)) {
            jugadoresSet.set(ev.jugadorId, { nombre: ev.nombre || 'Desconocido', dorsal: ev.dorsal || '' });
          }
        }
      });

      // Mostrar línea de jugadores en una fila
      const lineaJugadores = document.createElement('div');
      lineaJugadores.className = 'mb-3 d-flex flex-wrap gap-3';

      jugadoresSet.forEach(jug => {
        const spanJug = document.createElement('span');
        spanJug.className = 'badge bg-primary';
        spanJug.textContent = `${jug.nombre} (#${jug.dorsal})`;
        lineaJugadores.appendChild(spanJug);
      });

      pane.appendChild(lineaJugadores);

      // Mostrar eventos del cuarto
      eventosCuarto.forEach(evento => {
        const item = document.createElement('div');
        item.className = 'list-group-item d-flex justify-content-between align-items-center';

        let dorsalDisplay = evento.dorsal !== undefined ? `#${evento.dorsal}` : '';
        if (evento.dorsal < 0) {
          item.classList.add('bg-light', 'text-danger', 'fw-bold');
          dorsalDisplay = '';
        }

        const tiempoRestante = (this.partido.duracionParte || 600) - evento.tiempoSegundos;
        const min = Math.floor(tiempoRestante / 60);
        const seg = tiempoRestante % 60;
        const tiempoStr = `Q${evento.cuarto} ${min.toString().padStart(2, '0')}:${seg.toString().padStart(2, '0')}`;

        const nombre = evento.nombre || 'Desconocido';

        item.innerHTML = `
              <div>
                <span>${nombre} ${dorsalDisplay}</span>
                <div><small>${evento.detalle || ''}</small></div>
              </div>
              <small class="text-muted fw-monospace">${tiempoStr}</small>
            `;

        pane.appendChild(item);
      });

      tabsContent.appendChild(pane);
    });

    // Añadir las pestañas y contenido al contenedor principal
    cont.appendChild(tabsNav);
    cont.appendChild(tabsContent);

    // Inicializar tabs con Bootstrap 5 JS si no está ya inicializado
    if (typeof bootstrap !== 'undefined') {
      const tabTriggerList = [].slice.call(cont.querySelectorAll('button[data-bs-toggle="tab"]'));
      tabTriggerList.forEach(tabTriggerEl => {
        new bootstrap.Tab(tabTriggerEl);
      });
    }
  }



  iniciarRefrescoSiEnCurso() {
    // Limpia refresco previo si existe
    if (this.refrescoInterval) {
      clearInterval(this.refrescoInterval);
      this.refrescoInterval = null;
    }
    //console.log(this.partido.estado)
    if (this.partido && this.partido.estado != 'finalizado') {
      // Refrescar cada 30 segundos recargando datos desde Firebase

      this.refrescoInterval = setInterval(() => {
        this.cargarPartidoGlobal(this.partido.id);
      }, 30000);

    }
  }

  actualizarLucesFaltas() {
    const faltas = this.calcularFaltasCuarto();
    this.renderLuces('foulLightsEquipo', faltas.equipo);
    this.renderLuces('foulLightsRival', faltas.rival);
  }

  calcularFaltasCuarto() {
    let faltasEquipo = 0;
    let faltasRival = 0;
    const cuartoActual = this.parteActual || 1;

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

}
