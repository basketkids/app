
firebase.initializeApp(window.firebaseConfig);
console.log("sfsfsd")
const params = new URLSearchParams(window.location.search);
const id = params.get('id');

if (!id) {
  alert('Faltan parámetros para cargar partido');
  window.location.href = 'index.html';
}

const dataService = new PartidosGlobalesDataService(firebase.database());
const app = new PartidosGlobalesApp(dataService);
// Pasa el id del partido global que quieres mostrar
app.cargarPartidoGlobal(id);









