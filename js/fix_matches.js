firebase.initializeApp(window.firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

const btnStart = document.getElementById('btnStart');
const authStatus = document.getElementById('auth-status');
const logDiv = document.getElementById('log');
const progressBar = document.getElementById('progressBar');

function log(msg) {
    const p = document.createElement('div');
    p.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logDiv.appendChild(p);
    logDiv.scrollTop = logDiv.scrollHeight;
}

auth.onAuthStateChanged(user => {
    if (user) {
        authStatus.className = 'alert alert-success';
        authStatus.textContent = `Autenticado como: ${user.email}`;
        btnStart.disabled = false;
    } else {
        authStatus.className = 'alert alert-warning';
        authStatus.textContent = 'No estás autenticado. Por favor inicia sesión en la aplicación principal primero.';
        btnStart.disabled = true;
    }
});

btnStart.addEventListener('click', async () => {
    btnStart.disabled = true;
    log('Iniciando proceso...');

    try {
        const uid = auth.currentUser.uid;
        log(`Leyendo datos del usuario actual (${uid})...`);

        // 1. Fetch only current user
        const snapshot = await db.ref(`usuarios/${uid}`).once('value');

        if (!snapshot.exists()) {
            log('No se encontraron datos para este usuario.');
            return;
        }

        const updates = {};
        let totalMatches = 0;
        let processedMatches = 0;

        const userData = snapshot.val();
        const equipos = userData.equipos;

        // First pass: count matches
        if (equipos) {
            Object.values(equipos).forEach(equipo => {
                if (equipo.competiciones) {
                    Object.values(equipo.competiciones).forEach(comp => {
                        if (comp.partidos) {
                            totalMatches += Object.keys(comp.partidos).length;
                        }
                    });
                }
            });
        }

        log(`Encontrados ${totalMatches} partidos para este usuario.`);

        // Second pass: process
        if (equipos) {
            Object.entries(equipos).forEach(([equipoId, equipo]) => {
                if (equipo.competiciones) {
                    Object.entries(equipo.competiciones).forEach(([compId, comp]) => {
                        if (comp.partidos) {
                            Object.entries(comp.partidos).forEach(([partidoId, partido]) => {

                                // Prepare data for global node
                                const globalData = { ...partido };

                                // Inject IDs
                                globalData.equipoId = equipoId;
                                globalData.competicionId = compId;

                                // Add to multi-path update
                                updates[`partidosGlobales/${partidoId}`] = globalData;

                                processedMatches++;
                                const pct = totalMatches > 0 ? Math.round((processedMatches / totalMatches) * 100) : 100;
                                progressBar.style.width = `${pct}%`;
                                progressBar.textContent = `${pct}%`;
                            });
                        }
                    });
                }
            });
        }

        log(`Preparando actualización de ${Object.keys(updates).length} entradas...`);

        await db.ref().update(updates);

        log('¡Actualización completada con éxito!');
        progressBar.className = 'progress-bar bg-success';

    } catch (error) {
        console.error(error);
        log(`ERROR: ${error.message}`);
        progressBar.className = 'progress-bar bg-danger';
    } finally {
        btnStart.disabled = false;
    }
});
