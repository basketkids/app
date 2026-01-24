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

    // Check if we need to update branding based on URL params
    const params = new URLSearchParams(window.location.search);
    const teamId = params.get('idEquipo');
    const ownerUid = params.get('ownerUid') || uid; // uid might be null here if not auth yet, but we check auth later. 
    // Actually, to fetch team sport we need to know OWNER. If looking at own team, we wait for auth.

    // But we can trigger it inside auth change or if we have ownerUid param (public view/shared link)

    if (logo) {
      // If in public, we might want to go back to root index or keep it as is if it's absolute
      // The original header.html has absolute link: https://app.basketkids.org/
      // So we don't strictly need to change it, but if we wanted relative:
      // logo.href = `${basePath}index.html`;
    }

    // Call breadcrumbs initially (for static/public pages)
    construirBreadcrumbDesdeParametros();

    // Initialize Theme
    initTheme();

    authh.onAuthStateChanged(user => {
      if (user) {
        uid = user.uid;
        uid = user.uid;
        construirBreadcrumbDesdeParametros();
        updateBranding();
      }
    });

    if (params.get('ownerUid') && teamId) {
      // If we have explicit owner (e.g. public view), we can try updating branding immediately
      updateBranding(params.get('ownerUid'), teamId);
    }

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
  const paramOwnerUid = params.get('ownerUid');

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
  if (path.includes('notifications.html')) {
    breadcrumbItems.push({ nombre: 'Notificaciones', url: null });
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

  // Determine target UID (owner or current user)
  const targetUid = paramOwnerUid || uid;
  const ownerParam = paramOwnerUid ? `&ownerUid=${encodeURIComponent(paramOwnerUid)}` : '';

  // Traer nombre equipo
  const equipoSnap = await dbh.ref(`usuarios/${targetUid}/equipos/${currentTeamId}/nombre`).once('value');
  const nombreEquipo = equipoSnap.exists() ? equipoSnap.val() : 'Equipo desconocido';
  breadcrumbItems.push({ nombre: nombreEquipo, url: `${basePath}equipo.html?idEquipo=${currentTeamId}${ownerParam}` });

  if (!currentCompeticionId && !currrentJugadorId) {
    cont.innerHTML = renderBreadcrumbHTML(breadcrumbItems);
    return;
  }

  // If we have a player but no competition, handle player view
  if (currrentJugadorId && !currentCompeticionId) {
    const jugadorSnap = await dbh.ref(`usuarios/${targetUid}/equipos/${currentTeamId}/plantilla/${currrentJugadorId}/nombre`).once('value');
    const nombreJugador = jugadorSnap.exists() ? jugadorSnap.val() : 'Jugador';
    breadcrumbItems.push({ nombre: nombreJugador, url: null });
    cont.innerHTML = renderBreadcrumbHTML(breadcrumbItems);
    return;
  }

  // Traer nombre competición
  const compSnap = await dbh.ref(`usuarios/${targetUid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/nombre`).once('value');
  const nombreCompeticion = compSnap.exists() ? compSnap.val() : 'Competición desconocida';
  breadcrumbItems.push({ nombre: nombreCompeticion, url: `${basePath}competicion.html?idEquipo=${currentTeamId}&idCompeticion=${currentCompeticionId}${ownerParam}` });

  if (!currentPartidoId) {
    cont.innerHTML = renderBreadcrumbHTML(breadcrumbItems);
    return;
  }

  // Traer nombre partido
  const partidoSnap = await dbh.ref(`usuarios/${targetUid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/partidos/${currentPartidoId}/rival`).once('value');
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

  // Load SportConfig script if not already loaded
  if (typeof SportConfig === 'undefined') {
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `${basePath}js/utils/SportConfig.js`;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    } catch (error) {
      console.error('Error loading SportConfig:', error);
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

      // Fix profile link and add notifications link
      const profileLink = document.querySelector('a[href="profile.html"]');
      if (profileLink) {
        // Fix profile link path
        profileLink.setAttribute('href', `${basePath}profile.html`);

        // Add Notifications link if not exists
        if (!document.querySelector(`a[href="${basePath}notifications.html"]`)) {
          const notifItem = document.createElement('li');
          notifItem.innerHTML = `<a class="dropdown-item" href="${basePath}notifications.html"><i class="bi bi-bell"></i> Notificaciones</a>`;
          profileLink.parentNode.parentNode.insertBefore(notifItem, profileLink.parentNode.nextSibling);
        }
      }

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

          // Check for unread notifications (for all users, not just admin)
          dbh.ref(`usuarios/${user.uid}/notifications`).on('value', snapshot => {
            let unreadCount = 0;
            snapshot.forEach(child => {
              const val = child.val();
              if (!val.read) {
                unreadCount++;
              }
            });

            // Remove existing notification if any
            const existingBadge = document.getElementById('userNotifBadge');
            if (existingBadge) existingBadge.remove();

            if (unreadCount > 0) {
              const badge = document.createElement('span');
              badge.id = 'userNotifBadge';
              badge.className = 'position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle';
              badge.style.width = '12px';
              badge.style.height = '12px';

              // Container for the bell
              const bellContainer = document.createElement('a');
              bellContainer.href = `${basePath}notifications.html`; // Go to notifications page
              bellContainer.className = 'btn btn-link nav-link position-relative me-3 text-white';
              bellContainer.innerHTML = '<i class="bi bi-bell-fill text-white" style="font-size: 1.2rem;"></i>';
              bellContainer.appendChild(badge);
              bellContainer.title = `${unreadCount} notificaciones nuevas`;

              // Insert before user dropdown (and before admin envelope if exists)
              const userDropdownContainer = document.getElementById('userDropdown');
              if (userDropdownContainer && userDropdownContainer.parentNode) {
                // Check if we already added it
                const existingBell = document.getElementById('userNotifBell');
                if (existingBell) existingBell.remove();

                bellContainer.id = 'userNotifBell';

                // If admin envelope exists, insert before it, otherwise before dropdown
                const adminEnvelope = document.getElementById('adminMsgEnvelope');
                if (adminEnvelope) {
                  userDropdownContainer.parentNode.insertBefore(bellContainer, adminEnvelope);
                } else {
                  userDropdownContainer.parentNode.insertBefore(bellContainer, userDropdownContainer);
                }
              }
            } else {
              const existingBell = document.getElementById('userNotifBell');
              if (existingBell) existingBell.remove();
            }
          });

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

function initTheme() {
  const themeToggle = document.getElementById('themeToggle');
  if (!themeToggle) return;

  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  themeToggle.onclick = () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
  };
}

function updateThemeIcon(theme) {
  const icon = document.querySelector('#themeToggle i');
  if (icon) {
    icon.className = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-stars';
  }
}


async function updateBranding(explicitOwner, explicitTeam) {
    if (typeof SportConfig === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const teamId = explicitTeam || params.get('idEquipo');
    // If we have explicit owner, use it. Otherwise use current auth uid if available.
    let targetUid = explicitOwner || params.get('ownerUid') || uid;

    if (!teamId || !targetUid) return;

    try {
        const snap = await dbh.ref(`usuarios/${targetUid}/equipos/${teamId}/sport`).once('value');
        const sport = snap.val() || 'basketball'; // Default to basketball
        const config = SportConfig[sport];

        if (config) {
            const logo = document.querySelector('.navbar-brand.logo');
            if (logo) {
                // Determine icon HTML
                const iconHtml = config.icon.startsWith('bi-') ? `<i class="bi ${config.icon}"></i>` : `<img src="${config.icon}" alt="logo" height="24">`;
                logo.innerHTML = `${iconHtml} ${config.appName}`;
                
                // Update styling if needed (e.g. volleyball specific colors)
                // document.documentElement.style.setProperty('--primary-color', ...);
            }
        }
    } catch (e) {
        console.error('Error updating branding:', e);
    }
}
