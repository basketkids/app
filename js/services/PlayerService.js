class PlayerService {
    constructor(db) {
        this.db = db;
    }

    getSquad(userId, teamId) {
        return this.db.ref(`usuarios/${userId}/equipos/${teamId}/plantilla`).once('value');
    }

    add(userId, teamId, name, dorsal) {
        return this.db.ref(`usuarios/${userId}/equipos/${teamId}/plantilla`).push({ nombre: name, dorsal: dorsal });
    }

    delete(userId, teamId, playerId) {
        return this.db.ref(`usuarios/${userId}/equipos/${teamId}/plantilla/${playerId}`).remove();
    }

    get(userId, teamId, playerId) {
        return this.db.ref(`usuarios/${userId}/equipos/${teamId}/plantilla/${playerId}`).once('value');
    }

    update(userId, teamId, playerId, data) {
        return this.db.ref(`usuarios/${userId}/equipos/${teamId}/plantilla/${playerId}`).update(data);
    }
}
