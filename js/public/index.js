

firebase.initializeApp(window.firebaseConfig);
const db = firebase.database();

// Initialize services
const calendarService = new CalendarService(db);

let currentWeekStart = null;
let allMatches = [];
let weekMatches = {};

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  currentWeekStart = calendarService.getCurrentWeekStart();
  setupEventListeners();
  await loadMatches();
}

function setupEventListeners() {
  document.getElementById('prevWeekBtn').addEventListener('click', () => navigateWeek(-1));
  document.getElementById('nextWeekBtn').addEventListener('click', () => navigateWeek(1));
  document.getElementById('todayBtn').addEventListener('click', () => goToToday());
}

async function loadMatches() {
  showLoading();
  try {
    const snapshot = await db.ref('partidosGlobales').once('value');
    if (snapshot.exists()) {
      allMatches = [];
      snapshot.forEach(child => {
        allMatches.push({
          id: child.key,
          ...child.val()
        });
      });

      // Sort by date
      allMatches.sort((a, b) => {
        return new Date(a.fechaHora) - new Date(b.fechaHora);
      });
    } else {
      allMatches = [];
    }
    renderCalendar();
  } catch (error) {
    console.error('Error loading matches:', error);
    alert('Error al cargar los partidos');
  } finally {
    hideLoading();
  }
}

function navigateWeek(direction) {
  const newWeekStart = new Date(currentWeekStart);
  newWeekStart.setDate(newWeekStart.getDate() + (direction * 7));
  currentWeekStart = newWeekStart;
  renderCalendar();
}

function goToToday() {
  currentWeekStart = calendarService.getCurrentWeekStart();
  renderCalendar();
}

function renderCalendar() {
  weekMatches = calendarService.getMatchesForWeek(allMatches, currentWeekStart);

  // Update week display
  const weekRange = calendarService.formatWeekRange(currentWeekStart);
  document.getElementById('weekRange').textContent = weekRange;

  // Render each day
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  days.forEach((day, index) => {
    const dayDate = new Date(currentWeekStart);
    dayDate.setDate(dayDate.getDate() + index);

    const isToday = dayDate.getTime() === today.getTime();
    // The HTML structure has changed, we need to target the matches container within the day column
    const dayColumn = document.getElementById(`${day}Matches`);
    const matchesContainer = dayColumn.querySelector('.matches-container');
    const dayHeader = dayColumn.querySelector('.card-header');
    const dayNumberSpan = dayHeader.querySelector('.day-number');

    // Update day number
    dayNumberSpan.textContent = dayDate.getDate();

    // Highlight today
    if (isToday) {
      dayHeader.classList.remove('bg-primary');
      dayHeader.classList.add('bg-warning', 'text-dark');
      dayHeader.classList.remove('text-white');
    } else {
      dayHeader.classList.add('bg-primary', 'text-white');
      dayHeader.classList.remove('bg-warning', 'text-dark');
    }

    renderDay(dayColumn, matchesContainer, weekMatches[day]);
  });

  // Count visible days (days with matches)
  const visibleDays = days.filter(day => weekMatches[day].length > 0).length;

  // Adjust grid columns based on visible days
  // Note: Bootstrap grid classes handle responsiveness, but we can add custom logic if needed.
  // For now, we'll let the CSS grid/flex layout handle it or just hide empty days if desired.
  // To match CalendarApp behavior of hiding empty days:
  days.forEach(day => {
    const dayColumn = document.getElementById(`${day}Matches`);
    if (weekMatches[day].length === 0) {
      dayColumn.style.display = 'none';
    } else {
      dayColumn.style.display = 'block';
    }
  });
}

function renderDay(dayColumn, container, matches) {
  container.innerHTML = '';

  if (matches.length === 0) {
    return;
  }

  matches.forEach(match => {
    const matchCard = createMatchCard(match);
    container.appendChild(matchCard);
  });
}

function createMatchCard(partido) {
  const card = document.createElement('div');
  card.className = 'match-card p-2 mb-2 border rounded shadow-sm bg-white';

  const fechaObj = new Date(partido.fechaHora);
  const time = fechaObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  const nombreEquipo = partido.nombreEquipo;
  const local = partido.esLocal ? nombreEquipo : partido.nombreRival || 'Rival';
  const visitante = partido.esLocal ? (partido.nombreRival || 'Rival') : nombreEquipo;

  // Location
  const locationLink = partido.pabellon
    ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(partido.pabellon)}" 
              target="_blank" 
              onclick="event.stopPropagation()" 
              class="text-decoration-none text-muted" style="font-size: 0.85em;">
              <i class="bi bi-geo-alt"></i> ${partido.pabellon}
           </a>`
    : '<span class="text-muted" style="font-size: 0.85em;">Sin ubicación</span>';

  // Status Icon
  let iconHtml = '';
  switch (partido.estado) {
    case 'pendiente':
      iconHtml = '<i class="bi bi-clock text-secondary" title="Pendiente"></i>';
      break;
    case 'en_curso':
    case 'en curso':
      iconHtml = '<i class="bi bi-record-circle-fill text-danger blink" title="En curso"></i>';
      break;
    case 'finalizado':
      iconHtml = '<i class="bi bi-check-circle-fill text-success" title="Finalizado"></i>';
      break;
    default:
      iconHtml = '<i class="bi bi-question-circle-fill text-muted"></i>';
  }

  // Score
  let scoreHtml = '';
  if (partido.estado === 'finalizado' || partido.estado === 'en curso' || partido.estado === 'en_curso') {
    const puntosEquipo = partido.puntosEquipo ?? 0;
    const puntosRival = partido.puntosRival ?? 0;
    let scoreText = '';
    if (partido.esLocal) {
      scoreText = `${puntosEquipo} - ${puntosRival}`;
    } else {
      scoreText = `${puntosRival} - ${puntosEquipo}`;
    }
    scoreHtml = `<span class="fw-bold ms-2">${scoreText}</span>`;
  }

  // View Button
  const viewBtn = `
        <a href="partido.html?id=${partido.id}" 
           class="btn btn-sm btn-success ms-auto" 
           title="Ver partido">
            <i class="bi bi-eye-fill"></i>
        </a>
    `;

  // Competicion name (if available)
  const compNameBadge = partido.nombreCompeticion
    ? `<span class="badge bg-secondary" style="font-size: 0.7em;">${partido.nombreCompeticion}</span>`
    : '';

  card.innerHTML = `
        <div class="d-flex justify-content-between align-items-start mb-1">
            <div class="text-muted small">${time}</div>
            ${compNameBadge}
        </div>
        
        <div class="mb-2">
            <div class="fw-bold text-truncate" title="${local}">${local}</div>
            <div class="text-muted small">vs</div>
            <div class="fw-bold text-truncate" title="${visitante}">${visitante}</div>
        </div>
  
        <div class="mb-2">
            ${locationLink}
        </div>
  
        <div class="d-flex align-items-center mt-2 border-top pt-2">
            <div class="d-flex align-items-center">
                ${iconHtml}
                ${scoreHtml}
            </div>
            ${viewBtn}
        </div>
    `;

  return card;
}

function showLoading() {
  document.getElementById('loadingSpinner').style.display = 'block';
  document.getElementById('calendarGrid').style.opacity = '0.5';
}

function hideLoading() {
  document.getElementById('loadingSpinner').style.display = 'none';
  document.getElementById('calendarGrid').style.opacity = '1';
}
