let uid = null;
firebase.initializeApp(window.firebaseConfig);

const dbh = firebase.database();
const authh = firebase.auth();

// Determine if we are in the public subdirectory
const isPublic = window.location.pathname.includes('/public/');
const basePath = isPublic ? '../' : './';

// Carga el contenido de header.html dentro de #header-container
fetch(`${basePath}header.html`)
  .then(response => response.text())
  .then(html => {
    document.getElementById('header-container').innerHTML = html;
    inicializarAuth(); // Inicializa auth de firebase o lo que tengas para login/logout

    // Update logo link based on context
    const logo = document.querySelector('.navbar-brand.logo');
    if (logo) {
      // If in public, we might want to go back to root index or keep it as is if it's absolute
      // The original header.html has absolute link: https://BasketKids.github.io/app/
      // So we don't strictly need to change it, but if we wanted relative:
      // logo.href = `${basePath}index.html`;
    }

    // Call breadcrumbs initially (for static/public pages)
    construirBreadcrumbDesdeParametros();

    authh.onAuthStateChanged(user => {
      if (user) {
        uid = user.uid;
        construirBreadcrumbDesdeParametros();
      }
    });

  }).catch(console.error);

// Carga el contenido de footer.html dentro de #footer-container
fetch(`${basePath}footer.html`)
  .then(response => response.text())
  .then(html => {
    const footerContainer = document.getElementById('footer-container');
    if (footerContainer) {
      footerContainer.innerHTML = html;

      // Fix relative links in footer
      const footerLinks = footerContainer.querySelectorAll('a');
      footerLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && !href.startsWith('http') && !href.startsWith('mailto:') && !href.startsWith('#')) {
          link.setAttribute('href', basePath + href);
        }
      });
    }
  }).catch(console.error);

