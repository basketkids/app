class MatchRenderer {
    constructor() {
        this.ordenColumna = 0;
        this.ascendente = true;
    }

    renderEventosEnVivo(containerId, partido, onDeleteEvento = null) {
        const cont = document.getElementById(containerId);
        if (!cont || !partido || !partido.eventos) return;

        cont.innerHTML = '';

        const eventosArray = Object.entries(partido.eventos).map(([key, value]) => ({ ...value, id: key }));

        // Agrupar eventos por cuarto
        const eventosPorCuarto = eventosArray.reduce((acc, evento) => {
            if (!acc[evento.cuarto]) {
                acc[evento.cuarto] = [];
            }
            acc[evento.cuarto].push(evento);
            return acc;
        }, {});

        // Obtener los cuartos ordenados descendentemente
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

            const pane = document.createElement('div');
            pane.className = 'tab-pane fade' + (index === 0 ? ' show active' : '');
            pane.id = paneId;
            pane.role = 'tabpanel';
            pane.ariaLabelledby = tabId;

            // Ordenar eventos por tiempo descendente
            const eventosCuarto = eventosPorCuarto[cuarto].sort((a, b) => b.tiempoSegundos - a.tiempoSegundos);

            // Calcular parcial del cuarto
            let puntosEquipoCuarto = 0;
            let puntosRivalCuarto = 0;
            eventosCuarto.forEach(ev => {
                if (ev.tipo === 'puntos') {
                    if (ev.jugadorId) {
                        puntosEquipoCuarto += (ev.cantidad || 0);
                    } else {
                        puntosRivalCuarto += (ev.cantidad || 0);
                    }
                }
            });

            if (eventosCuarto.length > 0) {
                const marcadorParcial = document.createElement('div');
                marcadorParcial.className = 'alert alert-secondary text-center fw-bold mb-3';
                marcadorParcial.textContent = `Parcial Cuarto ${cuarto}: ${puntosEquipoCuarto} - ${puntosRivalCuarto}`;
                pane.appendChild(marcadorParcial);
            }

            // Jugadores únicos (para la cabecera del cuarto)
            const jugadoresSet = new Map();
            eventosCuarto.forEach(ev => {
                if (ev.dorsal >= 0 && ev.jugadorId) {
                    if (!jugadoresSet.has(ev.jugadorId)) {
                        jugadoresSet.set(ev.jugadorId, { nombre: ev.nombre || 'Desconocido', dorsal: ev.dorsal || '' });
                    }
                }
            });

            const lineaJugadores = document.createElement('div');
            lineaJugadores.className = 'mb-3 d-flex flex-wrap gap-3';
            jugadoresSet.forEach(jug => {
                const spanJug = document.createElement('span');
                spanJug.className = 'badge bg-primary';
                spanJug.textContent = `${jug.nombre} (#${jug.dorsal})`;
                lineaJugadores.appendChild(spanJug);
            });
            pane.appendChild(lineaJugadores);

            eventosCuarto.forEach(evento => {
                const item = document.createElement('div');
                item.className = 'list-group-item d-flex justify-content-between align-items-center';

                let dorsalDisplay = evento.dorsal !== undefined ? `#${evento.dorsal}` : '';
                if (evento.dorsal < 0) {
                    item.classList.add('bg-light', 'text-danger', 'fw-bold');
                    dorsalDisplay = '';
                }

                const tiempoRestante = (partido.duracionParte || 600) - evento.tiempoSegundos;
                const min = Math.floor(tiempoRestante / 60);
                const seg = tiempoRestante % 60;
                const tiempoStr = `Q${evento.cuarto} ${min.toString().padStart(2, '0')}:${seg.toString().padStart(2, '0')}`;

                const nombre = evento.nombre || 'Desconocido';

                let iconHtml = '';
                // Estilo unificado: 60px, fondo blanco, sombra
                const iconStyle = 'width: 60px; height: 60px; object-fit: contain; background: #fff; border-radius: 50%; padding: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);';

                // Ajustar rutas de imágenes según si estamos en public/ o en root
                // Detectar si estamos en carpeta public comprobando la URL o pasando un flag
                // Por defecto asumimos estructura relativa desde donde se carga. 
                // Si estamos en /app/public/partido.html, las imagenes están en ../img/
                // Si estamos en /app/partido.html, las imagenes están en img/
                const isPublic = window.location.pathname.includes('/public/');
                const imgPrefix = isPublic ? '../img/icons/' : 'img/icons/';

                switch (evento.tipo) {
                    case 'puntos':
                        iconHtml = `<img src="${imgPrefix}canasta.png" alt="Puntos" style="${iconStyle}">`;
                        break;
                    case 'asistencias':
                        iconHtml = `<img src="${imgPrefix}asistencia.png" alt="Asistencia" style="${iconStyle}">`;
                        break;
                    case 'rebotes':
                        iconHtml = `<img src="${imgPrefix}rebote.png" alt="Rebote" style="${iconStyle}">`;
                        break;
                    case 'robos':
                        iconHtml = `<img src="${imgPrefix}robo.png" alt="Robo" style="${iconStyle}">`;
                        break;
                    case 'tapones':
                        iconHtml = `<img src="${imgPrefix}tapon.png" alt="Tapón" style="${iconStyle}">`;
                        break;
                    case 'faltas':
                        iconHtml = `<img src="${imgPrefix}falta.png" alt="Falta" style="${iconStyle}">`;
                        break;
                    case 'cambioPista':
                        iconHtml = '<i class="bi bi-arrow-left-right text-secondary" style="font-size: 1.2rem;"></i>';
                        break;
                    case 'fallo':
                        iconHtml = '<i class="bi bi-x-circle text-danger" style="font-size: 1.5rem;"></i>';
                        break;
                    default:
                        iconHtml = '<i class="bi bi-circle text-secondary"></i>';
                }

                const infoDiv = document.createElement('div');
                infoDiv.className = 'd-flex align-items-center gap-2';
                infoDiv.innerHTML = `
          ${iconHtml}
          <div>
            <span>${nombre} ${dorsalDisplay}</span>
            <div><small>${evento.detalle || ''}</small></div>
          </div>
        `;

                const rightDiv = document.createElement('div');
                rightDiv.className = 'd-flex align-items-center gap-2';

                if (evento.marcadorEquipo !== undefined && evento.marcadorRival !== undefined) {
                    const scoreSmall = document.createElement('small');
                    scoreSmall.className = 'text-muted fw-bold me-1';
                    scoreSmall.style.fontSize = '0.8em';
                    scoreSmall.textContent = `[${evento.marcadorEquipo}-${evento.marcadorRival}]`;
                    rightDiv.appendChild(scoreSmall);
                }

                const timeSmall = document.createElement('small');
                timeSmall.className = 'text-muted fw-monospace';
                timeSmall.textContent = tiempoStr;
                rightDiv.appendChild(timeSmall);

                // Botón borrar solo si se pasa la función callback (modo admin)
                if (onDeleteEvento) {
                    const btnBorrar = document.createElement('button');
                    btnBorrar.className = 'btn btn-sm btn-outline-danger ms-2';
                    btnBorrar.innerHTML = '<i class="bi bi-trash"></i>';
                    btnBorrar.title = 'Deshacer evento';
                    btnBorrar.onclick = () => onDeleteEvento(evento.id, evento);
                    rightDiv.appendChild(btnBorrar);
                }

                item.appendChild(infoDiv);
                item.appendChild(rightDiv);
                pane.appendChild(item);
            });

            tabsContent.appendChild(pane);
        });

        cont.appendChild(tabsNav);
        cont.appendChild(tabsContent);

        if (typeof bootstrap !== 'undefined') {
            const tabTriggerList = [].slice.call(cont.querySelectorAll('button[data-bs-toggle="tab"]'));
            tabTriggerList.forEach(tabTriggerEl => {
                new bootstrap.Tab(tabTriggerEl);
            });
        }
    }

    renderEstadisticas(containerId, partido) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';
        if (!partido.convocados) return;

        // Calcular estadísticas dinámicamente desde eventos
        const statsJugadores = this.calcularEstadisticasDesdeEventos(partido);

        const columnas = ['Nombre', 'Puntos', '% T1', '% T2', '% T3', 'Asist.', 'Rebotes', 'Robos', 'Tapones', 'Faltas', '+/-', 'Val.'];
        const campos = ['nombre', 'puntos', 'pct1', 'pct2', 'pct3', 'asistencias', 'rebotes', 'robos', 'tapones', 'faltas', 'masMenos', 'Fantasy'];

        const jugadoresArray = Object.entries(partido.convocados).map(([id, jug]) => {
            return { id, ...jug };
        });

        // Función interna para renderizar
        const renderTabla = () => {
            container.innerHTML = '';
            const table = document.createElement('table');
            table.className = 'table table-striped table-bordered table-sm';

            const thead = document.createElement('thead');
            const trHead = document.createElement('tr');

            columnas.forEach((thText, i) => {
                const th = document.createElement('th');
                th.textContent = thText;
                th.style.cursor = 'pointer';

                // Ocultar columnas en móvil vertical excepto Nombre, Puntos, Faltas, Val.
                const colName = thText;
                if (!['Nombre', 'Puntos', 'Faltas', 'Val.'].includes(colName)) {
                    th.className = 'd-none d-sm-table-cell';
                }

                if (i === this.ordenColumna) {
                    th.textContent += this.ascendente ? ' ↑' : ' ↓';
                }
                th.onclick = () => {
                    if (this.ordenColumna === i) {
                        this.ascendente = !this.ascendente;
                    } else {
                        this.ordenColumna = i;
                        this.ascendente = (i === 0);
                    }
                    this.ordenarYRenderizar(jugadoresArray, campos, renderTabla, partido, statsJugadores);
                };
                trHead.appendChild(th);
            });
            thead.appendChild(trHead);
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            jugadoresArray.forEach(jug => {
                const tr = document.createElement('tr');

                const tdNombre = document.createElement('td');
                tdNombre.style.fontWeight = '600';
                tdNombre.textContent = `${jug.nombre} (#${jug.dorsal})`;
                tr.appendChild(tdNombre);

                const stats = statsJugadores[jug.id] || {};

                // Puntos
                const tdPuntos = document.createElement('td');
                tdPuntos.textContent = stats.puntos || 0;
                tr.appendChild(tdPuntos);

                // Porcentajes
                [1, 2, 3].forEach(val => {
                    const tdPct = document.createElement('td');
                    tdPct.className = 'd-none d-sm-table-cell'; // Ocultar en móvil
                    const convertidos = stats[`t${val}_convertidos`] || 0;
                    const fallados = stats[`t${val}_fallados`] || 0;
                    const total = convertidos + fallados;
                    const pct = total > 0 ? Math.round((convertidos / total) * 100) : 0;
                    tdPct.textContent = total > 0 ? `${pct}% (${convertidos}/${total})` : '-';
                    tr.appendChild(tdPct);
                });

                ['asistencias', 'rebotes', 'robos', 'tapones', 'faltas', 'masMenos'].forEach(stat => {
                    const td = document.createElement('td');
                    // Ocultar todas excepto faltas
                    if (stat !== 'faltas') {
                        td.className = 'd-none d-sm-table-cell';
                    }
                    let val = stats[stat] || 0;
                    if (stat === 'masMenos' && val > 0) val = `+${val}`;
                    td.textContent = val;
                    tr.appendChild(td);
                });

                const tdFantasy = document.createElement('td');
                tdFantasy.style.fontWeight = '600';
                tdFantasy.textContent = this.calcularPuntosFantasy(stats);
                tr.appendChild(tdFantasy);

                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            container.appendChild(table);
        };

        // Inicializar
        this.ordenarYRenderizar(jugadoresArray, campos, renderTabla, partido, statsJugadores);
    }

    ordenarYRenderizar(jugadoresArray, campos, renderCallback, partido, statsJugadores) {
        const campo = campos[this.ordenColumna];
        jugadoresArray.sort((a, b) => {
            let valA, valB;

            if (campo === 'nombre') {
                valA = a.nombre.toLowerCase();
                valB = b.nombre.toLowerCase();
            } else if (campo === 'Fantasy') {
                valA = this.calcularPuntosFantasy(statsJugadores[a.id]);
                valB = this.calcularPuntosFantasy(statsJugadores[b.id]);
            } else {
                const statsA = statsJugadores[a.id] || {};
                const statsB = statsJugadores[b.id] || {};
                valA = statsA[campo] || 0;
                valB = statsB[campo] || 0;
            }

            if (valA < valB) return this.ascendente ? -1 : 1;
            if (valA > valB) return this.ascendente ? 1 : -1;
            return 0;
        });
        renderCallback();
    }

    calcularEstadisticasDesdeEventos(partido) {
        const stats = {};

        // Inicializar stats para todos los convocados
        if (partido.convocados) {
            Object.keys(partido.convocados).forEach(id => {
                stats[id] = {
                    puntos: 0, asistencias: 0, rebotes: 0, robos: 0, tapones: 0, faltas: 0, masMenos: 0,
                    t1_convertidos: 0, t1_fallados: 0,
                    t2_convertidos: 0, t2_fallados: 0,
                    t3_convertidos: 0, t3_fallados: 0
                };
            });
        }

        if (!partido.eventos) return stats;

        Object.values(partido.eventos).forEach(ev => {
            const pid = ev.jugadorId;
            if (!pid || !stats[pid]) return; // Si es evento de equipo o jugador no convocado (raro)

            if (ev.tipo === 'puntos') {
                stats[pid].puntos += (ev.cantidad || 0);
                const val = ev.cantidad || 0;
                if (val >= 1 && val <= 3) {
                    stats[pid][`t${val}_convertidos`] = (stats[pid][`t${val}_convertidos`] || 0) + 1;
                }
            } else if (ev.tipo === 'fallo') {
                const val = ev.valor || 0;
                if (val >= 1 && val <= 3) {
                    stats[pid][`t${val}_fallados`] = (stats[pid][`t${val}_fallados`] || 0) + 1;
                }
            } else if (['asistencias', 'rebotes', 'robos', 'tapones', 'faltas'].includes(ev.tipo)) {
                stats[pid][ev.tipo] = (stats[pid][ev.tipo] || 0) + (ev.cantidad || 1);
            }

            // Calcular +/- (simplificado, asumiendo que el evento tiene info de marcador o se recalcula)
            // NOTA: El +/- es complejo de recalcular solo con eventos si no guardamos quién estaba en pista en cada evento.
            // Por ahora, usaremos el +/- acumulado en el evento si existe, o lo dejaremos como estaba en estadisticasJugadores si queremos persistirlo.
            // Pero el usuario pidió recalcular porcentajes. El +/- lo mantendremos del objeto original si es posible, o lo recalculamos si tenemos info.
            // Dado que el +/- depende de los jugadores en pista en CADA evento, y eso se guarda en el evento (jugadoresEnPista), podemos recalcularlo.

            if (ev.tipo === 'puntos') {
                const puntos = ev.cantidad || 0;
                // Sumar puntos a los de mi equipo en pista
                if (ev.jugadoresEnPista) {
                    ev.jugadoresEnPista.forEach(pistaId => {
                        if (stats[pistaId]) {
                            stats[pistaId].masMenos += puntos;
                        }
                    });
                }
            }
            // Falta restar puntos del rival. Pero los eventos de puntos del rival no tienen jugadoresEnPista del equipo usuario normalmente,
            // a menos que lo hayamos guardado.
            // En PartidoApp.js: agregarEstadistica para rival NO guarda jugadoresEnPista del equipo usuario actualmente en la lógica antigua,
            // pero en la nueva lógica (ver PartidoApp.js) sí parece que `jugadoresEnPista` se añade al evento siempre.
            // Vamos a asumir que si el evento es de puntos rival, resta.

            // Espera, los eventos de puntos rival tienen jugadorId vacío o null.
            // Si es punto rival:
            if (ev.tipo === 'puntos' && !ev.jugadorId) { // Punto rival
                const puntos = ev.cantidad || 0;
                if (ev.jugadoresEnPista) {
                    ev.jugadoresEnPista.forEach(pistaId => {
                        if (stats[pistaId]) {
                            stats[pistaId].masMenos -= puntos;
                        }
                    });
                }
            }
        });

        // SOBREESCRIBIR el +/- calculado con el valor de la base de datos si existe
        // Esto es para cumplir con el requerimiento de que el +/- venga de 'estadisticasJugadores'
        if (partido.estadisticasJugadores) {
            Object.keys(stats).forEach(id => {
                if (partido.estadisticasJugadores[id] && partido.estadisticasJugadores[id].masMenos !== undefined) {
                    stats[id].masMenos = partido.estadisticasJugadores[id].masMenos;
                }
            });
        }

        return stats;
    }

    calcularPuntosFantasy(stats) {
        if (!stats) return 0;
        const puntos =
            (stats.puntos || 0) * 1 +
            (stats.rebotes || 0) * 1 +
            (stats.asistencias || 0) * 2 +
            (stats.tapones || 0) * 3 +
            (stats.robos || 0) * 3 +
            (stats.faltas || 0) * -1;
        return puntos;
    }
}
