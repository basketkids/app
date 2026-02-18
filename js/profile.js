const sb = window.supabaseClient;

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
sb.auth.onAuthStateChange((event, session) => {
    if (!session) {
        window.location.href = 'index.html';
        return;
    }
    currentUser = session.user;
    loadUserProfile();
});

avatarEditorModal = new bootstrap.Modal(document.getElementById('avatarEditorModal'));

// Load user profile
async function loadUserProfile() {
    try {
        const { data: profile, error } = await sb
            .from('profiles')
            .select(`
                *,
                avatar_config:avatar_config_id (*)
            `)
            .eq('id', currentUser.id)
            .single();

        if (error) throw error;

        // Load display name
        displayNameInput.value = profile.display_name || currentUser.user_metadata?.full_name || 'Usuario';

        // Load email
        emailInput.value = currentUser.email;

        // Load avatar
        if (profile.avatar_config) {
            currentAvatarConfig = profile.avatar_config;
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
    // DiceBearManager might be sync, but it returns URL.
    // If we have config object, we generate URL.
    const avatarUrl = diceBearManager.getImageForProfile(currentUser.id, currentAvatarConfig);
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
        const safeDisplayName = Sanitizer.escape(newDisplayName);

        const { error } = await sb
            .from('profiles')
            .update({ display_name: safeDisplayName })
            .eq('id', currentUser.id);

        if (error) throw error;

        alert('Nombre actualizado correctamente.');
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

    if (!confirm('Cambiar el email podría requerir confirmación. ¿Continuar?')) {
        return;
    }

    try {
        const { error } = await sb.auth.updateUser({ email: newEmail });

        if (error) throw error;

        alert('Se ha enviado un correo de confirmación a la nueva dirección.');
    } catch (error) {
        console.error('Error updating email:', error);
        alert('Error al actualizar el email: ' + error.message);
    }
});

// Change password
changePasswordBtn.addEventListener('click', async () => {
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (!newPassword || !confirmPassword) {
        alert('Por favor, completa los campos de nueva contraseña.');
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
        const { error } = await sb.auth.updateUser({ password: newPassword });

        if (error) throw error;

        alert('Contraseña actualizada correctamente.');
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
        confirmPasswordInput.value = '';
    } catch (error) {
        console.error('Error changing password:', error);
        alert('Error al cambiar la contraseña: ' + error.message);
    }
});

// Avatar editor
editAvatarBtn.addEventListener('click', () => {
    diceBearManager.openEditor(
        currentUser.id,
        currentAvatarConfig,
        '5199e4',
        avatarControls,
        avatarPreview
    );
    avatarEditorModal.show();
});

saveAvatarBtn.addEventListener('click', async () => {
    try {
        // 1. Get Config from Manager
        // Editor might return JSON object
        const newConfig = diceBearManager.getConfigFromEditor();

        // 2. Insert into avatar_configs first (relation)
        // Helper function mapping
        const avatarPayload = {
            skin_color: newConfig.skinColor,
            top: newConfig.top,
            hair_color: newConfig.hairColor,
            hat_color: newConfig.hatColor,
            facial_hair_type: newConfig.facialHairType,
            facial_hair_color: newConfig.facialHairColor,
            eyes: newConfig.eyes,
            eyebrows: newConfig.eyebrows,
            mouth: newConfig.mouth,
            accessories_type: newConfig.accessoriesType,
            accessories_color: newConfig.accessoriesColor,
            clothing: newConfig.clothing,
            clothes_color: newConfig.clothesColor,
            clothing_graphic: newConfig.clothingGraphic
        };

        const { data: avatarData, error: avatarError } = await sb
            .from('avatar_configs')
            .insert(avatarPayload)
            .select('id')
            .single();

        if (avatarError) throw avatarError;
        const newAvatarId = avatarData.id;

        // 3. Update Profile
        const { error: profileError } = await sb
            .from('profiles')
            .update({ avatar_config_id: newAvatarId })
            .eq('id', currentUser.id);

        if (profileError) throw profileError;

        // 4. Sycn with Linked Players
        await syncAvatarWithPlayers(currentUser.id, newConfig, newAvatarId);

        currentAvatarConfig = newConfig;
        updateAvatarDisplay();
        avatarEditorModal.hide();
        alert('Avatar guardado correctamente y sincronizado.');
        location.reload();
    } catch (error) {
        console.error('Error saving avatar:', error);
        alert('Error al guardar el avatar: ' + error.message);
    }
});

async function syncAvatarWithPlayers(userId, newConfig, newAvatarId) {
    try {
        // Find team_members entries for this user where linked_player_id IS NOT NULL
        const { data: members, error } = await sb
            .from('team_members')
            .select('linked_player_id')
            .eq('user_id', userId)
            .not('linked_player_id', 'is', null);

        if (error || !members || members.length === 0) return;

        for (const member of members) {
            const playerId = member.linked_player_id;

            // Get current player avatar to preserve clothing?
            // Or just create NEW avatar config for player?
            // Logic: Merge user config + player clothing

            const { data: player, error: pError } = await sb
                .from('players')
                .select(`
                    id, 
                    avatar_config:avatar_config_id (*)
                `)
                .eq('id', playerId)
                .single();

            if (pError) continue;

            const playerConfig = player.avatar_config || {};

            // Map keys (camelCase from newConfig, snake_case from DB)
            // Just use newConfig values mostly, but preserve clothing
            // Since we save snake_case in DB, we need to construct payload carefully.

            const mergedPayload = {
                skin_color: newConfig.skinColor,
                top: newConfig.top,
                hair_color: newConfig.hairColor,
                hat_color: newConfig.hatColor,
                facial_hair_type: newConfig.facialHairType,
                facial_hair_color: newConfig.facialHairColor,
                eyes: newConfig.eyes,
                eyebrows: newConfig.eyebrows,
                mouth: newConfig.mouth,
                accessories_type: newConfig.accessoriesType,
                accessories_color: newConfig.accessoriesColor,

                // Preserve player specific clothing if exists, otherwise use user's
                clothing: playerConfig.clothing || newConfig.clothing,
                clothes_color: playerConfig.clothes_color || newConfig.clothesColor,
                clothing_graphic: playerConfig.clothing_graphic || newConfig.clothingGraphic
            };

            // Create new avatar config entry for player (or update existing?)
            // Creating new is safer to avoid shared reference issues if one changes
            const { data: newPlayerAvatar, error: paError } = await sb
                .from('avatar_configs')
                .insert(mergedPayload)
                .select('id')
                .single();

            if (!paError) {
                await sb.from('players')
                    .update({ avatar_config_id: newPlayerAvatar.id })
                    .eq('id', playerId);
            }
        }
    } catch (e) {
        console.error("Error syncing avatar:", e);
    }
}
