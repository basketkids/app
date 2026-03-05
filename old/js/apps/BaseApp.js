class BaseApp {
    constructor() {
        // Supabase client is already initialized in supabase-config.js
        this.supabase = window.supabaseClient;
        this.auth = this.supabase.auth;
        this.currentUser = null;
    }

    init() {
        // Check initial session
        this.supabase.auth.getSession().then(({ data: { session } }) => {
            this._handleSession(session);
        });

        // Listen for changes
        this.supabase.auth.onAuthStateChange((_event, session) => {
            this._handleSession(session);
        });
    }

    _handleSession(session) {
        if (!session) {
            this.handleNoUser();
        } else {
            const user = session.user;
            // Normalize for legacy compatibility
            user.uid = user.id;
            user.displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario';
            user.photoURL = user.user_metadata?.avatar_url || null;

            this.currentUser = user;
            this.onUserLoggedIn(user);
        }
    }

    handleNoUser() {
        // Default behavior: redirect to login.html if not already there and not in public area
        // Note: Logic changed slightly: Check if we are in a public page or not?
        // Index.html logic: if not logged in, mapping to public/ is handled by onAuthStateChanged in auth.js?
        // auth.js handles login page redirection. 
        // BaseApp handles protected pages.

        const path = window.location.pathname;
        if (!path.endsWith('login.html') && !path.includes('/public/')) {
            window.location.href = 'login.html';
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
