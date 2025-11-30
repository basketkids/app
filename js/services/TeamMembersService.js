class TeamMembersService {
    constructor(db) {
        this.db = db;
    }

    getMembers(ownerUid, teamId, callback) {
        const ref = this.db.ref(`usuarios/${ownerUid}/equipos/${teamId}/members`);
        if (callback) ref.on('value', callback);
        return ref;
    }

    async addMember(ownerUid, teamId, memberUid, role = 'follower') {
        return this.db.ref(`usuarios/${ownerUid}/equipos/${teamId}/members/${memberUid}`).set({
            role: role,
            addedAt: firebase.database.ServerValue.TIMESTAMP
        });
    }

    async updateMemberRole(ownerUid, teamId, memberUid, role) {
        return this.db.ref(`usuarios/${ownerUid}/equipos/${teamId}/members/${memberUid}/role`).set(role);
    }

    async linkPlayer(ownerUid, teamId, memberUid, playerId) {
        return this.db.ref(`usuarios/${ownerUid}/equipos/${teamId}/members/${memberUid}/linkedPlayerId`).set(playerId);
    }

    async removeMember(ownerUid, teamId, memberUid) {
        return this.db.ref(`usuarios/${ownerUid}/equipos/${teamId}/members/${memberUid}`).remove();
    }

    getFollowers(ownerUid, teamId, callback) {
        const ref = this.db.ref(`usuarios/${ownerUid}/equipos/${teamId}/followers`);
        if (callback) ref.on('value', callback);
        return ref;
    }
}
