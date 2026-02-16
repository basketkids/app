// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(window.firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.database();

// DOM Elements
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const authError = document.getElementById('authError');

// Helper to show error
function showError(message) {
    authError.textContent = message;
    authError.classList.remove('d-none');
    setTimeout(() => {
        authError.classList.add('d-none');
    }, 5000);
}

// Helper to save user data
async function saveUserData(user) {
    try {
        const userRef = db.ref(`usuarios/${user.uid}/profile`);
        const snapshot = await userRef.once('value');
        const currentData = snapshot.val() || {};

        const updates = {};
        // Sanitization: Escape special characters
        if (!currentData.email) updates.email = Sanitizer.escape(user.email);
        if (!currentData.nombre && !currentData.displayName) {
            const safeName = Sanitizer.escape(user.displayName || user.email.split('@')[0]);
            updates.nombre = safeName;
            updates.displayName = safeName;
        }

        if (Object.keys(updates).length > 0) {
            await userRef.update(updates);
        }
    } catch (error) {
        console.error("Error saving user data:", error);
    }
}

// Login with Email/Password
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        auth.signInWithEmailAndPassword(email, password)
            .then(async (userCredential) => {
                // Save user data
                await saveUserData(userCredential.user);
                // Signed in
                window.location.href = 'index.html';
            })
            .catch((error) => {
                showError(error.message);
            });
    });
}

// Register with Email/Password
if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;

        if (password !== confirmPassword) {
            showError("Las contraseñas no coinciden");
            return;
        }

        auth.createUserWithEmailAndPassword(email, password)
            .then(async (userCredential) => {
                // Save user data
                await saveUserData(userCredential.user);
                // Signed in
                window.location.href = 'index.html';
            })
            .catch((error) => {
                showError(error.message);
            });
    });
}

// Google Login
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider)
            .then(async (result) => {
                // Save user data
                await saveUserData(result.user);
                window.location.href = 'index.html';
            })
            .catch((error) => {
                showError(error.message);
            });
    });
}

// Check auth state (optional here if we want to redirect if already logged in)
auth.onAuthStateChanged((user) => {
    if (user) {
        // If user is already on login page, redirect to index
        // But we might want to allow them to see the page if they just logged in?
        // Usually if you go to /login and are logged in, you get redirected.
        // Let's do that.
        if (window.location.pathname.endsWith('login.html')) {
            window.location.href = 'index.html';
        }
    }
});

// Forgot Password Logic
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const resetMessage = document.getElementById('resetMessage');

if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('resetEmail').value;

        auth.sendPasswordResetEmail(email)
            .then(() => {
                resetMessage.textContent = 'Enlace enviado. Revisa tu correo.';
                resetMessage.className = 'alert alert-success mt-3';
                resetMessage.classList.remove('d-none');
                forgotPasswordForm.reset();
            })
            .catch((error) => {
                resetMessage.textContent = error.message;
                resetMessage.className = 'alert alert-danger mt-3';
                resetMessage.classList.remove('d-none');
            });
    });
}
