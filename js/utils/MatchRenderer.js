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
                    puntos_favor_pista: 0, puntos_contra_pista: 0, // New stats
                    t1_convertidos: 0, t1_fallados: 0,
                    t2_convertidos: 0, t2_fallados: 0,
                    t3_convertidos: 0, t3_fallados: 0
                };
            });
        }

        if (!partido.eventos) return stats;

        Object.values(partido.eventos).forEach(ev => {
            const pid = ev.jugadorId;
            // pid might be null for rival points, so check inside specific blocks or use optional chaining

            if (ev.tipo === 'puntos') {
                if (pid && stats[pid]) {
                    stats[pid].puntos += (ev.cantidad || 0);
                    const val = ev.cantidad || 0;
                    if (val >= 1 && val <= 3) {
                        stats[pid][`t${val}_convertidos`] = (stats[pid][`t${val}_convertidos`] || 0) + 1;
                    }
                }

                // Puntos a favor con jugador en pista
                const puntos = ev.cantidad || 0;
                if (ev.jugadoresEnPista) {
                    ev.jugadoresEnPista.forEach(pistaId => {
                        if (stats[pistaId]) {
                            stats[pistaId].masMenos += puntos;
                            stats[pistaId].puntos_favor_pista += puntos;
                        }
                    });
                }

            } else if (ev.tipo === 'fallo') {
                if (pid && stats[pid]) {
                    const val = ev.valor || 0;
                    if (val >= 1 && val <= 3) {
                        stats[pid][`t${val}_fallados`] = (stats[pid][`t${val}_fallados`] || 0) + 1;
                    }
                }
            } else if (['asistencias', 'rebotes', 'robos', 'tapones', 'faltas'].includes(ev.tipo)) {
                if (pid && stats[pid]) {
                    stats[pid][ev.tipo] = (stats[pid][ev.tipo] || 0) + (ev.cantidad || 1);
                }
            }

            // Puntos en contra (rival)
            if (ev.tipo === 'puntos' && !ev.jugadorId) { // Punto rival
                const puntos = ev.cantidad || 0;
                if (ev.jugadoresEnPista) {
                    ev.jugadoresEnPista.forEach(pistaId => {
                        if (stats[pistaId]) {
                            stats[pistaId].masMenos -= puntos;
                            stats[pistaId].puntos_contra_pista += puntos;
                        }
                    });
                }
            }
        });

        // SOBREESCRIBIR el +/- calculado con el valor de la base de datos si existe
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

    renderQuintetos(containerId, partido, tipo = 'ataque') {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';
        if (!partido.convocados) {
            container.innerHTML = '<div class="alert alert-warning">No hay datos de jugadores.</div>';
            return;
        }

        const statsJugadores = this.calcularEstadisticasDesdeEventos(partido);

        // Convert to array with player info
        const jugadoresArray = Object.entries(partido.convocados).map(([id, jug]) => {
            return {
                id,
                nombre: jug.nombre,
                dorsal: jug.dorsal,
                stats: statsJugadores[id] || {}
            };
        });

        const top5 = this.calculateTop5(jugadoresArray, tipo);
        const courtHtml = this.renderCourt(top5, tipo);
        container.innerHTML = courtHtml;
    }

    calculateTop5(jugadores, tipo) {
        return jugadores.sort((a, b) => {
            let valA = 0, valB = 0;
            if (tipo === 'ataque') {
                // Puntos * 1 + Asistencias * 2 + PuntosFavorPista * 0.5
                valA = (a.stats.puntos || 0) * 1 + (a.stats.asistencias || 0) * 2 + (a.stats.puntos_favor_pista || 0) * 0.5;
                valB = (b.stats.puntos || 0) * 1 + (b.stats.asistencias || 0) * 2 + (b.stats.puntos_favor_pista || 0) * 0.5;
            } else {
                // Defensa: (Rebotes * 1 + Robos * 3 + Tapones * 3) - (PuntosContraPista * 0.5)
                // Note: Subtracting points against because fewer is better, but we want higher score for sorting.
                // Wait, if points against is bad, we subtract it. So high points against reduces the score. Correct.
                valA = ((a.stats.rebotes || 0) * 1 + (a.stats.robos || 0) * 3 + (a.stats.tapones || 0) * 3) - ((a.stats.puntos_contra_pista || 0) * 0.5);
                valB = ((b.stats.rebotes || 0) * 1 + (b.stats.robos || 0) * 3 + (b.stats.tapones || 0) * 3) - ((b.stats.puntos_contra_pista || 0) * 0.5);
            }
            return valB - valA; // Descending
        }).slice(0, 5);
    }

    renderCourt(players, tipo) {
        let playersHtml = '';

        players.forEach((player, index) => {
            // If fewer than 5 players, just fill available slots
            const posClass = `pos-${index + 1}`;
            let statValue = '';
            let val = 0;

            if (tipo === 'ataque') {
                val = (player.stats.puntos || 0) * 1 + (player.stats.asistencias || 0) * 2 + (player.stats.puntos_favor_pista || 0) * 0.5;
            } else {
                val = ((player.stats.rebotes || 0) * 1 + (player.stats.robos || 0) * 3 + (player.stats.tapones || 0) * 3) - ((player.stats.puntos_contra_pista || 0) * 0.5);
            }
            // Round to 1 decimal place if needed, or integer
            val = Math.round(val * 10) / 10;
            statValue = `${val} val`;

            // Jersey color based on type (Red for Attack, Blue for Defense to match buttons)
            const jerseyColor = tipo === 'ataque' ? '#dc3545' : '#0d6efd';

            playersHtml += `
                <div class="player-jersey ${posClass}">
                    <div class="jersey-svg">
                        ${this.getJerseySVG(jerseyColor, player.dorsal)}
                    </div>
                    <div class="player-info">
                        <div>${player.nombre}</div>
                        <div class="player-stat">${statValue}</div>
                    </div>
                </div>
            `;
        });

        return `
            <div class="basketball-court">
                ${playersHtml}
            </div>
        `;
    }

    getJerseySVG(color, number) {
        return `
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <path d="M20,20 L30,20 L35,35 L65,35 L70,20 L80,20 L90,40 L80,80 L20,80 L10,40 Z" fill="${color}" stroke="#fff" stroke-width="2"/>
                <text x="50" y="60" font-family="Arial" font-size="30" fill="white" text-anchor="middle" font-weight="bold">${number}</text>
            </svg>
        `;
    }
}
