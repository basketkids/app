class BaseApp {
    constructor() {
        this.initFirebase();
        this.auth = firebase.auth();
        this.db = firebase.database();
        this.currentUser = null;
    }

    initFirebase() {
        if (!firebase.apps.length) {
            firebase.initializeApp(window.firebaseConfig);
        }
    }

    init() {
        this.auth.onAuthStateChanged(user => {
            if (!user) {
                this.handleNoUser();
            } else {
                this.currentUser = user;
                this.onUserLoggedIn(user);
            }
        });
    }

    handleNoUser() {
        // Default behavior: redirect to index.html if not already there
        if (!window.location.pathname.endsWith('index.html') && !window.location.pathname.endsWith('/')) {
            window.location.href = 'index.html';
        }
    }

    onUserLoggedIn(user) {
        console.log('User logged in:', user.uid);
        // To be implemented by subclasses
    }

    getParam(name) {
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    }
}
