class ContactService {
    constructor(db) {
        this.db = db;
    }

    saveMessage(messageData) {
        const newKey = this.db.ref().child('contact_messages').push().key;
        return this.db.ref('contact_messages/' + newKey).set({
            ...messageData,
            timestamp: new Date().toISOString()
        });
    }

    getMessages() {
        return this.db.ref('contact_messages').orderByChild('timestamp').once('value');
    }

    markAsRead(messageId) {
        return this.db.ref(`contact_messages/${messageId}`).update({ read: true });
    }

    archiveMessage(messageId) {
        return this.db.ref(`contact_messages/${messageId}`).update({ archived: true });
    }

    unarchiveMessage(messageId) {
        return this.db.ref(`contact_messages/${messageId}`).update({ archived: false });
    }

    getUnreadCount() {
        return this.db.ref('contact_messages').once('value').then(snapshot => {
            let count = 0;
            snapshot.forEach(child => {
                const val = child.val();
                if (!val.read && !val.archived) {
                    count++;
                }
            });
            return count;
        });
    }
}
