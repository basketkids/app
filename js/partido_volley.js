
document.addEventListener('DOMContentLoaded', () => {
    // Instantiate the VolleyMatchApp
    window.app = new VolleyMatchApp();
    // Initialize (inherited from BaseApp/MatchBaseApp)
    if (window.app.init) {
        window.app.init();
    } else {
        console.error("App init method not found");
    }
});
