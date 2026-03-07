
// Logic for header, breadcrumbs, and theme

// Access Supabase client (initialized in supabase-config.js)
const sb = window.supabaseClient;
let uid = null;

// Determine if we are in the public subdirectory
const isPublic = window.location.pathname.includes('/public/');
const basePath = isPublic ? '../' : './';

// Carga el contenido de header.html dentro de #header-container
fetch(`${basePath}header.html`)
  .then(response => response.text())
  .then(html => {
    document.getElementById('header-container').innerHTML = html;
    inicializarAuth();

    // Update logo link based on context
    const logo = document.querySelector('.navbar-brand.logo');
    if (logo) {
      // Optional: adjust logo href
    }

    // Call breadcrumbs initially (for static/public pages)
    construirBreadcrumbDesdeParametros();

    // Initialize Theme
    initTheme();

    // Listen for auth changes
    sb.auth.onAuthStateChange((event, session) => {
      if (session) {
        uid = session.user.id;
        construirBreadcrumbDesdeParametros();
      } else {
        uid = null;
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
  const paramOwnerUid = params.get('ownerUid');

  const indexUrl = isPublic ? '../index.html' : 'index.html';
  const breadcrumbItems = [{ nombre: 'Inicio', url: indexUrl }];
  const path = window.location.pathname;

  // Check for legal pages and others
  const staticPages = {
    'about.html': 'Sobre Nosotros',
    'terms.html': 'Términos y Condiciones',
    'privacy.html': 'Política de Privacidad',
    'profile.html': 'Mi Perfil',
    'notifications.html': 'Notificaciones',
    'calendario.html': 'Calendario',
    'admin.html': 'Administración',
    'contact.html': 'Contacto'
  };

  for (const [page, name] of Object.entries(staticPages)) {
    if (path.includes(page)) {
      breadcrumbItems.push({ nombre: name, url: null });
      cont.innerHTML = renderBreadcrumbHTML(breadcrumbItems);
      return;
    }
  }

  if (path.includes('admin_stats.html')) {
    breadcrumbItems.push({ nombre: 'Administración', url: 'admin.html' });
    breadcrumbItems.push({ nombre: 'Estadísticas', url: null });
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
  if (!currentTeamId && globalPartidoId) {
    breadcrumbItems.push({ nombre: 'Partidos públicos', url: 'index.html' });

    // Fetch match name from public_matches (or equivalent view/table)
    // Assuming 'match_events' or 'matches' table holds global matches? Or a specific table?
    // User said "partidosGlobales". In Supabase schema, matches are in 'matches'.
    // public toggle on matches? Schema has `is_public` column?
    // Let's assume 'matches' table.

    const { data: partido } = await sb
      .from('matches')
      .select(`
            *,
            teams:team_id (name)
        `)
      .eq('id', globalPartidoId)
      .single();

    if (partido) {
      const nombreEquipo = partido.teams?.name || 'Equipo';
      const nombrePartido = `${nombreEquipo} vs ${partido.rival_name}`;
      breadcrumbItems.push({ nombre: nombrePartido, url: null });
    } else {
      breadcrumbItems.push({ nombre: 'Partido', url: null });
    }

    cont.innerHTML = renderBreadcrumbHTML(breadcrumbItems);
    return;
  }

  if (!currentTeamId) {
    if (isPublic) {
      breadcrumbItems.push({ nombre: 'Partidos públicos', url: null });
    }
    cont.innerHTML = renderBreadcrumbHTML(breadcrumbItems);
    return;
  }
  // -------------------------

  // --- PRIVATE/TEAM VIEW LOGIC ---
  if (!uid && !paramOwnerUid) {
    // Wait for auth? Or if paramOwnerUid is present use that.
    // If neither, render basic.
    cont.innerHTML = renderBreadcrumbHTML(breadcrumbItems);
    return;
  }

  const targetUid = paramOwnerUid || uid;
  const ownerParam = paramOwnerUid ? `&ownerUid=${encodeURIComponent(paramOwnerUid)}` : '';

  // Traer nombre equipo
  const { data: equipo } = await sb
    .from('teams')
    .select('name')
    .eq('id', currentTeamId)
    .single();

  const nombreEquipo = equipo ? equipo.name : 'Equipo desconocido';
  breadcrumbItems.push({ nombre: nombreEquipo, url: `${basePath}equipo.html?idEquipo=${currentTeamId}${ownerParam}` });

  if (!currentCompeticionId && !currrentJugadorId) {
    cont.innerHTML = renderBreadcrumbHTML(breadcrumbItems);
    return;
  }

  // Player view
  if (currrentJugadorId && !currentCompeticionId) {
    const { data: jugador } = await sb
      .from('players')
      .select('name')
      .eq('id', currrentJugadorId)
      .single();

    const nombreJugador = jugador ? jugador.name : 'Jugador';
    breadcrumbItems.push({ nombre: nombreJugador, url: null });
    cont.innerHTML = renderBreadcrumbHTML(breadcrumbItems);
    return;
  }

  // Traer nombre competición
  const { data: comp } = await sb
    .from('competitions')
    .select('name')
    .eq('id', currentCompeticionId)
    .single();

  const nombreCompeticion = comp ? comp.name : 'Competición desconocida';
  breadcrumbItems.push({ nombre: nombreCompeticion, url: `${basePath}competicion.html?idEquipo=${currentTeamId}&idCompeticion=${currentCompeticionId}${ownerParam}` });

  if (!currentPartidoId) {
    cont.innerHTML = renderBreadcrumbHTML(breadcrumbItems);
    return;
  }

  // Traer nombre partido
  const { data: partido } = await sb
    .from('matches')
    .select('rival_name')
    .eq('id', currentPartidoId)
    .single();

  const nombrePartido = partido ? partido.rival_name : 'Partido';
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

async function inicializarAuth() {
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const userInfo = document.getElementById('userInfo');
  const userDropdown = document.getElementById('userDropdown');
  const userAvatar = document.getElementById('userAvatar');

  // Load DiceBearManager
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

  if (loginBtn) {
    loginBtn.onclick = () => {
      window.location.href = `${basePath}login.html`;
    };
  }

  if (logoutBtn) {
    logoutBtn.onclick = async (e) => {
      e.preventDefault();
      await sb.auth.signOut();
      window.location.href = `${basePath}index.html`; // Redirect after Logout
    };
  }

  sb.auth.onAuthStateChange(async (event, session) => {
    const user = session?.user;

    if (user && loginBtn && userDropdown) {
      loginBtn.style.display = 'none';
      userDropdown.style.display = 'block';

      // Fix profile link
      const profileLink = document.querySelector('a[href="profile.html"]');
      if (profileLink) {
        profileLink.setAttribute('href', `${basePath}profile.html`);
        // Add Notifications link
        if (!document.querySelector(`a[href="${basePath}notifications.html"]`)) {
          const notifItem = document.createElement('li');
          notifItem.innerHTML = `<a class="dropdown-item" href="${basePath}notifications.html"><i class="bi bi-bell"></i> Notificaciones</a>`;
          profileLink.parentNode.parentNode.insertBefore(notifItem, profileLink.parentNode.nextSibling);
        }
      }

      // Load user profile data
      try {
        const { data: profile, error } = await sb
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profile) {
          userInfo.textContent = profile.display_name || profile.name || user.email;

          // Load avatar
          if (typeof DiceBearManager !== 'undefined') {
            const diceBearManager = new DiceBearManager();
            // Assuming avatar_url maps to avatarConfig logic or direct URL
            // Original used avatarConfig for DiceBear.
            // If Supabase profile has avatar_url (string), usage depends on if it's a URL or a seed.
            // Let's assume we store seed or config in metadata for now, or use avatar_url as img src directly if http.
            // For DiceBear compatibility, let's look for 'avatar_config' in profile if we added it, or user metadata.

            // Just use user email as seed if no config
            userAvatar.src = diceBearManager.getImageForProfile(user.id, null);
          }

          // Show Admin link
          if (profile.role === 'admin' || profile.is_admin) { // Check schema for admin flag. Assuming is_admin or role.
            // Schema check: profiles table has 'role' text default 'user'.
            if (profile.role === 'admin') {
              if (!document.querySelector(`a[href="${basePath}admin.html"]`)) {
                const adminLinkItem = document.createElement('li');
                adminLinkItem.innerHTML = `<a class="dropdown-item" href="${basePath}admin.html"><i class="bi bi-shield-lock"></i> Administrador</a>`;
                const dropdownMenu = document.querySelector('#userDropdown .dropdown-menu');
                const divider = dropdownMenu.querySelector('.dropdown-divider');
                if (divider) {
                  dropdownMenu.insertBefore(adminLinkItem, divider.closest('li'));
                } else {
                  dropdownMenu.appendChild(adminLinkItem);
                }
              }
            }
          }

          // Check for unread notifications
          sb
            .channel('header_notifications')
            .on('postgres_changes',
              { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
              () => updateNotificationBadge(user.id)
            )
            .subscribe();

          updateNotificationBadge(user.id);

          // Check for unread messages if admin
          if (profile.role === 'admin') {
            sb
              .channel('header_messages')
              .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_messages' }, () => updateAdminBadge())
              .subscribe();
            updateAdminBadge();
          }

        } else {
          // Profile missing?
          userInfo.textContent = user.email;
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
      }
    } else if (loginBtn && userDropdown) {
      loginBtn.style.display = 'inline';
      userDropdown.style.display = 'none';
      if (userInfo) userInfo.textContent = '';
    }
  });
}

async function updateNotificationBadge(userId) {
  const { count, error } = await sb
    .from('notifications')
    .select('*', { count: 'exact', head: true }) // count only
    .eq('user_id', userId)
    .eq('read', false);

  const existingBadge = document.getElementById('userNotifBadge');
  if (existingBadge) existingBadge.remove();

  if (count > 0) {
    const badge = document.createElement('span');
    badge.id = 'userNotifBadge';
    badge.className = 'position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle';
    badge.style.width = '12px';
    badge.style.height = '12px';

    const bellContainer = document.createElement('a');
    bellContainer.href = `${basePath}notifications.html`;
    bellContainer.className = 'btn btn-link nav-link position-relative me-3 text-white';
    bellContainer.innerHTML = '<i class="bi bi-bell-fill text-white" style="font-size: 1.2rem;"></i>';
    bellContainer.appendChild(badge);
    bellContainer.title = `${count} notificaciones nuevas`;

    const userDropdownContainer = document.getElementById('userDropdown');
    if (userDropdownContainer && userDropdownContainer.parentNode) {
      const existingBell = document.getElementById('userNotifBell');
      if (existingBell) existingBell.remove();
      bellContainer.id = 'userNotifBell';

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
}

async function updateAdminBadge() {
  const { count } = await sb
    .from('contact_messages')
    .select('*', { count: 'exact', head: true })
    .eq('read', false)
    .eq('archived', false);

  const existingBadge = document.getElementById('adminMsgBadge');
  if (existingBadge) existingBadge.remove();

  if (count > 0) {
    const badge = document.createElement('span');
    badge.id = 'adminMsgBadge';
    badge.className = 'position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle';
    badge.style.width = '12px';
    badge.style.height = '12px';

    const envelopeContainer = document.createElement('a');
    envelopeContainer.href = `${basePath}admin_messages.html`;
    envelopeContainer.className = 'btn btn-link nav-link position-relative me-3 text-white';
    envelopeContainer.innerHTML = '<i class="bi bi-envelope-fill" style="font-size: 1.2rem;"></i>';
    envelopeContainer.appendChild(badge);
    envelopeContainer.title = `${count} mensajes sin leer`;

    const userDropdownContainer = document.getElementById('userDropdown');
    if (userDropdownContainer && userDropdownContainer.parentNode) {
      const existingEnv = document.getElementById('adminMsgEnvelope');
      if (existingEnv) existingEnv.remove();
      envelopeContainer.id = 'adminMsgEnvelope';
      userDropdownContainer.parentNode.insertBefore(envelopeContainer, userDropdownContainer);
    }
  } else {
    const existingEnv = document.getElementById('adminMsgEnvelope');
    if (existingEnv) existingEnv.remove();
  }
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
