firebase.initializeApp(window.firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

let currentUser = null;
let diceBearManager = new DiceBearManager();
let currentAvatarConfig = null;
let avatarEditorModal = null;

// DOM elements
const currentAvatar = document.getElementById('currentAvatar');
const editAvatarBtn = document.getElementById('editAvatarBtn');
const displayNameInput = document.getElementById('displayName');
const saveDisplayNameBtn = document.getElementById('saveDisplayNameBtn');
const emailInput = document.getElementById('email');
const saveEmailBtn = document.getElementById('saveEmailBtn');
const currentPasswordInput = document.getElementById('currentPassword');
const newPasswordInput = document.getElementById('newPassword');
const confirmPasswordInput = document.getElementById('confirmPassword');
const changePasswordBtn = document.getElementById('changePasswordBtn');
const avatarPreview = document.getElementById('avatarPreview');
const avatarControls = document.getElementById('avatarControls');
const saveAvatarBtn = document.getElementById('saveAvatarBtn');

// Initialize
auth.onAuthStateChanged(user => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    currentUser = user;
    loadUserProfile();
});

avatarEditorModal = new bootstrap.Modal(document.getElementById('avatarEditorModal'));

// Load user profile
async function loadUserProfile() {
    try {
        const profileSnap = await db.ref(`usuarios/${currentUser.uid}/profile`).once('value');
        const profile = profileSnap.val();

        // Load display name
        if (profile && profile.displayName) {
            displayNameInput.value = profile.displayName;
        } else {
            displayNameInput.value = currentUser.displayName || '';
        }

        // Load email
        emailInput.value = currentUser.email;

        // Load avatar
        if (profile && profile.avatarConfig) {
            currentAvatarConfig = profile.avatarConfig;
        } else {
            currentAvatarConfig = null;
        }
        updateAvatarDisplay();
    } catch (error) {
        console.error('Error loading profile:', error);
        alert('Error al cargar el perfil: ' + error.message);
    }
}

function updateAvatarDisplay() {
    const avatarUrl = diceBearManager.getImageForProfile(currentUser.uid, currentAvatarConfig);
    currentAvatar.src = avatarUrl;
    if (avatarPreview) {
        avatarPreview.src = avatarUrl;
    }
}

// Save display name
saveDisplayNameBtn.addEventListener('click', async () => {
    const newDisplayName = displayNameInput.value.trim();
    if (!newDisplayName) {
        alert('Por favor, introduce un nombre.');
        return;
    }

    try {
        await db.ref(`usuarios/${currentUser.uid}/profile/displayName`).set(newDisplayName);

        // If admin, update public profile
        const profileSnap = await db.ref(`usuarios/${currentUser.uid}/profile`).once('value');
        const profile = profileSnap.val();
        if (profile && profile.admin) {
            await db.ref(`public_admins/${currentUser.uid}/name`).set(newDisplayName);
        }

        alert('Nombre actualizado correctamente.');
        // Reload header to update display
        location.reload();
    } catch (error) {
        console.error('Error saving display name:', error);
        alert('Error al guardar el nombre: ' + error.message);
    }
});

// Save email
saveEmailBtn.addEventListener('click', async () => {
    const newEmail = emailInput.value.trim();
    if (!newEmail) {
        alert('Por favor, introduce un email válido.');
        return;
    }

    if (!confirm('Cambiar el email requerirá volver a iniciar sesión. ¿Continuar?')) {
        return;
    }

    try {
        await currentUser.updateEmail(newEmail);
        alert('Email actualizado correctamente. Por favor, vuelve a iniciar sesión.');
        await auth.signOut();
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Error updating email:', error);
        if (error.code === 'auth/requires-recent-login') {
            alert('Por seguridad, necesitas volver a iniciar sesión antes de cambiar el email.');
            await auth.signOut();
            window.location.href = 'login.html';
        } else {
            alert('Error al actualizar el email: ' + error.message);
        }
    }
});

// Change password
changePasswordBtn.addEventListener('click', async () => {
    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (!currentPassword || !newPassword || !confirmPassword) {
        alert('Por favor, completa todos los campos.');
        return;
    }

    if (newPassword !== confirmPassword) {
        alert('Las contraseñas no coinciden.');
        return;
    }

    if (newPassword.length < 6) {
        alert('La nueva contraseña debe tener al menos 6 caracteres.');
        return;
    }

    try {
        // Re-authenticate user
        const credential = firebase.auth.EmailAuthProvider.credential(
            currentUser.email,
            currentPassword
        );
        await currentUser.reauthenticateWithCredential(credential);

        // Update password
        await currentUser.updatePassword(newPassword);

        alert('Contraseña actualizada correctamente.');
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
        confirmPasswordInput.value = '';
    } catch (error) {
        console.error('Error changing password:', error);
        if (error.code === 'auth/wrong-password') {
            alert('La contraseña actual es incorrecta.');
        } else {
            alert('Error al cambiar la contraseña: ' + error.message);
        }
    }
});

// Avatar editor
editAvatarBtn.addEventListener('click', () => {
    diceBearManager.openEditor(
        currentUser.uid,
        currentAvatarConfig,
        '5199e4',
        avatarControls,
        avatarPreview
    );
    avatarEditorModal.show();
});

saveAvatarBtn.addEventListener('click', async () => {
    try {
        const newConfig = diceBearManager.getConfigFromEditor();
        await db.ref(`usuarios/${currentUser.uid}/profile/avatarConfig`).set(newConfig);

        // If admin, update public profile
        const profileSnap = await db.ref(`usuarios/${currentUser.uid}/profile`).once('value');
        const profile = profileSnap.val();
        if (profile && profile.admin) {
            await db.ref(`public_admins/${currentUser.uid}/avatarConfig`).set(newConfig);
        }

        currentAvatarConfig = newConfig;
        updateAvatarDisplay();
        avatarEditorModal.hide();
        alert('Avatar guardado correctamente.');
        // Reload to update header
        location.reload();
    } catch (error) {
        console.error('Error saving avatar:', error);
        alert('Error al guardar el avatar: ' + error.message);
    }
});
