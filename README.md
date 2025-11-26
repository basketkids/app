# BasketKids 🏀

Aplicación web para gestión de equipos de baloncesto infantil. Gestiona equipos, jugadores, competiciones, partidos y estadísticas.

## 🚀 Características

### Gestión de Equipos
- Crear y gestionar múltiples equipos
- Configurar color de camiseta del equipo
- Avatares personalizables para jugadores con DiceBear
- Plantilla de jugadores con dorsales

### Gestión de Competiciones
- Crear competiciones para cada equipo
- Añadir equipos rivales
- Gestión de calendario de partidos
- **Importación masiva desde CSV**
- **Exportación a Google Calendar**

### Gestión de Partidos
- Crear partidos manualmente
- **Importar calendario completo desde archivo CSV**
- Ver partidos ordenados cronológicamente
- Cronómetro y marcador en tiempo real
- Estadísticas por jugador (puntos, rebotes, asistencias, tapones, robos, pérdidas, faltas)
- Registro de eventos del partido
- Partidos en casa/visitante con ubicación
- **Enlaces a Google Maps** para ubicaciones
- **Exportar partidos a calendario** (.ics o API directa)

### Consulta de Resultados
- Ver todos los partidos globales
- Filtrar por equipo
- Estadísticas Fantasy por jugador
- Clasificaciones y puntuaciones

## 📋 Requisitos

- Navegador web moderno (Chrome, Firefox, Safari, Edge)
- Servidor web local (ej: Live Server, http-server, Python SimpleHTTPServer)
- Cuenta de Firebase (Realtime Database)

## 🔧 Configuración

### 1. Configurar Firebase

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/)
2. Activa **Realtime Database**
3. Configura las reglas de seguridad:

```json
{
  "rules": {
    "usuarios": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "partidosGlobales": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

4. Activa **Authentication** con el proveedor de **Email/Password**
5. Copia las credenciales de tu proyecto
6. Edita `js/firebase-config.js` con tus credenciales:

```javascript
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROJECT.firebaseapp.com",
  databaseURL: "https://TU_PROJECT.firebaseio.com",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_PROJECT.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};
```

### 2. Servidor Local

Ejecuta un servidor web local en la carpeta del proyecto:

**Opción 1: Live Server (VS Code)**
```bash
# Instala la extensión Live Server en VS Code
# Clic derecho en index.html → "Open with Live Server"
```

**Opción 2: http-server (Node.js)**
```bash
npm install -g http-server
http-server -p 5500
```

**Opción 3: Python**
```bash
# Python 3
python -m http.server 5500

# Python 2
python -m SimpleHTTPServer 5500
```

Abre el navegador en `http://localhost:5500`

### 3. Crear Cuenta de Usuario

1. Ve a la página de registro
2. Crea una cuenta con email y contraseña
3. Inicia sesión

## 📤 Importar Calendario desde CSV

### Formato del CSV

El archivo CSV debe tener las siguientes columnas separadas por punto y coma (`;`):

```csv
equipo_rival;fecha;hora;ubicacion;resultado;JuegoDeLocal
CB FRESAS;07/11/2025;17:00;COLEGIO SALESIANOS;14-8;Si
SAFAUR;19/11/2025;17:30;COLEGIO SALESIANOS;12-10;Si
COLEGIO SANTA ANA;13/12/2025;17:00;COLEGIO SALESIANOS;;Si
```

**Columnas:**
- `equipo_rival` - Nombre del equipo rival
- `fecha` - Formato DD/MM/YYYY
- `hora` - Formato HH:MM
- `ubicacion` - Dirección del pabellón
- `resultado` - Formato XX-YY (vacío si no se ha jugado)
- `JuegoDeLocal` - "Si" para partidos en casa, "No" para visitante

### Importar

1. Ve a **Equipo → Competición → Partidos**
2. Clic en **"Importar Calendario CSV"**
3. Selecciona tu archivo CSV
4. La app procesará:
   - ✅ Creará rivales automáticamente si no existen
   - ✅ Importará partidos que no estén duplicados
   - ✅ Importará resultados de partidos ya jugados
   - ❌ Omitirá partidos duplicados (misma fecha/hora)

## 📅 Exportar a Google Calendar

### Método 1: Archivo .ics (Recomendado - Sin configuración)

1. Ve a **Equipo → Competición → Partidos**
2. Clic en **"Exportar Todos a Calendar"**
3. Se descarga un archivo `.ics`
4. Abre el archivo → se importan automáticamente todos los partidos

**Ventajas:**
- ✅ No requiere configuración
- ✅ Funciona con cualquier calendario (Google, Outlook, Apple)
- ✅ Importa todos los partidos a la vez

### Método 2: API Directa (Opcional - Requiere configuración)

Si quieres añadir eventos directamente sin descargar archivos:

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un proyecto y habilita **Google Calendar API**
3. Configura OAuth 2.0 consent screen
4. Crea credenciales:
   - **API Key**
   - **OAuth 2.0 Client ID** (tipo: Web application)