async function construirBreadcrumbDesdeParametros() {
  const cont = document.getElementById('breadcrumb-container');
  if (!cont) return;

  const params = new URLSearchParams(window.location.search);
  const currentTeamId = params.get('idEquipo');
  const currentCompeticionId = params.get('idCompeticion');
  const currentPartidoId = params.get('idPartido');
  const currrentJugadorId = params.get('idJugador');
  const globalPartidoId = params.get('id'); // For global matches in public view

  const indexUrl = isPublic ? '../index.html' : 'index.html';
  const breadcrumbItems = [{ nombre: 'Inicio', url: indexUrl }];
  const path = window.location.pathname;

  // Check for legal pages
  if (path.includes('about.html')) {
    breadcrumbItems.push({ nombre: 'Sobre Nosotros', url: null });
    cont.innerHTML = renderBreadcrumbHTML(breadcrumbItems);
    return;
  }
  if (path.includes('terms.html')) {
    breadcrumbItems.push({ nombre: 'Términos y Condiciones', url: null });
    cont.innerHTML = renderBreadcrumbHTML(breadcrumbItems);
    return;
  }
  if (path.includes('privacy.html')) {
    breadcrumbItems.push({ nombre: 'Política de Privacidad', url: null });
    cont.innerHTML = renderBreadcrumbHTML(breadcrumbItems);
    return;
  }
  if (path.includes('profile.html')) {
    breadcrumbItems.push({ nombre: 'Mi Perfil', url: null });
    cont.innerHTML = renderBreadcrumbHTML(breadcrumbItems);
    return;
  }

  // Check if we're on the calendario page
  if (path.includes('calendario.html')) {
    breadcrumbItems.push({ nombre: 'Calendario', url: null });
    cont.innerHTML = renderBreadcrumbHTML(breadcrumbItems);
    return;
  }

  // Check for admin pages
  if (path.includes('admin.html')) {
    breadcrumbItems.push({ nombre: 'Administración', url: null });
    cont.innerHTML = renderBreadcrumbHTML(breadcrumbItems);
    return;
  }

  if (path.includes('admin_stats.html')) {
    breadcrumbItems.push({ nombre: 'Administración', url: 'admin.html' });
    breadcrumbItems.push({ nombre: 'Estadísticas', url: null });
    cont.innerHTML = renderBreadcrumbHTML(breadcrumbItems);
    return;
  }

  if (path.includes('contact.html')) {
    breadcrumbItems.push({ nombre: 'Contacto', url: null });
    cont.innerHTML = renderBreadcrumbHTML(breadcrumbItems);
    return;
  }

  if (path.includes('admin_messages.html')) {
    breadcrumbItems.push({ nombre: 'Administración', url: 'admin.html' });
    breadcrumbItems.push({ nombre: 'Mensajes', url: null });
    cont.innerHTML = renderBreadcrumbHTML(breadcrumbItems);
    return;
  }

  // --- PUBLIC VIEW LOGIC ---
  // Check if we're viewing a global match (no teamId, but has partido id)
  if (!currentTeamId && globalPartidoId) {
    breadcrumbItems.push({ nombre: 'Partidos públicos', url: 'index.html' });

    // Fetch match name from partidosGlobales
    const partidoSnap = await dbh.ref(`partidosGlobales/${globalPartidoId}`).once('value');
    if (partidoSnap.exists()) {
      const partido = partidoSnap.val();
      const nombrePartido = `${partido.nombreEquipo} vs ${partido.nombreRival}`;
      breadcrumbItems.push({ nombre: nombrePartido, url: null });
    } else {
      breadcrumbItems.push({ nombre: 'Partido', url: null });
    }

    cont.innerHTML = renderBreadcrumbHTML(breadcrumbItems);
    return;
  }

  if (!currentTeamId) {
    // Solo inicio si no viene equipo
    // If in public folder and no team, assume public matches list
    if (isPublic) {
      breadcrumbItems.push({ nombre: 'Partidos públicos', url: null });
    }
    cont.innerHTML = renderBreadcrumbHTML(breadcrumbItems);
    return;
  }
  // -------------------------

  // --- PRIVATE/TEAM VIEW LOGIC ---

  // Check if user is authenticated before accessing private data
  if (!uid) {
    // User not authenticated yet, show basic breadcrumb
    cont.innerHTML = renderBreadcrumbHTML(breadcrumbItems);
    return;
  }

  // Traer nombre equipo
  const equipoSnap = await dbh.ref(`usuarios/${uid}/equipos/${currentTeamId}/nombre`).once('value');
  const nombreEquipo = equipoSnap.exists() ? equipoSnap.val() : 'Equipo desconocido';
  breadcrumbItems.push({ nombre: nombreEquipo, url: `${basePath}equipo.html?idEquipo=${currentTeamId}` });

  if (!currentCompeticionId && !currrentJugadorId) {
    cont.innerHTML = renderBreadcrumbHTML(breadcrumbItems);
    return;
  }

  // If we have a player but no competition, handle player view
  if (currrentJugadorId && !currentCompeticionId) {
    const jugadorSnap = await dbh.ref(`usuarios/${uid}/equipos/${currentTeamId}/plantilla/${currrentJugadorId}/nombre`).once('value');
    const nombreJugador = jugadorSnap.exists() ? jugadorSnap.val() : 'Jugador';
    breadcrumbItems.push({ nombre: nombreJugador, url: null });
    cont.innerHTML = renderBreadcrumbHTML(breadcrumbItems);
    return;
  }

  // Traer nombre competición
  const compSnap = await dbh.ref(`usuarios/${uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/nombre`).once('value');
  const nombreCompeticion = compSnap.exists() ? compSnap.val() : 'Competición desconocida';
  breadcrumbItems.push({ nombre: nombreCompeticion, url: `${basePath}competicion.html?idEquipo=${currentTeamId}&idCompeticion=${currentCompeticionId}` });

  if (!currentPartidoId) {
    cont.innerHTML = renderBreadcrumbHTML(breadcrumbItems);
    return;
  }

  // Traer nombre partido
  const partidoSnap = await dbh.ref(`usuarios/${uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/partidos/${currentPartidoId}/rival`).once('value');
  const nombrePartido = partidoSnap.exists() ? partidoSnap.val() : 'Partido';
  breadcrumbItems.push({ nombre: nombrePartido, url: null });

  cont.innerHTML = renderBreadcrumbHTML(breadcrumbItems);
}

function renderBreadcrumbHTML(items) {
  let html = '<nav aria-label="breadcrumb"><ol class="breadcrumb">';
  items.forEach((item, i) => {
    if (i === items.length - 1 || !item.url) {
      html += `<li class="breadcrumb-item active" aria-current="page">${item.nombre}</li>`;
    } else {
      html += `<li class="breadcrumb-item"><a class="" href="${item.url}">${item.nombre}</a></li>`;
    }
  });
  html += '</ol></nav>';
  return html;
}


