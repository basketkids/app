class MatchRenderer {
    constructor() {
        this.ordenColumna = 0;
        this.ascendente = true;
        if (typeof DiceBearManager !== 'undefined') {
            this.diceBearManager = new DiceBearManager();
        }
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

        // Determine columns based on sport
        const sport = partido.sport || 'basketball';
        const config = (typeof SportConfig !== 'undefined' && SportConfig[sport]) ? SportConfig[sport] : SportConfig['basketball'];

        let columnas = [];
        let campos = [];

        if (sport === 'basketball') {
            columnas = ['Nombre', 'Puntos', '% T1', '% T2', '% T3', 'Asist.', 'Rebotes', 'Robos', 'Tapones', 'Faltas', '+/-', 'Val.'];
            campos = ['nombre', 'puntos', 'pct1', 'pct2', 'pct3', 'asistencias', 'rebotes', 'robos', 'tapones', 'faltas', 'masMenos', 'valoracion'];
        } else {
            // Generic generation from config
            columnas = ['Nombre'];
            campos = ['nombre'];
            if (config.stats) {
                Object.entries(config.stats).forEach(([key, info]) => {
                    columnas.push(info.label);
                    campos.push(key);
                });
            }
            // Add standard calculated fields if needed for other sports? 
            // For now just raw stats + custom calc if any
        }

        // ... (rest of the setup)

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

                // Responsive logic: hide less important cols on mobile
                // Simple heuristic: Keep first 2 and last 1? Or use config priorities
                // For Volley: Name, ACE, BLK, ATK, ERR... maybe show all or hide Errors?
                const colName = thText;
                if (sport === 'basketball') {
                    if (!['Nombre', 'Puntos', 'Faltas', 'Val.'].includes(colName)) {
                        th.className = 'd-none d-sm-table-cell';
                    }
                } else {
                    // For now show all or basic hiding logic
                    if (i > 3) th.className = 'd-none d-md-table-cell';
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

                if (sport === 'basketball') {
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

                    const tdVal = document.createElement('td');
                    tdVal.style.fontWeight = '600';
                    tdVal.textContent = this.calcularValoracion(stats);
                    tr.appendChild(tdVal);
                } else {
                    // Generic Rendering for other sports
                    campos.slice(1).forEach((campo, idx) => {
                        const td = document.createElement('td');
                        // Match visibility to header
                        if ((idx + 1) > 3) td.className = 'd-none d-md-table-cell';

                        td.textContent = stats[campo] || 0;
                        tr.appendChild(td);
                    });
                }

                tbody.appendChild(tr);
            });
            table.appendChild(tbody);

            // --- Totals Row --- (Adapted for generic)
            const tfoot = document.createElement('tfoot');
            const trTotal = document.createElement('tr');
            trTotal.className = 'table-secondary fw-bold';

            const tdName = document.createElement('td');
            tdName.textContent = 'TOTAL';
            trTotal.appendChild(tdName);

            // Calculate totals Generic
            if (sport !== 'basketball') {
                campos.slice(1).forEach((campo, idx) => {
                    let sum = 0;
                    jugadoresArray.forEach(jug => {
                        const s = statsJugadores[jug.id] || {};
                        sum += (s[campo] || 0);
                    });

                    const td = document.createElement('td');
                    if ((idx + 1) > 3) td.className = 'd-none d-md-table-cell';
                    td.textContent = sum;
                    trTotal.appendChild(td);
                });
                tfoot.appendChild(trTotal);
                table.appendChild(tfoot);
            } else {
                // Keep existing complex logic for basketball totals (calc pct etc)
                // ... (Reusing existing logic logic would be better but for brevity/safety I will just copy the existing basketball calc logic here or let it be handled if I didn't replace it? 
                // Wait, I am replacing the whole function. I must re-implement the basketball totals part.)

                const totals = {
                    puntos: 0, asistencias: 0, rebotes: 0, robos: 0, tapones: 0, faltas: 0, masMenos: 0, valoracion: 0,
                    t1_conv: 0, t1_fail: 0, t2_conv: 0, t2_fail: 0, t3_conv: 0, t3_fail: 0
                };
                jugadoresArray.forEach(jug => {
                    const s = statsJugadores[jug.id] || {};
                    totals.puntos += s.puntos || 0;
                    totals.asistencias += s.asistencias || 0;
                    totals.rebotes += s.rebotes || 0;
                    totals.robos += s.robos || 0;
                    totals.tapones += s.tapones || 0;
                    totals.faltas += s.faltas || 0;
                    totals.valoracion += this.calcularValoracion(s);
                    totals.t1_conv += s.t1_convertidos || 0;
                    totals.t1_fail += s.t1_fallados || 0;
                    totals.t2_conv += s.t2_convertidos || 0;
                    totals.t2_fail += s.t2_fallados || 0;
                    totals.t3_conv += s.t3_convertidos || 0;
                    totals.t3_fail += s.t3_fallados || 0;
                });

                const createTotalCell = (text, isMobileVisible = false) => {
                    const td = document.createElement('td');
                    td.textContent = text;
                    if (!isMobileVisible) td.className = 'd-none d-sm-table-cell';
                    trTotal.appendChild(td);
                };

                createTotalCell(totals.puntos, true);

                const t1Total = totals.t1_conv + totals.t1_fail;
                createTotalCell(t1Total > 0 ? `${Math.round((totals.t1_conv / t1Total) * 100)}% (${totals.t1_conv}/${t1Total})` : '-');
                const t2Total = totals.t2_conv + totals.t2_fail;
                createTotalCell(t2Total > 0 ? `${Math.round((totals.t2_conv / t2Total) * 100)}% (${totals.t2_conv}/${t2Total})` : '-');
                const t3Total = totals.t3_conv + totals.t3_fail;
                createTotalCell(t3Total > 0 ? `${Math.round((totals.t3_conv / t3Total) * 100)}% (${totals.t3_conv}/${t3Total})` : '-');

                createTotalCell(totals.asistencias);
                createTotalCell(totals.rebotes);
                createTotalCell(totals.robos);
                createTotalCell(totals.tapones);
                createTotalCell(totals.faltas, true);

                const teamMasMenos = (partido.puntosEquipo || 0) - (partido.puntosRival || 0);
                createTotalCell(teamMasMenos > 0 ? `+${teamMasMenos}` : teamMasMenos);

                createTotalCell(totals.valoracion, true);
                tfoot.appendChild(trTotal);
                table.appendChild(tfoot);
            }

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
            } else if (campo === 'valoracion') {
                valA = this.calcularValoracion(statsJugadores[a.id]);
                valB = this.calcularValoracion(statsJugadores[b.id]);
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
        const hasEvents = partido.eventos && Object.keys(partido.eventos).length > 0;
        const sport = partido.sport || 'basketball';
        const config = (typeof SportConfig !== 'undefined' && SportConfig[sport]) ? SportConfig[sport] : null;

        // Inicializar stats para todos los convocados
        if (partido.convocados) {
            Object.keys(partido.convocados).forEach(id => {
                // Initialize default stats structure relative to sport or all
                stats[id] = {
                    puntos: 0, asistencias: 0, rebotes: 0, robos: 0, tapones: 0, faltas: 0, masMenos: 0,
                    puntos_favor_pista: 0, puntos_contra_pista: 0,
                    t1_convertidos: 0, t1_fallados: 0,
                    t2_convertidos: 0, t2_fallados: 0,
                    t3_convertidos: 0, t3_failados: 0
                };

                // Initialize generic stats from config if available
                if (config && config.stats) {
                    Object.keys(config.stats).forEach(key => {
                        stats[id][key] = 0;
                    });
                }

                // Cargar estadísticas guardadas si existen (PRIORIDAD)
                if (partido.estadisticasJugadores && partido.estadisticasJugadores[id]) {
                    const saved = partido.estadisticasJugadores[id];
                    // Copiar propiedades guardadas
                    Object.keys(saved).forEach(key => {
                        stats[id][key] = saved[key];
                    });
                    stats[id]._loadedFromStorage = true;
                }
            });
        }

        if (!hasEvents) return stats;

        Object.values(partido.eventos).forEach(ev => {
            const pid = ev.jugadorId;

            // Si NO se cargaron datos del almacenamiento para este jugador, calculamos desde eventos
            const shouldUseEventForStats = (pid && stats[pid] && !stats[pid]._loadedFromStorage);

            if (ev.tipo === 'puntos') {
                if (shouldUseEventForStats) {
                    stats[pid].puntos += (ev.cantidad || 0);
                    const val = ev.cantidad || 0;
                    if (val >= 1 && val <= 3) {
                        stats[pid][`t${val}_convertidos`] = (stats[pid][`t${val}_convertidos`] || 0) + 1;
                    }
                }
                // ... (Existing Plus/Minus logic remains same for all sports roughly) ...
                // Puntos a favor con jugador en pista (SIEMPRE calcular, no se guarda)
                const puntos = ev.cantidad || 0;
                if (ev.jugadoresEnPista) {
                    ev.jugadoresEnPista.forEach(pistaId => {
                        if (stats[pistaId]) {
                            stats[pistaId].puntos_favor_pista += puntos;

                            if (!stats[pistaId]._loadedFromStorage) {
                                stats[pistaId].masMenos += puntos;
                            }
                        }
                    });
                }

            } else if (ev.tipo === 'fallo') {
                if (shouldUseEventForStats) {
                    const val = ev.valor || 0;
                    if (val >= 1 && val <= 3) {
                        stats[pid][`t${val}_fallados`] = (stats[pid][`t${val}_fallados`] || 0) + 1;
                    }
                }
            } else {
                // Generic handler: if type exists in stats, increment
                // Also support Basket hardcoded types for backward compat if not in generic config
                if (shouldUseEventForStats) {
                    if (['asistencias', 'rebotes', 'robos', 'tapones', 'faltas'].includes(ev.tipo)) {
                        stats[pid][ev.tipo] = (stats[pid][ev.tipo] || 0) + (ev.cantidad || 1);
                    } else {
                        // Check valid stats from config (e.g. 'ace', 'ataque')
                        if (config && config.stats && config.stats[ev.tipo]) {
                            // Increment generic stat
                            stats[pid][ev.tipo] = (stats[pid][ev.tipo] || 0) + (ev.cantidad || 1);
                        }
                    }
                }
            }

            // Puntos en contra (rival)
            // Fix: Check dorsal === -1 for Rival, otherwise it might be generic team point
            if (ev.tipo === 'puntos' && ev.dorsal === -1) { // Punto rival
                const puntos = ev.cantidad || 0;
                if (ev.jugadoresEnPista) {
                    ev.jugadoresEnPista.forEach(pistaId => {
                        if (stats[pistaId]) {
                            stats[pistaId].puntos_contra_pista += puntos;

                            if (!stats[pistaId]._loadedFromStorage) {
                                stats[pistaId].masMenos -= puntos;
                            }
                        }
                    });
                }
            }
        });

        // Asegurar que masMenos coincida con lo guardado
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
        // Basic impl for basketball
        // For Volley? Maybe simpler
        const puntos =
            (stats.puntos || 0) * 1 +
            (stats.rebotes || 0) * 1 +
            (stats.asistencias || 0) * 2 +
            (stats.tapones || 0) * 3 +
            (stats.robos || 0) * 3;

        // Add volley stats?
        // ACE=3, BLK=3, ATK=2 ??
        if (stats.ace) return (stats.ace * 3) + (stats.bloqueo * 3) + (stats.ataque * 2);

        return puntos;
    }

    calcularValoracion(stats) {
        if (!stats) return 0;

        // Basket Logic
        const puntosFallados =
            (stats.t1_fallados || 0) * 1 +
            (stats.t2_fallados || 0) * 2 +
            (stats.t3_fallados || 0) * 3;

        const valBasket = (stats.puntos || 0) -
            puntosFallados +
            (stats.tapones || 0) +
            (stats.rebotes || 0) +
            (stats.asistencias || 0) +
            (stats.robos || 0) -
            (stats.faltas || 0);

        // Volley Logic (Simpler "Total")?
        if (stats.ace !== undefined) {
            // VAL = (Possible positives) - (Negatives)
            // Positives: ACE, BLK, ATK, REC (maybe 1?)
            // Negatives: Errors
            let val = 0;
            // Iterate known keys or hardcode?
            // Using config-like approach would be best but I don't have config here easily without passing it
            // Heuristic check
            val += (stats.ace || 0);
            val += (stats.bloqueo || 0);
            val += (stats.ataque || 0);
            val -= (stats.error_saque || 0);
            val -= (stats.error_ataque || 0);
            return val;
        }

        return valBasket;
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

    renderFantasy(containerId, partido, jerseyColor = '5199e4', plantillaJugadores = []) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';
        if (!partido.convocados) {
            container.innerHTML = '<div class="alert alert-warning">No hay datos de jugadores.</div>';
            return;
        }

        const statsJugadores = this.calcularEstadisticasDesdeEventos(partido);

        // Convert to array with player info and fantasy points
        const jugadoresArray = Object.entries(partido.convocados).map(([id, jug]) => {
            const stats = statsJugadores[id] || {};

            // Try to find avatarConfig in convocados, otherwise look in plantillaJugadores
            let avatarConfig = jug.avatarConfig;
            if (!avatarConfig && plantillaJugadores) {
                const playerInRoster = plantillaJugadores.find(p => p.id === id);
                if (playerInRoster) {
                    avatarConfig = playerInRoster.avatarConfig;
                }
            }

            return {
                id,
                ...jug,
                avatarConfig, // Ensure this is passed
                stats,
                fantasyPoints: this.calcularPuntosFantasy(stats)
            };
        });

        // Sort by Fantasy Points Descending
        jugadoresArray.sort((a, b) => b.fantasyPoints - a.fantasyPoints);

        const top5 = jugadoresArray.slice(0, 5);
        const rest = jugadoresArray.slice(5);

        // Render Top 5 Court
        const courtHtml = this.renderCourt(top5, 'fantasy', jerseyColor);

        const courtContainer = document.createElement('div');
        courtContainer.innerHTML = courtHtml;
        container.appendChild(courtContainer);

        // Render Rest List
        if (rest.length > 0) {
            const listContainer = document.createElement('div');
            listContainer.className = 'mt-4';
            const title = document.createElement('h5');
            title.textContent = 'Resto del equipo';
            title.className = 'mb-3';
            listContainer.appendChild(title);

            const ul = document.createElement('ul');
            ul.className = 'list-group';

            rest.forEach(jug => {
                const li = document.createElement('li');
                li.className = 'list-group-item d-flex justify-content-between align-items-center';

                const leftDiv = document.createElement('div');
                leftDiv.className = 'd-flex align-items-center gap-3';

                const avatarImg = document.createElement('img');
                avatarImg.className = 'rounded-circle';
                avatarImg.style.width = '70px';
                avatarImg.style.height = '70px';
                avatarImg.src = this.diceBearManager.getImage(jug.id, jug.avatarConfig, jerseyColor);
                avatarImg.alt = 'Avatar';

                const nameDiv = document.createElement('div');
                nameDiv.innerHTML = `<strong>${jug.nombre}</strong> <small class="text-muted">#${jug.dorsal}</small>`;

                leftDiv.appendChild(avatarImg);
                leftDiv.appendChild(nameDiv);

                const pointsBadge = document.createElement('span');
                pointsBadge.className = 'badge bg-primary rounded-pill';
                pointsBadge.style.fontSize = '1rem';
                pointsBadge.textContent = `${jug.fantasyPoints} pts`;

                li.appendChild(leftDiv);
                li.appendChild(pointsBadge);
                ul.appendChild(li);
            });

            listContainer.appendChild(ul);
            container.appendChild(listContainer);
        }
    }

    calculateTop5(jugadores, tipo) {
        return jugadores.sort((a, b) => {
            let valA = 0, valB = 0;
            if (tipo === 'ataque') {
                // Puntos * 1 + Asistencias * 1 + PuntosFavorPista * 0.5
                valA = (a.stats.puntos || 0) * 1 + (a.stats.asistencias || 0) * 1 + (a.stats.puntos_favor_pista || 0) * 0.10;
                valB = (b.stats.puntos || 0) * 1 + (b.stats.asistencias || 0) * 1 + (b.stats.puntos_favor_pista || 0) * 0.10;
            } else {
                // Defensa: (Rebotes * 1 + Robos * 1 + Tapones * 1) - (PuntosContraPista * 0.5)
                valA = ((a.stats.rebotes || 0) * 1 + (a.stats.robos || 0) * 1 + (a.stats.tapones || 0) * 1) - ((a.stats.puntos_contra_pista || 0) * 0.10);
                valB = ((b.stats.rebotes || 0) * 1 + (b.stats.robos || 0) * 1 + (b.stats.tapones || 0) * 1) - ((b.stats.puntos_contra_pista || 0) * 0.10);
            }
            return valB - valA; // Descending
        }).slice(0, 5);
    }

    renderCourt(players, tipo, jerseyColor = null) {
        let playersHtml = '';

        players.forEach((player, index) => {
            // If fewer than 5 players, just fill available slots
            const posClass = `pos-${index + 1}`;
            let statValue = '';
            let val = 0;

            if (tipo === 'ataque') {
                val = (player.stats.puntos || 0) * 1 + (player.stats.asistencias || 0) * 1 + (player.stats.puntos_favor_pista || 0) * 0.10;
                val = Math.round(val * 10) / 10;
                statValue = `${val}`;
            } else if (tipo === 'fantasy') {
                val = player.fantasyPoints;
                statValue = `${val} pts`;
            } else {
                val = ((player.stats.rebotes || 0) * 1 + (player.stats.robos || 0) * 1 + (player.stats.tapones || 0) * 1) - ((player.stats.puntos_contra_pista || 0) * 0.10);
                val = Math.round(val * 10) / 10;
                statValue = `${val}`;
            }

            // Jersey color based on type
            let color = '#dc3545';
            if (tipo === 'defensa') color = '#0d6efd';
            if (tipo === 'fantasy') color = '#' + (jerseyColor || '5199e4');

            let visualHtml = '';
            if (tipo === 'fantasy') {
                const avatarUrl = this.diceBearManager.getImage(player.id, player.avatarConfig, jerseyColor || '5199e4');
                visualHtml = `<img src="${avatarUrl}" class="rounded-circle" style="width: 80px; height: 80px; border: 3px solid ${color}; background: white;">`;
            } else {
                visualHtml = `<div class="jersey-svg" style="width: 80px; height: 80px;">${this.getJerseySVG(color, player.dorsal)}</div>`;
            }

            playersHtml += `
                <div class="player-jersey ${posClass}">
                    ${visualHtml}
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

    renderMatchCard(match, options = {}) {
        const { isOwner, baseUrl = '' } = options;

        const card = document.createElement('div');
        // Use 'card' class for theme support, remove bg-white
        card.className = 'match-card card mb-2 shadow-sm border';
        card.style.cursor = 'pointer';

        // Determine correct page based on sport
        const sport = match.sport || 'basketball';
        const page = (sport === 'volleyball') ? 'partido_volley.html' : 'partido.html';

        // Navigate to match details
        card.onclick = () => {
            // Determine target URL based on context (public vs private/admin)
            // If we have an id (public) use that. If we have complex IDs (private) use those.
            if (match.id && !match.matchId) {
                // Public view format
                window.location.href = `${baseUrl}${page}?id=${match.id}`;
            } else {
                // Private view format
                window.location.href = `${baseUrl}${page}?idEquipo=${match.teamId}&idCompeticion=${match.compId}&idPartido=${match.matchId}&ownerUid=${match.ownerUid}`;
            }
        };

        const fechaObj = new Date(match.fechaHora);
        const time = fechaObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        // Logic for team names handles both public (match.nombreEquipo) and private (match.teamName) structures
        // Public: nombreEquipo vs nombreRival
        // Private: teamName vs nombreRival (and esLocal flag)

        let local, visitante;

        if (match.teamName) {
            // Private structure
            local = match.esLocal ? match.teamName : match.nombreRival;
            visitante = match.esLocal ? match.nombreRival : match.teamName;
        } else {
            // Public structure
            const nombreEquipo = match.nombreEquipo || 'Equipo';
            local = match.esLocal ? nombreEquipo : match.nombreRival || 'Rival';
            visitante = match.esLocal ? match.nombreRival || 'Rival' : nombreEquipo;
        }

        // Location
        // text-muted allows for override in styles.css for dark mode
        const locationLink = match.pabellon
            ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(match.pabellon)}" 
                  target="_blank" 
                  onclick="event.stopPropagation()" 
                  class="text-decoration-none text-secondary location-link" style="font-size: 0.85em;">
                  <i class="bi bi-geo-alt"></i> ${match.pabellon}
               </a>`
            : '<span class="text-secondary small" style="font-size: 0.85em;">Sin ubicación</span>';

        // Status Icon
        let iconHtml = '';
        switch (match.estado) {
            case 'pendiente':
                // Changed from text-secondary to specific class or kept text-secondary (fixed in CSS)
                iconHtml = '<i class="bi bi-clock text-secondary" title="Pendiente"></i>';
                break;
            case 'en_curso':
            case 'en curso':
                iconHtml = '<i class="bi bi-record-circle-fill text-danger blink" title="En curso"></i>';
                break;
            case 'finalizado':
                iconHtml = '<i class="bi bi-check-circle-fill text-success" title="Finalizado"></i>';
                break;
            default:
                iconHtml = '<i class="bi bi-question-circle-fill text-muted"></i>';
        }

        // Score
        let scoreHtml = '';
        if (match.estado === 'finalizado' || match.estado === 'en curso' || match.estado === 'en_curso') {
            const puntosEquipo = match.puntosEquipo ?? 0;
            const puntosRival = match.puntosRival ?? 0;

            let scoreText = '';
            // If private structure, rely on esLocal to show Team vs Rival
            const sport = match.sport || 'basketball';

            if (match.teamName) {
                if (sport === 'volleyball') {
                    const setsE = match.setsEquipo || 0;
                    const setsR = match.setsRival || 0;
                    // Usually teamName is always local? No, depends on esLocal flag which indicates if the 'teamName' (the user's team) is local.
                    // match.teamName is the NAME of the user's team.
                    // match.nombreRival is the NAME of the rival.
                    if (match.esLocal) {
                        scoreText = `${setsE} - ${setsR} (Sets)`;
                    } else {
                        scoreText = `${setsR} - ${setsE} (Sets)`;
                    }
                } else {
                    if (match.esLocal) {
                        scoreText = `${puntosEquipo} - ${puntosRival}`;
                    } else {
                        scoreText = `${puntosRival} - ${puntosEquipo}`;
                    }
                }
            } else {
                // Public structure
                if (sport === 'volleyball') {
                    const setsE = match.setsEquipo || 0;
                    const setsR = match.setsRival || 0;
                    if (match.esLocal) {
                        scoreText = `${setsE} - ${setsR} (Sets)`;
                    } else {
                        scoreText = `${setsR} - ${setsE} (Sets)`;
                    }
                } else {
                    if (match.esLocal) {
                        scoreText = `${puntosEquipo} - ${puntosRival}`;
                    } else {
                        scoreText = `${puntosRival} - ${puntosEquipo}`;
                    }
                }
            }

            scoreHtml = `<span class="fw-bold ms-2">${scoreText}</span>`;
        }

        // Compie name badge
        const compName = match.compName || match.nombreCompeticion || '';
        const compBadge = compName ? `<span class="badge bg-secondary" style="font-size: 0.7em;">${compName}</span>` : '';

        // Action Button
        let actionBtn = '';
        if (isOwner) {
            // Manage button (Private Calendar)
            actionBtn = `
            <button class="btn btn-sm btn-warning ms-auto action-btn" 
                onclick="event.stopPropagation(); window.location.href='${baseUrl}${page}?idEquipo=${match.teamId}&idCompeticion=${match.compId}&idPartido=${match.matchId}&ownerUid=${match.ownerUid}'"
                title="Gestionar partido">
                <i class="bi bi-pencil-fill"></i>
            </button>
            `;
        } else {
            // View button (Public/ReadOnly)
            // Use correct ID for link
            const linkUrl = (match.id && !match.matchId)
                ? `${baseUrl}${page}?id=${match.id}`
                : `${baseUrl}${page}?idEquipo=${match.teamId}&idCompeticion=${match.compId}&idPartido=${match.matchId}&ownerUid=${match.ownerUid}`;

            actionBtn = `
                <a href="${linkUrl}" 
                class="btn btn-sm btn-success ms-auto action-btn" 
                title="Ver partido"
                onclick="event.stopPropagation()">
                    <i class="bi bi-eye-fill"></i>
                </a>
            `;
        }

        card.innerHTML = `
            <div class="card-body p-2">
                <div class="d-flex justify-content-between align-items-start mb-1">
                    <div class="text-secondary small">${time}</div>
                    ${compBadge}
                </div>
                
                <div class="mb-2">
                    <div class="fw-bold text-truncate" title="${local}">${local}</div>
                    <div class="text-secondary small">vs</div>
                    <div class="fw-bold text-truncate" title="${visitante}">${visitante}</div>
                </div>

                <div class="mb-2">
                    ${locationLink}
                </div>

                <div class="d-flex align-items-center mt-2 border-top pt-2">
                    <div class="d-flex align-items-center">
                        ${iconHtml}
                        ${scoreHtml}
                    </div>
                    ${actionBtn}
                </div>
            </div>
        `;

        return card;
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
