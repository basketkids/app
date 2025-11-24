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
}
