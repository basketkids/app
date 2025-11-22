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
                console.log(this.partido.id);


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
        if (ne) ne.textContent = this.partido.nombreEquipo ;

        const nr = document.getElementById('nombreEquipoRival');
        if (nr) nr.textContent =  this.partido.nombreRival;

        const estado = document.getElementById('divEstado');
        if (estado) estado.textContent =  this.partido.estado;
        // Renderizar marcador equipo
        const marcadorEquipo = document.getElementById('marcadorEquipo');
        if (marcadorEquipo) marcadorEquipo.textContent = this.partido.puntosEquipo || 0;

        // Renderizar marcador rival
        const marcadorRival = document.getElementById('marcadorRival');
        if (marcadorRival) marcadorRival.textContent = this.partido.puntosRival || 0;

        // Renderizar faltas equipo
        const faltasEquipo = document.getElementById('faltasEquipo');
        if (faltasEquipo) faltasEquipo.textContent = `F: ${this.partido.faltasEquipo || 0}`;

        // Renderizar faltas rival
        const faltasRival = document.getElementById('faltasRival');
        if (faltasRival) faltasRival.textContent = `F: ${this.partido.faltasRival || 0}`;
        this.actualizarDisplay();
        // Renderizar jugadores convocados
        const containerConvocados = document.getElementById('tablaEstadisticasContainer');
        if (containerConvocados) {
            containerConvocados.innerHTML = '';
            if (this.partido.convocados) {
                const table = document.createElement('table');
                table.className = 'table table-striped table-bordered table-sm';
                const thead = document.createElement('thead');
                const trHead = document.createElement('tr');
                ['Nombre', 'Puntos', 'Asist.', 'Rebotes', 'Robos', 'Tapones', 'Faltas'].forEach(thText => {
                    const th = document.createElement('th');
                    th.textContent = thText;
                    trHead.appendChild(th);
                });
                thead.appendChild(trHead);
                table.appendChild(thead);

                const tbody = document.createElement('tbody');
                Object.entries(this.partido.convocados).forEach(([id, jug]) => {
                    const tr = document.createElement('tr');

                    // Nombre + dorsal
                    const tdNombre = document.createElement('td');
                    tdNombre.style.fontWeight = '600';
                    tdNombre.textContent = `${jug.nombre} (#${jug.dorsal})`;
                    tr.appendChild(tdNombre);

                    // Estadísticas
                    const stats = (this.partido.estadisticasJugadores && this.partido.estadisticasJugadores[id]) || {};
                    ['puntos', 'asistencias', 'rebotes', 'robos', 'tapones', 'faltas'].forEach(stat => {
                        const td = document.createElement('td');
                        td.textContent = stats[stat] || 0;
                        tr.appendChild(td);
                    });

                    tbody.appendChild(tr);
                });
                table.appendChild(tbody);
                containerConvocados.appendChild(table);
            }
        }

        // Opcional: Renderizar lista básica de eventos en vivo
        this.renderEventosEnVivo();
    }

    actualizarDisplay() {
        const numCuartoElem = document.getElementById('numCuarto');
        if (numCuartoElem) numCuartoElem.textContent = this.parteActual || 1;

        const elem = document.getElementById('contador');
        if (elem) {
            const min = Math.floor(this.segundosRestantes / 60);
            const seg = this.segundosRestantes % 60;
            elem.textContent = `${min.toString().padStart(2, '0')}:${seg.toString().padStart(2, '0')}`;
        }
    }
    renderEventosEnVivo() {
        const cont = document.getElementById('listaEventosEnVivo');
        if (!cont || !this.partido || !this.partido.eventos) return;

        cont.innerHTML = '';

        const eventosArray = Object.values(this.partido.eventos);
        eventosArray.sort((a, b) => {
            if (a.cuarto === b.cuarto) return b.tiempoSegundos - a.tiempoSegundos;
            return b.cuarto - a.cuarto;
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

            if (evento.dorsal < 0) {
                item.classList.add('bg-light', 'text-danger', 'fw-bold');
            }

            const tiempoRestante = (this.partido.duracionParte || 600) - evento.tiempoSegundos;
            const min = Math.floor(tiempoRestante / 60);
            const seg = tiempoRestante % 60;
            const tiempoStr = `${min.toString().padStart(2, '0')}:${seg.toString().padStart(2, '0')}`;

            const nombre = evento.nombre || 'Desconocido';
            const dorsal = evento.dorsal !== undefined ? `#${evento.dorsal}` : '';

            item.innerHTML = `
          <div>
            <span>${nombre} ${dorsal}</span>
            <div><small>${evento.detalle || ''}</small></div>
          </div>
          <small class="text-muted fw-monospace">${tiempoStr}</small>
        `;

            cont.appendChild(item);
        });
    }


    iniciarRefrescoSiEnCurso() {
        // Limpia refresco previo si existe
        if (this.refrescoInterval) {
            clearInterval(this.refrescoInterval);
            this.refrescoInterval = null;
        }
        console.log(this.partido.estado)
        if (this.partido && this.partido.estado != 'finalizado') {
            // Refrescar cada 30 segundos recargando datos desde Firebase

            this.refrescoInterval = setInterval(() => {
                    this.cargarPartidoGlobal(this.partido.id);
            }, 30000);

        }
    }

}
