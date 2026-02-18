class MatchLogic {
    static applyEvent(partido, evento) {
        if (evento.tipo === 'finCuarto' || evento.tipo === 'inicioCuarto') {
            return;
        }

        this._updateMasMenos(partido, evento);

        if (evento.dorsal >= 0) {
            if (!partido.estadisticasJugadores) partido.estadisticasJugadores = {};
            const stats = partido.estadisticasJugadores;
            const jid = evento.jugadorId;

            if (!stats[jid]) stats[jid] = this._initStats();

            switch (evento.tipo) {
                case 'puntos':
                    // Actualizar puntos totales
                    stats[jid].puntos = (stats[jid].puntos || 0) + (evento.cantidad || 0);

                    // Actualizar tiros convertidos
                    const valor = evento.cantidad || 0;
                    if (valor >= 1 && valor <= 3) {
                        const key = `t${valor}_convertidos`;
                        stats[jid][key] = (stats[jid][key] || 0) + 1;
                    }
                    this._updateScore(partido, evento);
                    break;

                case 'fallo':
                    // Actualizar tiros fallados
                    const valorF = evento.valor || (evento.cantidad || 0); // Handle variety
                    if (valorF >= 1 && valorF <= 3) {
                        const key = `t${valorF}_fallados`;
                        stats[jid][key] = (stats[jid][key] || 0) + 1;
                    }
                    break;

                case 'cambioPista':
                    break;

                default:
                    // Generic stats (rebounds, assists, etc.)
                    if (evento.estadisticaTipo && evento.cantidad) {
                        stats[jid][evento.estadisticaTipo] = (stats[jid][evento.estadisticaTipo] || 0) + evento.cantidad;
                    }
                    // For fouls
                    this._updateFouls(partido, evento);
                    break;
            }
        } else {
            // Rival events (dorsal -1)
            if (evento.tipo === "puntos") {
                this._updateScore(partido, evento);
            } else {
                this._updateFouls(partido, evento);
            }
        }
    }

    static revertEvent(partido, evento) {
        if (evento.tipo === 'finCuarto' || evento.tipo === 'inicioCuarto') {
            return;
        }

        this._updateMasMenos(partido, evento, true);

        if (evento.dorsal >= 0) {
            if (!partido.estadisticasJugadores) return;
            const stats = partido.estadisticasJugadores;
            const jid = evento.jugadorId;
            if (!stats[jid]) return; // Should exist if we are reverting

            switch (evento.tipo) {
                case 'puntos':
                    stats[jid].puntos = (stats[jid].puntos || 0) - (evento.cantidad || 0);

                    const valor = evento.cantidad || 0;
                    if (valor >= 1 && valor <= 3) {
                        const key = `t${valor}_convertidos`;
                        stats[jid][key] = (stats[jid][key] || 0) - 1;
                    }
                    this._updateScore(partido, evento, true);
                    break;

                case 'fallo':
                    const valorF = evento.valor || (evento.cantidad || 0);
                    if (valorF >= 1 && valorF <= 3) {
                        const key = `t${valorF}_fallados`;
                        stats[jid][key] = (stats[jid][key] || 0) - 1;
                    }
                    break;

                case 'cambioPista':
                    break;

                default:
                    if (evento.estadisticaTipo && evento.cantidad) {
                        stats[jid][evento.estadisticaTipo] = (stats[jid][evento.estadisticaTipo] || 0) - evento.cantidad;
                    }
                    this._updateFouls(partido, evento, true);
                    break;
            }
        } else {
            if (evento.tipo === "puntos") {
                this._updateScore(partido, evento, true);
            } else {
                this._updateFouls(partido, evento, true);
            }
        }
    }

    static _updateScore(partido, evento, revert = false) {
        const factor = revert ? -1 : 1;
        const amount = (evento.cantidad || 0) * factor;

        if (evento.dorsal === -1) {
            partido.puntosRival = (partido.puntosRival || 0) + amount;
        } else {
            partido.puntosEquipo = (partido.puntosEquipo || 0) + amount;
        }
    }

    static _updateFouls(partido, evento, revert = false) {
        const factor = revert ? -1 : 1;
        // Assuming 1 foul per event unless specified
        const amount = 1 * factor;

        // Check if it IS a foul event
        if (evento.estadisticaTipo !== 'faltas' && evento.tipo !== 'faltas' && evento.tipo !== 'foul') return;

        if (evento.dorsal === -1) {
            partido.faltasRival = (partido.faltasRival || 0) + amount;
        } else {
            partido.faltasEquipo = (partido.faltasEquipo || 0) + amount;
        }
    }

    static _updateMasMenos(partido, evento, revert = false) {
        if (evento.tipo !== 'puntos' || !evento.jugadoresEnPista) return;

        const factor = revert ? -1 : 1;
        const cantidad = (evento.cantidad || 0) * factor;
        // Si anota equipo (dorsal >= 0) suma, si anota rival (dorsal < 0) resta
        const delta = (evento.dorsal >= 0) ? cantidad : -cantidad;

        if (!partido.estadisticasJugadores) partido.estadisticasJugadores = {};
        const stats = partido.estadisticasJugadores;

        evento.jugadoresEnPista.forEach(id => {
            if (!stats[id]) stats[id] = this._initStats();
            stats[id].masMenos = (stats[id].masMenos || 0) + delta;
        });
    }

    static _initStats() {
        return {
            puntos: 0, asistencias: 0, rebotes: 0, robos: 0, tapones: 0, faltas: 0, masMenos: 0,
            t1_convertidos: 0, t1_fallados: 0,
            t2_convertidos: 0, t2_fallados: 0,
            t3_convertidos: 0, t3_fallados: 0
        };
    }
}
