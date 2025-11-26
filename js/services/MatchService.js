class MatchService {
    constructor(db) {
        this.db = db;
    }

    get(userId, teamId, compId, matchId) {
        return this.db.ref(`usuarios/${userId}/equipos/${teamId}/competiciones/${compId}/partidos/${matchId}`).once('value');
    }

    updateStatus(userId, teamId, compId, matchId, status) {
        return this.db.ref(`usuarios/${userId}/equipos/${teamId}/competiciones/${compId}/partidos/${matchId}/estado`)
            .set(status)
            .then(() => this.syncGlobal(userId, teamId, compId, matchId));
    }

    updateField(userId, teamId, compId, matchId, field, value) {
        return this.db.ref(`usuarios/${userId}/equipos/${teamId}/competiciones/${compId}/partidos/${matchId}/${field}`)
            .set(value)
            .then(() => this.syncGlobal(userId, teamId, compId, matchId));
    }

    updateStats(userId, teamId, compId, matchId, stats) {
        return this.db.ref(`usuarios/${userId}/equipos/${teamId}/competiciones/${compId}/partidos/${matchId}/estadisticasJugadores`)
            .set(stats)
            .then(() => this.syncGlobal(userId, teamId, compId, matchId));
    }

    updateConvocados(userId, teamId, compId, matchId, convocados) {
        return this.db.ref(`usuarios/${userId}/equipos/${teamId}/competiciones/${compId}/partidos/${matchId}/convocados`)
            .set(convocados)
            .then(() => this.syncGlobal(userId, teamId, compId, matchId));
    }

    updatePista(userId, teamId, compId, matchId, pista) {
        return this.db.ref(`usuarios/${userId}/equipos/${teamId}/competiciones/${compId}/partidos/${matchId}/jugadoresEnPista`)
            .set(pista)
            .then(() => this.syncGlobal(userId, teamId, compId, matchId));
    }

    syncGlobal(userId, teamId, compId, matchId) {
        const refPartido = this.db.ref(`usuarios/${userId}/equipos/${teamId}/competiciones/${compId}/partidos/${matchId}`);
        const refGlobal = this.db.ref(`partidosGlobales/${matchId}`);

        return this.db.ref(`usuarios/${userId}/equipos/${teamId}/nombre`).once('value').then(nombreSnap => {
            return refPartido.once('value').then(snapshot => {
                if (!snapshot.exists()) {
                    return refGlobal.remove();
                }
                const p = snapshot.val();
                return refGlobal.set(p);
            });
        }).catch(error => {
            console.error('Error al sincronizar partido global:', error);
        });
    }

    deleteGlobal(matchId) {
        return this.db.ref(`partidosGlobales/${matchId}`).remove();
    }

    /**
     * Get all matches for a competition
     * @param {string} userId - User ID
     * @param {string} teamId - Team ID
     * @param {string} compId - Competition ID
     * @returns {Promise} - Promise with snapshot of all matches
     */
    getAllMatches(userId, teamId, compId) {
        return this.db.ref(`usuarios/${userId}/equipos/${teamId}/competiciones/${compId}/partidos`).once('value');
    }

    /**
     * Check if a match already exists at the same date and time
     * @param {Object} matches - Object with all existing matches (from Firebase snapshot.val())
     * @param {string} fechaHora - DateTime in ISO format (YYYY-MM-DDTHH:MM)
     * @returns {boolean} - True if duplicate exists
     */
    static checkDuplicate(matches, fechaHora) {
        if (!matches) return false;

        return Object.values(matches).some(match => {
            return match.fechaHora === fechaHora;
        });
    }
}
