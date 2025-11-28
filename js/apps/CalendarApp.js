/**
 * CalendarApp - Application for weekly calendar view
 */
class CalendarApp extends BaseApp {
    constructor() {
        super();
        this.calendarService = null;
        this.currentWeekStart = null;
        this.allMatches = [];
        this.weekMatches = {};
    }

    async init() {
        await super.init();
        this.calendarService = new CalendarService(this.db);
        this.currentWeekStart = this.calendarService.getCurrentWeekStart();
        this.setupEventListeners();
    }

    onUserLoggedIn(user) {
        // Called by BaseApp after user is authenticated
        super.onUserLoggedIn(user);
        this.loadMatches();
    }

    setupEventListeners() {
        document.getElementById('prevWeekBtn').addEventListener('click', () => this.navigateWeek(-1));
        document.getElementById('nextWeekBtn').addEventListener('click', () => this.navigateWeek(1));
        document.getElementById('todayBtn').addEventListener('click', () => this.goToToday());
    }

    async loadMatches() {
        try {
            this.showLoading();
            this.allMatches = await this.calendarService.getAllUserMatches(this.currentUser.uid);
            this.renderCalendar();
        } catch (error) {
            console.error('Error loading matches:', error);
            alert('Error al cargar los partidos');
        } finally {
            this.hideLoading();
        }
    }

    navigateWeek(direction) {
        const newWeekStart = new Date(this.currentWeekStart);
        newWeekStart.setDate(newWeekStart.getDate() + (direction * 7));
        this.currentWeekStart = newWeekStart;
        this.renderCalendar();
    }

    goToToday() {
        this.currentWeekStart = this.calendarService.getCurrentWeekStart();
        this.renderCalendar();
    }

    renderCalendar() {
        this.weekMatches = this.calendarService.getMatchesForWeek(this.allMatches, this.currentWeekStart);

        // Update week display
        const weekRange = this.calendarService.formatWeekRange(this.currentWeekStart);
        document.getElementById('weekRange').textContent = weekRange;

        // Render each day
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        days.forEach((day, index) => {
            const dayDate = new Date(this.currentWeekStart);
            dayDate.setDate(dayDate.getDate() + index);

            const isToday = dayDate.getTime() === today.getTime();
            const container = document.getElementById(`${day}Matches`);

            this.renderDay(container, day, dayDate, this.weekMatches[day], isToday);
        });

        // Count visible days (days with matches)
        const visibleDays = days.filter(day => this.weekMatches[day].length > 0).length;

        // Adjust grid columns based on visible days
        const calendarGrid = document.getElementById('calendarGrid');
        if (visibleDays > 0) {
            calendarGrid.style.gridTemplateColumns = `repeat(${visibleDays}, 1fr)`;
        } else {
            calendarGrid.style.gridTemplateColumns = 'repeat(7, 1fr)';
        }

        this.updateMatchCount();
    }

    renderDay(container, dayKey, date, matches, isToday) {
        const dayCol = container.parentElement;

        // Hide days with no matches
        if (matches.length === 0) {
            dayCol.style.display = 'none';
            return;
        }

        // Show day if it has matches
        dayCol.style.display = 'block';

        // Add/remove today highlight
        if (isToday) {
            dayCol.classList.add('today-highlight');
        } else {
            dayCol.classList.remove('today-highlight');
        }

        // Update day header
        const dayName = date.toLocaleDateString('es-ES', { weekday: 'long' });
        const dayNumber = date.getDate();
        const header = dayCol.querySelector('.card-header'); // Changed selector to match new HTML
        header.className = 'card-header bg-primary text-white p-2 d-flex justify-content-between align-items-center'; // Ensure classes
        header.innerHTML = `
            <span class="text-uppercase fw-bold small">${dayName}</span>
            <span class="fs-5 fw-bold">${dayNumber}</span>
        `;

        // Clear and render matches
        container.innerHTML = '';

        matches.forEach(match => {
            const matchCard = this.createMatchCard(match);
            container.appendChild(matchCard);
        });
    }

    createMatchCard(match) {
        const card = document.createElement('div');
        card.className = 'match-card p-2 mb-2 border rounded shadow-sm bg-white';
        card.style.cursor = 'pointer';
        card.onclick = () => this.goToMatch(match);

        const matchDate = new Date(match.fechaHora);
        const time = matchDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        const local = match.esLocal ? match.teamName : match.nombreRival;
        const visitante = match.esLocal ? match.nombreRival : match.teamName;

        // Location
        const locationLink = match.pabellon
            ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(match.pabellon)}" 
                  target="_blank" 
                  onclick="event.stopPropagation()" 
                  class="text-decoration-none text-muted" style="font-size: 0.85em;">
                  <i class="bi bi-geo-alt"></i> ${match.pabellon}
               </a>`
            : '<span class="text-muted" style="font-size: 0.85em;">Sin ubicación</span>';

        // Status Icon
        let iconHtml = '';
        switch (match.estado) {
            case 'pendiente':
                iconHtml = '<i class="bi bi-clock text-secondary" title="Pendiente"></i>';
                break;
            case 'en_curso': // Note: DataService might use 'en curso' or 'en_curso', check consistency. CompetitionApp uses 'en curso'.
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
        if (match.estado === 'finalizado' || match.estado === 'en curso' || match.estado === 'en_curso') {
            const puntosEquipo = match.puntosEquipo ?? 0;
            const puntosRival = match.puntosRival ?? 0;
            // If user is local, show Equipo - Rival. If visitor, show Rival - Equipo? 
            // Usually we want to see OurTeam vs Rival. 
            // CompetitionApp logic:
            // if (partido.esLocal) { marcadorSpan.textContent = `${puntosEquipo} - ${puntosRival}`; } 
            // else { marcadorSpan.textContent = `${puntosRival} - ${puntosEquipo}`; }

            let scoreText = '';
            if (match.esLocal) {
                scoreText = `${puntosEquipo} - ${puntosRival}`;
            } else {
                scoreText = `${puntosRival} - ${puntosEquipo}`;
            }
            scoreHtml = `<span class="fw-bold ms-2">${scoreText}</span>`;
        }

        // Manage Button
        const manageBtn = `
            <button class="btn btn-sm btn-warning ms-auto" 
                onclick="event.stopPropagation(); window.location.href='partido.html?idEquipo=${match.teamId}&idCompeticion=${match.compId}&idPartido=${match.matchId}'"
                title="Gestionar partido">
                <i class="bi bi-pencil-fill"></i>
            </button>
        `;

        card.innerHTML = `
            <div class="d-flex justify-content-between align-items-start mb-1">
                <div class="text-muted small">${time}</div>
                <span class="badge bg-secondary" style="font-size: 0.7em;">${match.compName}</span>
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
                ${manageBtn}
            </div>
        `;

        return card;
    }

    // getStatusBadge removed as it is integrated into createMatchCard

    goToMatch(match) {
        window.location.href = `partido.html?idEquipo=${match.teamId}&idCompeticion=${match.compId}&idPartido=${match.matchId}`;
    }

    updateMatchCount() {
        const totalMatches = Object.values(this.weekMatches).reduce((sum, day) => sum + day.length, 0);
        document.getElementById('matchCount').textContent = `${totalMatches} partido${totalMatches !== 1 ? 's' : ''}`;
    }

    showLoading() {
        document.getElementById('loadingSpinner').style.display = 'block';
        document.getElementById('calendarGrid').style.opacity = '0.5';
    }

    hideLoading() {
        document.getElementById('loadingSpinner').style.display = 'none';
        document.getElementById('calendarGrid').style.opacity = '1';
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new CalendarApp();
    app.init();
});
