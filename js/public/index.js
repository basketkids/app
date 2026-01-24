
firebase.initializeApp(window.firebaseConfig);
const db = firebase.database();

// Initialize services
// Initialize services
const calendarService = new CalendarService(db);
const teamService = new TeamService(db);
const matchRenderer = new MatchRenderer();

let currentWeekStart = null;
let currentMonthStart = null;
let allMatches = [];
let filteredMatches = [];
let currentView = 'week'; // 'week' or 'month'
let teamFilter = null;
let sportFilter = 'all'; // 'all', 'basketball', 'volleyball'
let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  // Get URL params
  const params = new URLSearchParams(window.location.search);
  teamFilter = params.get('teamId');

  currentWeekStart = calendarService.getCurrentWeekStart();

  // Set current month start to the 1st of the current month
  const now = new Date();
  currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  setupEventListeners();

  // Auth listener
  firebase.auth().onAuthStateChanged(user => {
    currentUser = user;
    if (teamFilter && filteredMatches.length > 0) {
      // Refresh button state if matches are already loaded
      const firstMatch = filteredMatches[0];
      if (firstMatch.ownerUid) {
        updateFollowButtonState(firstMatch.ownerUid, teamFilter);
      }
    }
  });

  await loadMatches();
}

function setupEventListeners() {
  document.getElementById('prevBtn').addEventListener('click', () => navigate(-1));
  document.getElementById('nextBtn').addEventListener('click', () => navigate(1));
  document.getElementById('todayBtn').addEventListener('click', () => goToToday());

  document.getElementById('viewWeekBtn').addEventListener('click', () => switchView('week'));
  document.getElementById('viewMonthBtn').addEventListener('click', () => switchView('month'));

  // Sport Filter Listeners
  document.getElementById('filterAllBtn').addEventListener('click', () => setSportFilter('all'));
  document.getElementById('filterBasketBtn').addEventListener('click', () => setSportFilter('basketball'));
  document.getElementById('filterVolleyBtn').addEventListener('click', () => setSportFilter('volleyball'));


  // Go to Date Modal
  const dateModal = new bootstrap.Modal(document.getElementById('dateModal'));
  const dateInput = document.getElementById('dateInput');

  document.getElementById('goToDateBtn').addEventListener('click', () => {
    // Set current date in input
    const currentDate = currentView === 'week' ? currentWeekStart : currentMonthStart;
    dateInput.value = currentDate.toISOString().split('T')[0];
    dateModal.show();
  });

  document.getElementById('confirmDateBtn').addEventListener('click', () => {
    const selectedDate = new Date(dateInput.value);
    if (!isNaN(selectedDate.getTime())) {
      if (currentView === 'week') {
        // Calculate Monday of the selected date's week
        const day = selectedDate.getDay();
        const diff = selectedDate.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(selectedDate);
        monday.setDate(diff);
        currentWeekStart = monday;
      } else {
        // Set to 1st of the selected month
        currentMonthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      }
      render();
      dateModal.hide();
    }
  });
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

      // Apply filters
      applyFilters();

    } else {
      allMatches = [];
      filteredMatches = [];
      render();
    }
  } catch (error) {
    console.error('Error loading matches:', error);
    alert('Error al cargar los partidos');
  } finally {
    hideLoading();
  }
}

async function updateFollowButtonState(ownerUid, teamId) {
  if (!currentUser || !ownerUid || !teamId) return;
  const followBtn = document.getElementById('followBtn');
  if (!followBtn) return;

  const isFollowing = await teamService.isFollowing(ownerUid, teamId, currentUser.uid);
  if (isFollowing) {
    followBtn.innerHTML = '<i class="bi bi-heart-fill text-danger"></i> Siguiendo';
    followBtn.classList.remove('btn-outline-primary');
    followBtn.classList.add('btn-outline-danger');
  } else {
    followBtn.innerHTML = '<i class="bi bi-heart"></i> Seguir';
    followBtn.classList.add('btn-outline-primary');
    followBtn.classList.remove('btn-outline-danger');
  }
}

