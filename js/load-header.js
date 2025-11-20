
let uid = null;
firebase.initializeApp(window.firebaseConfig);

const dbh = firebase.database();
const authh = firebase.auth();

// Carga el contenido de header.html dentro de #header-container
fetch('header.html')
  .then(response => response.text())
  .then(html => {
    document.getElementById('header-container').innerHTML = html;
    inicializarAuth(); // Inicializa auth de firebase o lo que tengas para login/logout


    authh.onAuthStateChanged(user => {
      if (user) {
        uid = user.uid;
        console.log(uid)
        construirBreadcrumbDesdeParametros();
      }
    
    });
   

  }).catch(console.error);



  async function construirBreadcrumbDesdeParametros() {
    console.log("sdfsfsd");
    const cont = document.getElementById('breadcrumb-container');
    if (!cont) return;
  
    const params = new URLSearchParams(window.location.search);
    const currentTeamId = params.get('idEquipo');
    const currentCompeticionId = params.get('idCompeticion');
    const currentPartidoId = params.get('idPartido');
    const currrentJugadorId= params.get('idJugador');
    const breadcrumbItems = [{ nombre: 'Inicio', url: '/' }];
  
    if (!currentTeamId) {
      // Solo inicio si no viene equipo
      cont.innerHTML = renderBreadcrumbHTML(breadcrumbItems);
      return;
    }
  
    // Traer nombre equipo
    const equipoSnap = await dbh.ref(`usuarios/${uid}/equipos/${currentTeamId}/nombre`).once('value');
    const nombreEquipo = equipoSnap.exists() ? equipoSnap.val() : 'Equipo desconocido';
    breadcrumbItems.push({ nombre: nombreEquipo, url: `equipo.html?idEquipo=${currentTeamId}` });
  

    
    if (!currentCompeticionId) {
      cont.innerHTML = renderBreadcrumbHTML(breadcrumbItems);
      return;
    }
  
    
    // Traer nombre competición
    console.log("uid:" + uid);
    const compSnap = await dbh.ref(`usuarios/${uid}/equipos/${currentTeamId}/competiciones/${currentCompeticionId}/nombre`).once('value');
    const nombreCompeticion = compSnap.exists() ? compSnap.val() : 'Competición desconocida';
    breadcrumbItems.push({ nombre: nombreCompeticion, url: `competicion.html?idEquipo=${currentTeamId}&idCompeticion=${currentCompeticionId}` });
  
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
        html += `<li class="breadcrumb-item"><a href="${item.url}">${item.nombre}</a></li>`;
      }
    });
    html += '</ol></nav>';
    return html;
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
