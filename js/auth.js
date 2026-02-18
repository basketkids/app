
// Access Supabase client from global mapped in supabase-config.js
// Access Supabase client from global mapped in supabase-config.js
const sb = window.supabaseClient;

// DOM Elements
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const authError = document.getElementById('authError');
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const resetMessage = document.getElementById('resetMessage');

// Helper to show error
function showError(message) {
    if (!authError) return;
    authError.textContent = message;
    authError.classList.remove('d-none');
    setTimeout(() => {
        authError.classList.add('d-none');
    }, 5000);
}

// Helper to save/update user profile (Supabase trigger handles creation, this ensures sync)
async function saveUserData(user) {
    try {
        const { data: profile, error } = await sb
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is 'Row not found' (shouldn't happen due to trigger but maps to null)
            console.error("Error fetching profile:", error);
            return;
        }

        // If profile exists, check if we need to update anything?
        // For now, we assume the trigger does the job on creation.
        // We can update last login or something if needed.

    } catch (error) {
        console.error("Error in saveUserData:", error);
    }
}

// Login with Email/Password
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const { data, error } = await sb.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) throw error;

            // Signed in
            window.location.href = 'index.html';
        } catch (error) {
            showError(error.message || "Error al iniciar sesión");
        }
    });
}

// Register with Email/Password
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;

        if (password !== confirmPassword) {
            showError("Las contraseñas no coinciden");
            return;
        }

        try {
            const { data, error } = await sb.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        full_name: email.split('@')[0] // Default name
                    }
                }
            });

            if (error) throw error;

            if (data.user) {
                // Check if email confirmation is required? Supabase default is yes.
                // Assuming it might auto-login or require confirmation.
                // If session is null, it means confirmation email sent.
                if (!data.session) {
                    showError("Registro exitoso. Por favor, confirma tu correo electrónico.");
                } else {
                    window.location.href = 'index.html';
                }
            }
        } catch (error) {
            showError(error.message || "Error al registrarse");
        }
    });
}

// Google Login
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
        try {
            const { data, error } = await sb.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin + '/index.html' // Explicit redirect
                }
            });
            if (error) throw error;
            // It will redirect, so no code here usually runs
        } catch (error) {
            showError(error.message || "Error con Google Login");
        }
    });
}

// Check auth state
// Replaces firebase.auth().onAuthStateChanged
sb.auth.onAuthStateChange((event, session) => {
    if (session) {
        // If user is on login page, redirect to index
        if (window.location.pathname.endsWith('login.html')) {
            window.location.href = 'index.html';
        }
    }
});


// Forgot Password Logic
if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('resetEmail').value;

        try {
            const { data, error } = await sb.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + '/reset-password.html', // Need a page to handle reset
            });

            if (error) throw error;

            resetMessage.textContent = 'Enlace enviado. Revisa tu correo.';
            resetMessage.className = 'alert alert-success mt-3';
            resetMessage.classList.remove('d-none');
            forgotPasswordForm.reset();

        } catch (error) {
            resetMessage.textContent = error.message || "Error al enviar enlace";
            resetMessage.className = 'alert alert-danger mt-3';
            resetMessage.classList.remove('d-none');
        }
    });
}
