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
}
