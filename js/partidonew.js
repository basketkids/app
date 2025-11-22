document.addEventListener('DOMContentLoaded', () => {
    firebase.initializeApp(window.firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.database();
  
    auth.onAuthStateChanged(async user => {
      if (!user) {
        alert('Debes iniciar sesión para acceder');
        return;
      }
      const userId = user.uid; // Obtener solo el uid
  
      const urlSearchParams = new URLSearchParams(window.location.search);
      const teamId = urlSearchParams.get('idEquipo');
      const competitionId = urlSearchParams.get('idCompeticion');
      const matchId = urlSearchParams.get('idPartido');
  
      if (!teamId || !competitionId || !matchId) {
        alert('Faltan parámetros en la URL');
        return;
      }
  
      const dataService = new DataService(db, userId, teamId, competitionId, matchId);
      const app = new PartidoApp(dataService);
      await app.init();
    });
  });
  