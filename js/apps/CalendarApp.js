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
        this.matchRenderer = new MatchRenderer();
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
        const header = dayCol.querySelector('.card-header');

        // Consistent header styling (Reverted to bg-primary)
        if (isToday) {
            header.className = 'card-header bg-primary text-white p-2 d-flex justify-content-between align-items-center rounded-top border-bottom border-3 border-warning';
        } else {
            header.className = 'card-header bg-primary text-white p-2 d-flex justify-content-between align-items-center rounded-top';
        }

        header.innerHTML = `
            <span class="text-uppercase fw-bold small">${dayName}</span>
            <span class="fs-5 fw-bold">${dayNumber}</span>
        `;

        // Clear and render matches
        container.innerHTML = '';

        matches.forEach(match => {
            const matchCard = this.matchRenderer.renderMatchCard(match, { isOwner: true });
            container.appendChild(matchCard);
        });
    }

    // createMatchCard and goToMatch removed in favor of MatchRenderer

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
