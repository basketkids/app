class TeamService {
    constructor(db) {
        this.db = db;
    }

    getAll(userId, callback) {
        const ref = this.db.ref(`usuarios/${userId}/equipos`);
        ref.on('value', callback);
        return ref; // Return ref to allow off()
    }

    create(userId, name) {
        return this.db.ref(`usuarios/${userId}/equipos`).push().set({ nombre: name });
    }

    delete(userId, teamId) {
        return this.db.ref(`usuarios/${userId}/equipos/${teamId}`).remove();
    }

    get(userId, teamId) {
        return this.db.ref(`usuarios/${userId}/equipos/${teamId}`).once('value');
    }

    getName(userId, teamId) {
        return this.db.ref(`usuarios/${userId}/equipos/${teamId}/nombre`).once('value');
    }

    update(userId, teamId, data) {
        return this.db.ref(`usuarios/${userId}/equipos/${teamId}`).update(data);
    }
}
