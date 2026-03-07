/**
 * Helper class for Google Calendar integration
 */
class CalendarHelper {
    static GOOGLE_API_KEY = 'YOUR_API_KEY_HERE'; // Usuario debe configurar
    static GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com'; // Usuario debe configurar
    static DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
    static SCOPES = 'https://www.googleapis.com/auth/calendar.events';

    static tokenClient = null;
    static gapiInited = false;
    static gisInited = false;

    /**
     * Initialize Google API and OAuth
     */
    static async initGoogleAPI() {
        // Load Google API library if not loaded
        if (!window.gapi) {
            await this.loadScript('https://apis.google.com/js/api.js');
        }

        // Load Google Identity Services if not loaded
        if (!window.google?.accounts) {
            await this.loadScript('https://accounts.google.com/gsi/client');
        }

        // Initialize GAPI
        if (!this.gapiInited) {
            await new Promise((resolve) => {
                gapi.load('client', async () => {
                    await gapi.client.init({
                        apiKey: this.GOOGLE_API_KEY,
                        discoveryDocs: [this.DISCOVERY_DOC],
                    });
                    this.gapiInited = true;
                    resolve();
                });
            });
        }

        // Initialize GIS
        if (!this.gisInited) {
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: this.GOOGLE_CLIENT_ID,
                scope: this.SCOPES,
                callback: '', // Will be set per request
            });
            this.gisInited = true;
        }
    }

    /**
     * Load external script
     */
    static loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Add multiple events to Google Calendar using API
     */
    static async addEventsToCalendarAPI(partidos, nombreEquipo) {
        try {
            // Initialize API
            await this.initGoogleAPI();

            // Request access token
            await new Promise((resolve, reject) => {
                this.tokenClient.callback = async (resp) => {
                    if (resp.error !== undefined) {
                        reject(resp);
                    }
                    resolve(resp);
                };

                if (gapi.client.getToken() === null) {
                    this.tokenClient.requestAccessToken({ prompt: 'consent' });
                } else {
                    this.tokenClient.requestAccessToken({ prompt: '' });
                }
            });

            // Create events
            let success = 0;
            let errors = 0;

            for (const { partido } of partidos) {
                try {
                    const event = this.createCalendarEvent(partido, nombreEquipo);
                    await gapi.client.calendar.events.insert({
                        'calendarId': 'primary',
                        'resource': event
                    });
                    success++;
                } catch (error) {
                    console.error('Error creating event:', error);
                    errors++;
                }
            }

            return { success, errors };

        } catch (error) {
            console.error('Error initializing Google Calendar API:', error);
            throw error;
        }
    }

    /**
     * Create calendar event object for API
     */
    static createCalendarEvent(partido, nombreEquipo) {
        const title = this.getMatchTitle(partido, nombreEquipo);
        const description = this.getMatchDetails(partido, nombreEquipo);
        const location = partido.pabellon || '';

        const startDate = new Date(partido.fechaHora);
        const endDate = new Date(startDate.getTime() + (2 * 60 * 60 * 1000));

        return {
            'summary': title,
            'location': location,
            'description': description,
            'start': {
                'dateTime': startDate.toISOString(),
                'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone
            },
            'end': {
                'dateTime': endDate.toISOString(),
                'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone
            },
            'reminders': {
                'useDefault': false,
                'overrides': [
                    { 'method': 'popup', 'minutes': 24 * 60 }, // 1 day before
                    { 'method': 'popup', 'minutes': 60 } // 1 hour before
                ]
            }
        };
    }

    /**
     * Generate .ics file for download
     */
    static generateICSFile(partidos, nombreEquipo) {
        let icsContent = 'BEGIN:VCALENDAR\n';
        icsContent += 'VERSION:2.0\n';
        icsContent += 'PRODID:-//BasketKids//Calendar//ES\n';
        icsContent += 'CALSCALE:GREGORIAN\n';
        icsContent += 'METHOD:PUBLISH\n';

        partidos.forEach(({ partido }) => {
            const title = this.getMatchTitle(partido, nombreEquipo);
            const description = this.getMatchDetails(partido, nombreEquipo).replace(/\n/g, '\\n');
            const location = partido.pabellon || '';

            const startDate = new Date(partido.fechaHora);
            const endDate = new Date(startDate.getTime() + (2 * 60 * 60 * 1000));

            const formatICSDate = (date) => {
                return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            };

            icsContent += 'BEGIN:VEVENT\n';
            icsContent += `UID:${Date.now()}-${Math.random()}@basketkids.app\n`;
            icsContent += `DTSTAMP:${formatICSDate(new Date())}\n`;
            icsContent += `DTSTART:${formatICSDate(startDate)}\n`;
            icsContent += `DTEND:${formatICSDate(endDate)}\n`;
            icsContent += `SUMMARY:${title}\n`;
            icsContent += `DESCRIPTION:${description}\n`;
            icsContent += `LOCATION:${location}\n`;
            icsContent += 'BEGIN:VALARM\n';
            icsContent += 'TRIGGER:-PT24H\n';
            icsContent += 'ACTION:DISPLAY\n';
            icsContent += `DESCRIPTION:${title}\n`;
            icsContent += 'END:VALARM\n';
            icsContent += 'END:VEVENT\n';
        });

        icsContent += 'END:VCALENDAR';

        return icsContent;
    }

    /**
     * Download .ics file
     */
    static downloadICS(partidos, nombreEquipo) {
        const icsContent = this.generateICSFile(partidos, nombreEquipo);
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `calendario-partidos-${nombreEquipo.replace(/\s/g, '-')}.ics`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Export matches with choice of method
     */
    static async exportMultipleToCalendar(partidos, nombreEquipo) {
        if (partidos.length === 0) {
            alert('No hay partidos para exportar');
            return;
        }

        // Check if API credentials are configured
        const apiConfigured = this.GOOGLE_API_KEY !== 'YOUR_API_KEY_HERE' &&
            this.GOOGLE_CLIENT_ID !== 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com';

        if (apiConfigured) {
            // Try API method first
            if (confirm(`Se añadirán ${partidos.length} partidos a tu Google Calendar.\n\n¿Deseas continuar?`)) {
                try {
                    const result = await this.addEventsToCalendarAPI(partidos, nombreEquipo);
                    alert(`✅ Exportación completada!\n\nPartidos añadidos: ${result.success}\nErrores: ${result.errors}`);
                } catch (error) {
                    console.error('Error with API method:', error);
                    // Fallback to .ics file
                    if (confirm('No se pudo conectar con Google Calendar.\n\n¿Descargar archivo .ics en su lugar?')) {
                        this.downloadICS(partidos, nombreEquipo);
                        alert('Archivo descargado. Ábrelo para importar los partidos a tu calendario.');
                    }
                }
            }
        } else {
            // Use .ics file method
            if (confirm(`Se descargará un archivo .ics con ${partidos.length} partidos.\n\nPodrás importarlo en Google Calendar u otro calendario.\n\n¿Continuar?`)) {
                this.downloadICS(partidos, nombreEquipo);
                alert('✅ Archivo descargado!\n\nAbre el archivo .ics para importar los partidos a tu calendario.');
            }
        }
    }

    /**
     * Get match title for calendar
     * @param {Object} partido - Match data
     * @param {string} nombreEquipo - Team name
     * @returns {string} - Match title
     */
    static getMatchTitle(partido, nombreEquipo) {
        const local = partido.esLocal ? nombreEquipo : partido.nombreRival;
        const visitante = partido.esLocal ? partido.nombreRival : nombreEquipo;
        return `🏀 ${local} vs ${visitante}`;
    }

    /**
     * Get match details for calendar description
     * @param {Object} partido - Match data
     * @param {string} nombreEquipo - Team name
     * @returns {string} - Match details
     */
    static getMatchDetails(partido, nombreEquipo) {
        const tipo = partido.esLocal ? 'Partido en casa' : 'Partido fuera';
        const rival = partido.nombreRival || 'Rival';

        let details = `${tipo}\n`;
        details += `Rival: ${rival}\n`;
        details += `Ubicación: ${partido.pabellon || 'Por determinar'}\n`;

        if (partido.estado === 'finalizado') {
            const puntosEquipo = partido.puntosEquipo ?? 0;
            const puntosRival = partido.puntosRival ?? 0;
            details += `\nResultado: ${puntosEquipo} - ${puntosRival}`;
        }

        return details;
    }

    /**
     * Generate a Google Calendar event URL (for individual exports)
     * @param {Object} partido - Match data
     * @param {string} nombreEquipo - Team name
     * @returns {string} - Google Calendar URL
     */
    static generateCalendarURL(partido, nombreEquipo) {
        const title = this.getMatchTitle(partido, nombreEquipo);
        const details = this.getMatchDetails(partido, nombreEquipo);
        const location = partido.pabellon || '';

        const startDate = new Date(partido.fechaHora);
        const endDate = new Date(startDate.getTime() + (2 * 60 * 60 * 1000));

        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${year}${month}${day}T${hours}${minutes}00`;
        };

        const baseUrl = 'https://calendar.google.com/calendar/render';
        const params = new URLSearchParams({
            action: 'TEMPLATE',
            text: title,
            dates: `${formatDate(startDate)}/${formatDate(endDate)}`,
            details: details,
            location: location
        });

        return `${baseUrl}?${params.toString()}`;
    }

    /**
     * Generate Google Maps URL for a location
     * @param {string} location - Location address
     * @returns {string} - Google Maps URL
     */
    static generateMapsURL(location) {
        if (!location) return '#';

        const params = new URLSearchParams({
            api: '1',
            query: location
        });

        return `https://www.google.com/maps/search/?${params.toString()}`;
    }

    /**
     * Open Google Calendar in a new window
     * @param {string} url - Calendar URL
     */
    static openCalendar(url) {
        window.open(url, '_blank');
    }
}