async function toggleFollow(ownerUid, teamId) {
  if (!currentUser) return alert('Debes iniciar sesión para seguir equipos');

  const followBtn = document.getElementById('followBtn');
  // Optimistic UI update
  const isFollowing = followBtn.classList.contains('btn-outline-danger');

  try {
    if (isFollowing) {
      await teamService.unfollowTeam(ownerUid, teamId, currentUser.uid);
    } else {
      await teamService.followTeam(ownerUid, teamId, currentUser.uid);
    }
    updateFollowButtonState(ownerUid, teamId);
  } catch (error) {
    console.error(error);
    alert('Error al actualizar seguimiento');
  }
}

function switchView(view) {
  if (currentView === view) return;
  currentView = view;

  // Update buttons
  if (view === 'week') {
    document.getElementById('viewWeekBtn').classList.add('active');
    document.getElementById('viewMonthBtn').classList.remove('active');
    document.getElementById('calendarGrid').style.display = 'flex'; // It's a row/flex container
    document.getElementById('monthViewContainer').style.display = 'none';
  } else {
    document.getElementById('viewWeekBtn').classList.remove('active');
    document.getElementById('viewMonthBtn').classList.add('active');
    document.getElementById('calendarGrid').style.display = 'none';
    document.getElementById('monthViewContainer').style.display = 'block';
  }

  render();
}

function navigate(direction) {
  if (currentView === 'week') {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(newWeekStart.getDate() + (direction * 7));
    currentWeekStart = newWeekStart;
  } else {
    const newMonthStart = new Date(currentMonthStart);
    newMonthStart.setMonth(newMonthStart.getMonth() + direction);
    currentMonthStart = newMonthStart;
  }
  render();
}

