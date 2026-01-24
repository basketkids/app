const SportConfig = {
    basketball: {
        appName: 'BasketKids',
        icon: 'bi-basket',
        stats: {
            puntos: { label: 'PTS', value: 1 },
            rebotes: { label: 'REB', value: 1 },
            asistencias: { label: 'AST', value: 1 },
            robos: { label: 'ROB', value: 1 },
            tapones: { label: 'TAP', value: 1 },
            faltas: { label: 'FAL', value: 1 }
        },
        periods: 4,
        periodName: 'Cuarto'
    },
    volleyball: {
        appName: 'VoleyKids',
        icon: 'bi-controller',
        stats: {
            // These keys must match event types or mapping in MatchRenderer
            puntos: { label: 'PTS', value: 1, type: 'positive' }, // Total Points
            ace: { label: 'ACE', value: 1, type: 'positive' },
            ataque: { label: 'ATK', value: 1, type: 'positive' },
            bloqueo: { label: 'BLK', value: 1, type: 'positive' },
            error_saque: { label: 'ERR S', value: -1, type: 'negative' },
            error_ataque: { label: 'ERR A', value: -1, type: 'negative' },
            recepcion: { label: 'REC', value: 0, type: 'neutral' }
        },
        periods: 5,
        periodName: 'Set'
    }
};

// Expose globally or export if using modules (currently using global scripts)
window.SportConfig = SportConfig;