// Ejemplo función para inicializar Firebase Auth en header (ajustar según tu código)
// Ejemplo función para inicializar Firebase Auth en header (ajustar según tu código)
async function inicializarAuth() {
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const userInfo = document.getElementById('userInfo');
  const userDropdown = document.getElementById('userDropdown');
  const userAvatar = document.getElementById('userAvatar');

  // Load DiceBearManager script if not already loaded
  if (typeof DiceBearManager === 'undefined') {
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `${basePath}js/utils/DiceBearManager.js`;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    } catch (error) {
      console.error('Error loading DiceBearManager:', error);
    }
  }

  loginBtn.onclick = () => {
    window.location.href = `${basePath}login.html`;
  };

  logoutBtn.onclick = (e) => {
    e.preventDefault();
    firebase.auth().signOut();
  };

  firebase.auth().onAuthStateChanged(async user => {
    if (user) {
      loginBtn.style.display = 'none';
      userDropdown.style.display = 'block';

      // Load user profile data
      try {
        const profileSnap = await dbh.ref(`usuarios/${user.uid}/profile`).once('value');
        const profile = profileSnap.val();

        if (profile) {
          userInfo.textContent = profile.displayName || profile.nombre || user.email;

          // Load avatar
          if (typeof DiceBearManager !== 'undefined') {
            const diceBearManager = new DiceBearManager();
            if (profile.avatarConfig) {
              userAvatar.src = diceBearManager.getImageForProfile(user.uid, profile.avatarConfig);
            } else {
              // Default avatar
              userAvatar.src = diceBearManager.getImageForProfile(user.uid, null);
            }
          }

          // Show Admin link if user is admin
          // Show Admin link if user is admin
          if (profile.admin) {
            // Check if link already exists to avoid duplicates
            if (!document.querySelector(`a[href="${basePath}admin.html"]`)) {
              const adminLinkItem = document.createElement('li');
              adminLinkItem.innerHTML = `<a class="dropdown-item" href="${basePath}admin.html"><i class="bi bi-shield-lock"></i> Administrador</a>`;
              const dropdownMenu = document.querySelector('#userDropdown .dropdown-menu');

              // Find the divider
              const divider = dropdownMenu.querySelector('.dropdown-divider');
              if (divider) {
                // The divider is inside an LI, so we need to insert before that LI
                const dividerItem = divider.closest('li');
                if (dividerItem) {
                  dropdownMenu.insertBefore(adminLinkItem, dividerItem);
                }
              } else {
                // If no divider, insert before the last child (logout)
                const logoutItem = dropdownMenu.querySelector('#logoutBtn').closest('li');
                if (logoutItem) {
                  dropdownMenu.insertBefore(adminLinkItem, logoutItem);
                } else {
                  dropdownMenu.appendChild(adminLinkItem); // Fallback
                }
              }
            }
          }

          // Sync data if missing (e.g. email)
          if (!profile.email || (!profile.nombre && !profile.displayName)) {
            const updates = {};
            if (!profile.email) updates.email = user.email;
            if (!profile.nombre && !profile.displayName) {
              updates.nombre = user.displayName || user.email.split('@')[0];
              updates.displayName = user.displayName || user.email.split('@')[0];
            }
            if (Object.keys(updates).length > 0) {
              dbh.ref(`usuarios/${user.uid}/profile`).update(updates);
            }
          }

          // Check for unread messages if admin
          if (profile.admin) {
            dbh.ref('contact_messages').on('value', snapshot => {
              let unreadCount = 0;
              snapshot.forEach(child => {
                const val = child.val();
                if (!val.read && !val.archived) {
                  unreadCount++;
                }
              });

              // Remove existing notification if any
              const existingBadge = document.getElementById('adminMsgBadge');
              if (existingBadge) existingBadge.remove();

              if (unreadCount > 0) {
                const badge = document.createElement('span');
                badge.id = 'adminMsgBadge';
                badge.className = 'position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle';
                badge.style.width = '12px';
                badge.style.height = '12px';

                // Container for the envelope
                const envelopeContainer = document.createElement('a');
                envelopeContainer.href = `${basePath}admin_messages.html`;
                envelopeContainer.className = 'btn btn-link nav-link position-relative me-3 text-white';
                envelopeContainer.innerHTML = '<i class="bi bi-envelope-fill" style="font-size: 1.2rem;"></i>';
                envelopeContainer.appendChild(badge);
                envelopeContainer.title = `${unreadCount} mensajes sin leer`;

                // Insert before user dropdown
                const userDropdownContainer = document.getElementById('userDropdown');
                if (userDropdownContainer && userDropdownContainer.parentNode) {
                  // Check if we already added it
                  const existingEnv = document.getElementById('adminMsgEnvelope');
                  if (existingEnv) existingEnv.remove();

                  envelopeContainer.id = 'adminMsgEnvelope';
                  userDropdownContainer.parentNode.insertBefore(envelopeContainer, userDropdownContainer);
                }
              } else {
                const existingEnv = document.getElementById('adminMsgEnvelope');
                if (existingEnv) existingEnv.remove();
              }
            });
          }

        } else {
          // If no profile data, use user.email
          userInfo.textContent = user.displayName || user.email;

          // Create profile with basic info
          dbh.ref(`usuarios/${user.uid}/profile`).set({
            email: user.email,
            nombre: user.displayName || user.email.split('@')[0],
            displayName: user.displayName || user.email.split('@')[0]
          });

          // Default avatar
          if (typeof DiceBearManager !== 'undefined') {
            const diceBearManager = new DiceBearManager();
            userAvatar.src = diceBearManager.getImageForProfile(user.uid, null);
          }
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
        userInfo.textContent = user.displayName || user.email;
        // Default avatar on error
        if (typeof DiceBearManager !== 'undefined') {
          const diceBearManager = new DiceBearManager();
          userAvatar.src = diceBearManager.getImageForProfile(user.uid, null);
        }
      }
    } else {
      loginBtn.style.display = 'inline';
      userDropdown.style.display = 'none';
      userInfo.textContent = '';
    }
  });
}
