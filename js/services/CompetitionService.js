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

    update(userId, teamId, compId, updates) {
        return this.db.ref(`usuarios/${userId}/equipos/${teamId}/competiciones/${compId}`).update(updates);
    }

    updateRival(userId, teamId, compId, rivalId, name) {
        return this.db.ref(`usuarios/${userId}/equipos/${teamId}/competiciones/${compId}/rivales/${rivalId}`).update({ nombre: name });
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

    /**
     * Find a rival by name, or create it if it doesn't exist
     * @param {string} userId - User ID
     * @param {string} teamId - Team ID
     * @param {string} compId - Competition ID
     * @param {string} rivalName - Name of the rival team
     * @returns {Promise<string>} - Promise resolving to the rival ID
     */
    findOrCreateRival(userId, teamId, compId, rivalName) {
        const rivalsRef = this.db.ref(`usuarios/${userId}/equipos/${teamId}/competiciones/${compId}/rivales`);

        return rivalsRef.once('value').then(snapshot => {
            const rivals = snapshot.val();

            // Search for existing rival with the same name (case-insensitive)
            if (rivals) {
                for (const [id, rival] of Object.entries(rivals)) {
                    if (rival.nombre && rival.nombre.toLowerCase() === rivalName.toLowerCase()) {
                        return id; // Return existing rival ID
                    }
                }
            }

            // Rival doesn't exist, create it
            return this.addRival(userId, teamId, compId, rivalName).then(newRef => {
                return newRef.key; // Return new rival ID
            });
        });
    }
}
