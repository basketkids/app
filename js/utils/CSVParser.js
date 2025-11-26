class CSVParser {
    /**
     * Parse a CSV file and return an array of match objects
     * @param {File} file - The CSV file to parse
     * @returns {Promise<Array>} - Array of parsed match objects
     */
    static parseCSV(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const matches = this.parseCSVText(text);
                    resolve(matches);
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => {
                reject(new Error('Error al leer el archivo CSV'));
            };

            reader.readAsText(file);
        });
    }

    /**
     * Parse CSV text content into match objects
     * @param {string} text - CSV text content
     * @returns {Array} - Array of match objects
     */
    static parseCSVText(text) {
        const lines = text.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
            throw new Error('El archivo CSV está vacío o no tiene datos');
        }

        // Parse header
        const header = lines[0].split(';').map(h => h.trim());

        // Verify expected columns
        const expectedColumns = ['equipo_rival', 'fecha', 'hora', 'ubicacion', 'resultado', 'JuegoDeLocal'];
        const hasAllColumns = expectedColumns.every(col => header.includes(col));

        if (!hasAllColumns) {
            throw new Error('El archivo CSV no tiene el formato correcto. Columnas esperadas: ' + expectedColumns.join(', '));
        }

        // Parse data rows
        const matches = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const values = line.split(';').map(v => v.trim());

            if (values.length !== header.length) {
                console.warn(`Línea ${i + 1} ignorada: número incorrecto de columnas`);
                continue;
            }

            const match = {};
            header.forEach((col, idx) => {
                match[col] = values[idx];
            });

            // Validate and parse the match
            try {
                const parsedMatch = this.parseMatchData(match);
                matches.push(parsedMatch);
            } catch (error) {
                console.warn(`Línea ${i + 1} ignorada: ${error.message}`);
            }
        }

        return matches;
    }

    /**
     * Parse and validate a single match data row
     * @param {Object} row - Raw CSV row data
     * @returns {Object} - Parsed match object
     */
    static parseMatchData(row) {
        const { equipo_rival, fecha, hora, ubicacion, resultado, JuegoDeLocal } = row;

        if (!equipo_rival || !fecha || !hora || !ubicacion) {
            throw new Error('Faltan datos obligatorios');
        }

        // Convert date from DD/MM/YYYY to YYYY-MM-DD
        const dateParts = fecha.split('/');
        if (dateParts.length !== 3) {
            throw new Error('Formato de fecha inválido (esperado DD/MM/YYYY)');
        }
        const [day, month, year] = dateParts;
        const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

        // Format time as HH:MM
        const timeParts = hora.split(':');
        if (timeParts.length !== 2) {
            throw new Error('Formato de hora inválido (esperado HH:MM)');
        }
        const formattedTime = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}`;

        // Create datetime-local format (YYYY-MM-DDTHH:MM)
        const fechaHora = `${isoDate}T${formattedTime}`;

        // Parse result if it exists
        let puntosEquipo = 0;
        let puntosRival = 0;
        let hasResult = false;

        if (resultado && resultado.trim() && resultado !== '0-0') {
            const resultParts = resultado.split('-');
            if (resultParts.length === 2) {
                const teamPoints = parseInt(resultParts[0].trim());
                const rivalPoints = parseInt(resultParts[1].trim());

                if (!isNaN(teamPoints) && !isNaN(rivalPoints)) {
                    // Determine which score belongs to which team based on esLocal
                    const esLocal = JuegoDeLocal && JuegoDeLocal.toLowerCase() === 'si';
                    puntosEquipo = esLocal ? teamPoints : rivalPoints;
                    puntosRival = esLocal ? rivalPoints : teamPoints;
                    hasResult = true;
                }
            }
        }

        // Determine if it's a home game
        const esLocal = JuegoDeLocal && JuegoDeLocal.toLowerCase() === 'si';

        return {
            nombreRival: equipo_rival,
            fechaHora: fechaHora,
            pabellon: ubicacion,
            esLocal: esLocal,
            puntosEquipo: puntosEquipo,
            puntosRival: puntosRival,
            hasResult: hasResult,
            estado: hasResult ? 'finalizado' : 'pendiente'
        };
    }

    /**
     * Check if a match date is in the past
     * @param {string} fechaHora - ISO datetime string
     * @returns {boolean}
     */
    static isMatchInPast(fechaHora) {
        const matchDate = new Date(fechaHora);
        const now = new Date();
        return matchDate < now;
    }
}