function goToToday() {
  const now = new Date();
  if (currentView === 'week') {
    currentWeekStart = calendarService.getCurrentWeekStart();
  } else {
    currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  render();
}

function render() {
  if (currentView === 'week') {
    renderWeekView();
  } else {
    renderMonthView();
  }
}

function renderWeekView() {
  const weekMatches = calendarService.getMatchesForWeek(filteredMatches, currentWeekStart);

  // Update week display
  const weekRange = calendarService.formatWeekRange(currentWeekStart);
  document.getElementById('dateRange').textContent = weekRange;

  // Render each day
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  days.forEach((day, index) => {
    const dayDate = new Date(currentWeekStart);
    dayDate.setDate(dayDate.getDate() + index);

    const isToday = dayDate.getTime() === today.getTime();
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

  // Hide empty days logic (same as before)
  days.forEach(day => {
    const dayColumn = document.getElementById(`${day}Matches`);
    if (weekMatches[day].length === 0) {
      dayColumn.style.display = 'none';
    } else {
      dayColumn.style.display = 'block';
    }
  });
}

function renderMonthView() {
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  document.getElementById('dateRange').textContent = `${monthNames[currentMonthStart.getMonth()]} ${currentMonthStart.getFullYear()}`;

  const monthGrid = document.querySelector('.month-grid');
  const monthList = document.querySelector('.month-list');

  monthGrid.innerHTML = '';
  monthList.innerHTML = '';

  // Calculate days in month
  const year = currentMonthStart.getFullYear();
  const month = currentMonthStart.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  // Get matches for this month
  const monthMatches = filteredMatches.filter(m => {
    const d = new Date(m.fechaHora);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  // --- Desktop Grid Render ---

  // Add Day Headers
  const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  dayNames.forEach(name => {
    const headerCell = document.createElement('div');
    headerCell.className = 'month-header-cell text-center fw-bold p-2 bg-light border';
    headerCell.textContent = name;
    monthGrid.appendChild(headerCell);
  });

  // Add empty cells for days before the 1st
  // Day of week: 0 (Sun) to 6 (Sat). We want Mon (0) to Sun (6).
  // JS getDay(): 0=Sun, 1=Mon...
  // Adjustment: Mon=0, ..., Sun=6.
  let startDay = firstDay.getDay() - 1;
  if (startDay === -1) startDay = 6; // Sunday

  for (let i = 0; i < startDay; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'month-day-cell bg-light';
    monthGrid.appendChild(emptyCell);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dayMatches = monthMatches.filter(m => new Date(m.fechaHora).getDate() === d);

    // Grid Cell
    const cell = document.createElement('div');
    cell.className = 'month-day-cell p-0 border bg-transparent'; // Remove default padding/border from cell itself if we want card look, but let's keep it simple and just style content.
    // Actually, let's keep the cell as the container.
    cell.style.backgroundColor = '#fff';

    const isToday = date.toDateString() === new Date().toDateString();

    const header = document.createElement('div');
    // Use same classes as weekly view header
    if (isToday) {
      header.className = 'card-header bg-warning text-dark p-1 d-flex justify-content-end align-items-center rounded-top';
    } else {
      header.className = 'card-header bg-primary text-white p-1 d-flex justify-content-end align-items-center rounded-top';
    }

    const dayNumSpan = document.createElement('span');
    dayNumSpan.className = 'fw-bold pe-2';
    dayNumSpan.textContent = d;
    header.appendChild(dayNumSpan);

    cell.appendChild(header);

    const matchesContainer = document.createElement('div');
    matchesContainer.className = 'p-1';

    dayMatches.forEach(match => {
      const matchDiv = document.createElement('div');
      matchDiv.className = 'month-day-match d-flex align-items-center gap-1 mb-1 p-1 border rounded';
      matchDiv.style.cursor = 'pointer';
      matchDiv.style.backgroundColor = '#f8f9fa';
      matchDiv.onclick = () => window.location.href = `partido.html?id=${match.id}`;

      // Icon
      let iconHtml = '';
      switch (match.estado) {
        case 'pendiente':
          iconHtml = '<i class="bi bi-clock text-secondary" style="font-size: 0.8em;"></i>';
          break;
        case 'en_curso':
        case 'en curso':
          iconHtml = '<i class="bi bi-record-circle-fill text-danger blink" style="font-size: 0.8em;"></i>';
          break;
        case 'finalizado':
          iconHtml = '<i class="bi bi-check-circle-fill text-success" style="font-size: 0.8em;"></i>';
          break;
        default:
          iconHtml = '<i class="bi bi-question-circle-fill text-muted" style="font-size: 0.8em;"></i>';
      }

      const time = new Date(match.fechaHora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const text = document.createElement('div');
      text.className = 'text-truncate small';
      text.style.flex = '1';
      text.innerHTML = `<span class="fw-bold me-1">${time}</span> ${match.nombreEquipo} vs ${match.nombreRival || 'Rival'}`;

      matchDiv.innerHTML = `${iconHtml}`;
      matchDiv.appendChild(text);

      matchesContainer.appendChild(matchDiv);
    });

    cell.appendChild(matchesContainer);

    monthGrid.appendChild(cell);

    // --- Mobile List Render ---
    if (dayMatches.length > 0) {
      const dayContainer = document.createElement('div');
      dayContainer.className = 'mb-4'; // Spacing between days

      // Create card structure similar to weekly view
      const card = document.createElement('div');
      card.className = 'card h-100 border-0 bg-transparent';

      const header = document.createElement('div');
      const isToday = date.toDateString() === new Date().toDateString();

      // Update day header
      // Consistent header styling (User prefers original bg-primary)
      if (isToday) {
        // Highlight today with a border or slightly different shade if needed, but keeping bg-primary for now as requested
        // Or maybe use a specific class that styles.css can handle?
        // "Los colores de la semana actual ... queda feo" -> removing bg-warning
        header.className = 'card-header bg-primary text-white p-2 d-flex justify-content-between align-items-center rounded-top border-bottom border-3 border-warning';
      } else {
        header.className = 'card-header bg-primary text-white p-2 d-flex justify-content-between align-items-center rounded-top';
      }

      const dayName = date.toLocaleDateString('es-ES', { weekday: 'long' });
      const dayNumber = date.getDate();

      const dayNameSpan = document.createElement('span');
      dayNameSpan.className = 'text-uppercase fw-bold small';
      dayNameSpan.textContent = dayName;

      const dayNumSpan = document.createElement('span');
      dayNumSpan.className = 'fs-5 fw-bold';
      dayNumSpan.textContent = dayNumber;

      header.appendChild(dayNameSpan);
      header.appendChild(dayNumSpan);
      card.appendChild(header);

      const cardBody = document.createElement('div');
      cardBody.className = 'card-body p-0 pt-2';

      dayMatches.forEach(match => {
        const matchCard = matchRenderer.renderMatchCard(match, { isOwner: false });
        cardBody.appendChild(matchCard);
      });

      card.appendChild(cardBody);
      dayContainer.appendChild(card);

      monthList.appendChild(dayContainer);
    }
  }
}

function renderDay(dayColumn, container, matches) {
  container.innerHTML = '';

  if (matches.length === 0) {
    return;
  }

  matches.forEach(match => {
    const matchCard = matchRenderer.renderMatchCard(match, { isOwner: false });
    container.appendChild(matchCard);
  });
}

// createMatchCard removed in favor of matchRenderer.renderMatchCard

function setSportFilter(filter) {
  if (sportFilter === filter) return;
  sportFilter = filter;

  // Update Buttons
  const map = { 'all': 'filterAllBtn', 'basketball': 'filterBasketBtn', 'volleyball': 'filterVolleyBtn' };
  Object.keys(map).forEach(key => {
    const btn = document.getElementById(map[key]);
    if (btn) {
      if (key === filter) {
        btn.classList.add('active');
        btn.classList.remove('btn-outline-secondary'); // if simple toggle
        btn.classList.add('btn-secondary'); // active state style adaptation? 
        // HTML has btn-outline-secondary active. 
        // Bootstraps .active on outline works.
      } else {
        btn.classList.remove('active');
      }
    }
  });

  applyFilters();
}

function applyFilters() {
  let matches = [...allMatches];

  // 1. Team Filter
  if (teamFilter) {
    matches = matches.filter(m => m.equipoId === teamFilter || m.rivalId === teamFilter);

    // Update Header UI for Team
    const firstMatch = matches.length > 0 ? matches[0] : null; // or from allMatches if filtered is empty?
    // Optimization: we might not find match if filtered by sport is empty. 
    // Ideally we should look up team name from somewhere else or just use what we have.
    const teamName = firstMatch ? firstMatch.nombreEquipo : 'Equipo';
    const ownerUid = firstMatch ? firstMatch.ownerUid : null;

    const header = document.querySelector('h2');
    if (header) {
      header.innerHTML = `Partidos Públicos <span class="badge bg-info fs-6">${teamName}</span> 
              <button id="followBtn" class="btn btn-sm btn-outline-primary ms-2" style="display:none">
                  <i class="bi bi-heart"></i> Seguir
              </button>
              <a href="index.html" class="btn btn-sm btn-outline-danger ms-2"><i class="bi bi-x"></i></a>`;

      if (ownerUid) {
        const followBtn = document.getElementById('followBtn');
        followBtn.style.display = 'inline-block';
        followBtn.onclick = () => toggleFollow(ownerUid, teamFilter);
        if (currentUser) {
          updateFollowButtonState(ownerUid, teamFilter);
        }
      }
    }
  }

  // 2. Sport Filter
  if (sportFilter !== 'all') {
    matches = matches.filter(m => (m.sport || 'basketball') === sportFilter);
  }

  filteredMatches = matches;
  render();
}

function showLoading() {
  document.getElementById('loadingSpinner').style.display = 'block';
  const grid = document.getElementById('calendarGrid');
  if (grid) grid.style.opacity = '0.5';
}

function hideLoading() {
  document.getElementById('loadingSpinner').style.display = 'none';
  const grid = document.getElementById('calendarGrid');
  if (grid) grid.style.opacity = '1';
}
