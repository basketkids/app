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
        const header = dayCol.querySelector('.calendar-day-header');
        header.innerHTML = `
            <div class="day-name">${dayName.charAt(0).toUpperCase() + dayName.slice(1)}</div>
            <div class="day-number">${dayNumber}</div>
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
        card.className = 'match-card';
        card.onclick = () => this.goToMatch(match);

        const matchDate = new Date(match.fechaHora);
        const time = matchDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        const local = match.esLocal ? match.teamName : match.nombreRival;
        const visitante = match.esLocal ? match.nombreRival : match.teamName;

        const locationLink = match.pabellon
            ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(match.pabellon)}" 
                  target="_blank" 
                  onclick="event.stopPropagation()" 
                  class="location-link">
                  <i class="bi bi-geo-alt"></i> ${match.pabellon}
               </a>`
            : '<span class="text-muted">Sin ubicación</span>';

        const statusBadge = this.getStatusBadge(match);
        const teamBadge = match.esLocal
            ? '<span class="badge bg-success">Local</span>'
            : '<span class="badge bg-info">Visitante</span>';

        card.innerHTML = `
            <div class="match-time">${time}</div>
            <div class="match-competition">
                <span class="badge bg-secondary">${match.compName}</span>
                ${teamBadge}
            </div>
            <div class="match-teams">
                <strong>${local}</strong> vs <strong>${visitante}</strong>
            </div>
            <div class="match-location">${locationLink}</div>
            ${statusBadge}
        `;

        return card;
    }

    getStatusBadge(match) {
        if (match.estado === 'finalizado') {
            const puntosEquipo = match.puntosEquipo ?? 0;
            const puntosRival = match.puntosRival ?? 0;
            return `<div class="match-result">
                <span class="badge bg-dark">${puntosEquipo} - ${puntosRival}</span>
            </div>`;
        } else if (match.estado === 'en_curso') {
            return '<div class="match-result"><span class="badge bg-warning">En curso</span></div>';
        }
        return '';
    }

    goToMatch(match) {
        window.location.href = `partidonew.html?idEquipo=${match.teamId}&idCompeticion=${match.compId}&idPartido=${match.matchId}`;
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
