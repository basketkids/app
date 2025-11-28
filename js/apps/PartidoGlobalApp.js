class PartidosGlobalesApp {
  constructor(dataService) {
    this.dataService = dataService;
    this.partido = null;
    this.refrescoInterval = null;
    this.segundosRestantes = 0; // Para controlar display tiempo
    this.parteActual = 1;       // Para controlar el cuarto actual
    this.matchRenderer = new MatchRenderer();
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

    // Update Other Matches Button
    const otherMatchesBtn = document.getElementById('otherMatchesBtn');
    if (otherMatchesBtn && this.partido.equipoId) {
      otherMatchesBtn.href = `index.html?teamId=${this.partido.equipoId}`;
      otherMatchesBtn.style.display = 'inline-flex';
    }
    this.renderInfoPartido();
    this.renderQuintetos();
  }

  renderInfoPartido() {
    const container = document.getElementById('infoPartido');
    if (!container) return;

    let html = '';

    // Fecha y Hora
    if (this.partido.fechaHora) {
      const fechaObj = new Date(this.partido.fechaHora);
      const fechaStr = fechaObj.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
      const horaStr = fechaObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      html += `<div class="mb-1 fw-bold"><i class="bi bi-calendar-event"></i> ${fechaStr} - ${horaStr}</div>`;
    }

    // Ubicación
    if (this.partido.pabellon) {
      html += `
        <div>
          <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(this.partido.pabellon)}" 
             target="_blank" class="text-decoration-none text-muted">
            <i class="bi bi-geo-alt-fill"></i> ${this.partido.pabellon}
          </a>
        </div>
      `;
    }

    container.innerHTML = html;
  }

  renderizarEstadisticas() {
    this.matchRenderer.renderEstadisticas('tablaEstadisticasContainer', this.partido);
  }

  renderQuintetos() {
    // Default to 'ataque' if not set
    if (!this.vistaQuinteto) this.vistaQuinteto = 'ataque';
    this.matchRenderer.renderQuintetos('quintetosContainer', this.partido, this.vistaQuinteto);
  }

  cambiarVistaQuinteto(tipo) {
    this.vistaQuinteto = tipo;

    // Update buttons
    const btnAtaque = document.getElementById('btnQuintetoAtaque');
    const btnDefensa = document.getElementById('btnQuintetoDefensa');

    if (tipo === 'ataque') {
      btnAtaque.classList.add('active');
      btnDefensa.classList.remove('active');
    } else {
      btnAtaque.classList.remove('active');
      btnDefensa.classList.add('active');
    }

    this.renderQuintetos();
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
    this.matchRenderer.renderEventosEnVivo('listaEventosEnVivo', this.partido);
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
