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

    async followTeam(ownerUid, teamId, userUid) {
        console.log(`Attempting to follow: Owner=${ownerUid}, Team=${teamId}, User=${userUid}`);

        try {
            const timestamp = firebase.database.ServerValue.TIMESTAMP;
            const updates = {};

            // Write to team's followers list
            updates[`usuarios/${ownerUid}/equipos/${teamId}/followers/${userUid}`] = { timestamp: timestamp };

            // Write to user's following list
            updates[`usuarios/${userUid}/following/${teamId}`] = {
                ownerUid: ownerUid,
                timestamp: timestamp
            };

            // Add notification for the owner
            const notificationRef = this.db.ref(`usuarios/${ownerUid}/notifications`).push();
            updates[`usuarios/${ownerUid}/notifications/${notificationRef.key}`] = {
                type: 'new_follower',
                teamId: teamId,
                followerUid: userUid,
                timestamp: timestamp,
                read: false
            };

            await this.db.ref().update(updates);
            return true;
        } catch (e) {
            console.error("Error during followTeam operation:", e);
            throw e;
        }
    }

    unfollowTeam(ownerUid, teamId, userUid) {
        const p1 = this.db.ref(`usuarios/${ownerUid}/equipos/${teamId}/followers/${userUid}`).remove();
        const p2 = this.db.ref(`usuarios/${userUid}/following/${teamId}`).remove();
        return Promise.all([p1, p2]);
    }

    isFollowing(ownerUid, teamId, userUid) {
        return this.db.ref(`usuarios/${ownerUid}/equipos/${teamId}/followers/${userUid}`).once('value').then(snap => snap.exists());
    }
}