5. Edita `js/utils/CalendarHelper.js`:

```javascript
static GOOGLE_API_KEY = 'TU_API_KEY';
static GOOGLE_CLIENT_ID = 'TU_CLIENT_ID.apps.googleusercontent.com';
```

**Documentación detallada**: Ver archivo `google-calendar-setup.md`

## 🗺️ Google Maps

Las ubicaciones de los partidos son enlaces clicables que abren Google Maps automáticamente.

## 🏗️ Estructura del Proyecto

```
app/
├── index.html              # Página principal
├── registro.html           # Registro de usuarios
├── equipos.html           # Lista de equipos
├── equipo.html            # Gestión de equipo
├── competicion.html       # Gestión de competición
├── partidonew.html        # Partido en vivo
├── partido-global.html    # Vista pública de partido
├── consulta.html          # Consulta de resultados
├── jugadores.html         # Gestión de jugadores
├── css/
│   └── styles.css         # Estilos de la aplicación
├── js/
│   ├── firebase-config.js # Configuración de Firebase
│   ├── apps/              # Lógica de aplicaciones
│   │   ├── BaseApp.js
│   │   ├── TeamApp.js
│   │   ├── CompetitionApp.js
│   │   ├── PartidoApp.js
│   │   ├── PartidoGlobalApp.js
│   │   └── PlayerApp.js
│   ├── services/          # Servicios de datos
│   │   ├── TeamService.js
│   │   ├── PlayerService.js
│   │   ├── CompetitionService.js
│   │   └── MatchService.js
│   └── utils/             # Utilidades
│       ├── DiceBearManager.js  # Gestión de avatares
│       ├── CSVParser.js        # Parser de CSV
│       └── CalendarHelper.js   # Integración con Calendar
└── img/                   # Imágenes y favicon
```

## 🎮 Uso

### 1. Crear un Equipo
1. Inicia sesión
2. Clic en "Nuevo Equipo"
3. Introduce nombre y selecciona color de camiseta
4. Añade jugadores a la plantilla

### 2. Crear una Competición
1. Ve al equipo
2. Pestaña "Competiciones"
3. Clic en "Nueva Competición"
4. Añade rivales y partidos

### 3. Importar Calendario
1. Prepara un CSV con el formato indicado
2. En la competición → Pestaña "Partidos"
3. Clic en "Importar Calendario CSV"
4. Selecciona el archivo

### 4. Gestionar un Partido
1. Ve a la competición
2. Clic en el icono de edición del partido
3. Configura convocados y jugadores en pista
4. Inicia el cronómetro
5. Registra eventos (canastas, faltas, etc.)
6. Finaliza el partido

### 5. Exportar a Calendar
1. En la vista de partidos
2. **Individual**: Clic en 🗓️ de cada partido
3. **Todos**: Clic en "Exportar Todos a Calendar"

## 🔒 Seguridad

- Autenticación requerida para acceder a la aplicación
- Cada usuario solo ve sus propios equipos y datos
- Partidos globales visibles para usuarios autenticados
- Reglas de Firebase configuradas para acceso por usuario

## 🎨 Personalización

### Avatares de Jugadores
- Sistema de avatares con DiceBear
- Color de camiseta definido por equipo
- Personalización de pelo, cara y accesorios

### Colores
- Edita `css/styles.css` para cambiar el tema de colores
- Color de camiseta por equipo configurable

## 📱 PWA (Progressive Web App)

La aplicación incluye `manifest.json` y puede instalarse como PWA en dispositivos móviles:
1. Abre la app en Chrome móvil
2. Menú → "Añadir a pantalla de inicio"

## 🐛 Solución de Problemas

**Error: "DiceBearManager is not defined"**
- Solución: Verifica que `js/utils/DiceBearManager.js` esté incluido en el HTML

**No se cargan los datos**
- Verifica la configuración de Firebase en `firebase-config.js`
- Comprueba las reglas de seguridad en Firebase Console
- Verifica que estés autenticado

**Error al importar CSV**
- Verifica que el formato del CSV sea correcto (separado por `;`)
- Comprueba el formato de fechas (DD/MM/YYYY)
- Revisa la consola del navegador para más detalles

**Popups bloqueados al exportar**
- Permite popups para el sitio en la configuración del navegador

## 📄 Licencia

Este es un proyecto personal. Puedes usarlo y modificarlo libremente.

## 👨‍💻 Desarrollo

Desarrollado como herramienta de gestión para equipos de baloncesto infantil.

### Tecnologías
- HTML5, CSS3, JavaScript (ES6+)
- Firebase (Authentication + Realtime Database)
- Bootstrap 5
- Bootstrap Icons
- DiceBear Avatars API
- Google Calendar API (opcional)
- Google Maps

### Contribuir
Si encuentras algún bug o quieres sugerir mejoras, siéntete libre de crear un issue o pull request.

---

**¡Disfruta gestionando tu equipo de baloncesto! 🏀**