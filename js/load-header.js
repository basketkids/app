// Carga el contenido de header.html dentro de #header-container
fetch('header.html')
  .then(response => response.text())
  .then(html => {
    document.getElementById('header-container').innerHTML = html;
    inicializarAuth(); // Inicializa auth de firebase o lo que tengas para login/logout
    actualizarBreadcrumb();
  }).catch(console.error);

// Función para actualizar breadcrumb dinámicamente según la página
function actualizarBreadcrumb() {
  const breadcrumbCurrent = document.getElementById('breadcrumb-current');
  // Puedes personalizar según URL o alguna variable global
  const path = window.location.pathname.split('/').pop();

  const mapping = {
    'index.html': 'Home',
    'equipo.html': 'Gestión de equipo',
    'partido.html': 'Estadísticas partido'
  };

  breadcrumbCurrent.textContent = mapping[path] || 'Página';
}

// Ejemplo función para inicializar Firebase Auth en header (ajustar según tu código)
function inicializarAuth() {
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const userInfo = document.getElementById('userInfo');

  loginBtn.onclick = () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider).catch(console.error);
  };
  logoutBtn.onclick = () => firebase.auth().signOut();

  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      loginBtn.style.display = 'none';
      logoutBtn.style.display = 'inline';
      userInfo.textContent = `Hola, ${user.displayName || user.email}`;
    } else {
      loginBtn.style.display = 'inline';
      logoutBtn.style.display = 'none';
      userInfo.textContent = '';
    }
  });
}
