class CompetitionService {
    constructor(db) {
        this.db = db;
    }

    get(userId, teamId, compId) {
        return this.db.ref(`usuarios/${userId}/equipos/${teamId}/competiciones/${compId}`).once('value');
    }

    getAll(userId, teamId, callback) {
        const ref = this.db.ref(`usuarios/${userId}/equipos/${teamId}/competiciones`);
        ref.on('value', callback);
        return ref;
    }

    create(userId, teamId, name) {
        return this.db.ref(`usuarios/${userId}/equipos/${teamId}/competiciones`).push({ nombre: name });
    }

    getRivals(userId, teamId, compId, callback) {
        const ref = this.db.ref(`usuarios/${userId}/equipos/${teamId}/competiciones/${compId}/rivales`);
        ref.on('value', callback);
        return ref;
    }

    addRival(userId, teamId, compId, name) {
        return this.db.ref(`usuarios/${userId}/equipos/${teamId}/competiciones/${compId}/rivales`).push({ nombre: name });
    }

    deleteRival(userId, teamId, compId, rivalId) {
        return this.db.ref(`usuarios/${userId}/equipos/${teamId}/competiciones/${compId}/rivales/${rivalId}`).remove();
    }

    getMatches(userId, teamId, compId, callback) {
        const ref = this.db.ref(`usuarios/${userId}/equipos/${teamId}/competiciones/${compId}/partidos`);
        ref.on('value', callback);
        return ref;
    }

    createMatch(userId, teamId, compId, matchData) {
        // matchData should include everything needed
        const ref = this.db.ref(`usuarios/${userId}/equipos/${teamId}/competiciones/${compId}/partidos`);
        const newRef = ref.push();
        return newRef.set(matchData).then(() => newRef); // Return the ref/promise resolving to ref
    }

    deleteMatch(userId, teamId, compId, matchId) {
        return this.db.ref(`usuarios/${userId}/equipos/${teamId}/competiciones/${compId}/partidos/${matchId}`).remove();
    }

    getMatchRival(userId, teamId, compId, rivalId) {
        return this.db.ref(`usuarios/${userId}/equipos/${teamId}/competiciones/${compId}/rivales/${rivalId}`).once('value');
    }
}
