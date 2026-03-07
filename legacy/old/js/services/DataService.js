class DataService {
  constructor(userId, teamId, competitionId, matchId) {
    this.supabase = window.supabaseClient;
    this.userId = userId;
    this.teamId = teamId;
    this.competitionId = competitionId;
    this.matchId = matchId;

    // Offline Queue
    this.queueKey = `offline_queue_${matchId}`;
    this.eventQueue = this.loadQueue();

    // Listen for online status to trigger sync
    window.addEventListener('online', () => this.syncQueue());
  }

  loadQueue() {
    try {
      const q = localStorage.getItem(this.queueKey);
      return q ? JSON.parse(q) : [];
    } catch (e) {
      console.error("Error loading queue:", e);
      return [];
    }
  }

  saveQueue() {
    localStorage.setItem(this.queueKey, JSON.stringify(this.eventQueue));
  }

  /**
   * Carga todos los datos del partido + Eventos.
   */
  async cargarPartido() {
    const cacheKey = `match_data_${this.matchId}`;

    // Helper to process data
    const processData = (matchData, dbEvents) => {
      let partido = {
        id: matchData.id,
        fechaHora: matchData.date,
        pabellon: matchData.location,
        equipoId: matchData.team_id,
        rivalId: matchData.rival_id,
        nombreRival: matchData.rival_name,
        estado: matchData.state,
        parteActual: matchData.current_period,
        configuracion: matchData.match_config,
        duracionParte: matchData.period_duration,
        esLocal: matchData.is_local,

        // Legacy fallbacks from metadata if not in events yet
        convocados: matchData.live_state?.convocados || [],
        jugadoresEnPista: matchData.live_state?.jugadoresEnPista || {},
        cronica: matchData.chronicle || matchData.live_state?.cronica || '', // Ensure legacy/saved chronicles are loaded

        // Events
        dbEvents: dbEvents || [],
        pendingEvents: this.eventQueue || [],

        // Initialize Empty Stats (Will be rebuilt by PartidoApp using events)
        puntosEquipo: 0,
        puntosRival: 0,
        faltasEquipo: 0,
        faltasRival: 0,
        estadisticasJugadores: {}
      };
      return partido;
    };

    try {
      // 1. Fetch Match Metadata
      const { data: matchData, error: matchError } = await this.supabase
        .from('matches')
        .select('*')
        .eq('id', this.matchId)
        .single();

      if (matchError) throw matchError;

      // 2. Fetch Match Events (Relational!)
      const { data: events, error: eventsError } = await this.supabase
        .from('match_events')
        .select('*')
        .eq('match_id', this.matchId)
        .order('created_at', { ascending: true });

      if (eventsError) throw eventsError;

      const partido = processData(matchData, events);

      // Save to Cache (safe to ignore error if quota exceeded)
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ matchData, events, timestamp: Date.now() }));
      } catch (e) { console.warn("Cache write failed", e); }

      console.log("Partido updated from network and cached.");
      return partido;

    } catch (error) {
      console.warn("Network error loading match, trying cache:", error);

      const cachedRaw = localStorage.getItem(cacheKey);
      if (cachedRaw) {
        try {
          const { matchData, events } = JSON.parse(cachedRaw);
          console.log("Loaded match from local cache.");
          return processData(matchData, events);
        } catch (e) {
          console.error("Error creating partido from cache", e);
        }
      }

      // Propagate error if no cache
      console.error("Error cargando partido and no cache:", error);
      throw error;
    }
  }

  /**
   * Carga la plantilla de jugadores del equipo.
   */
  async cargarPlantilla() {
    const { data, error } = await this.supabase
      .from('players')
      .select('*, avatar_configs(*)')
      .eq('team_id', this.teamId);

    if (error) {
      console.error("Error cargando plantilla:", error);
      return [];
    }

    return data.map(p => ({
      id: p.id,
      nombre: p.name,
      dorsal: p.number,
      avatarConfig: p.avatar_configs || null
    }));
  }

  /**
   * Carga la lista de rivales de la competición.
   */
  async cargarRivales() {
    const { data, error } = await this.supabase
      .from('rivals')
      .select('*')
      .eq('competition_id', this.competitionId);

    if (error) {
      console.error("Error cargando rivales:", error);
      return [];
    }

    return data.map(r => ({
      id: r.id,
      nombre: r.name
    }));
  }

  /**
   * Guarda metadatos del partido.
   * YA NO DEBE GUARDAR live_state ENTERO PARA ESTADISTICAS.
   * Pero sí guardamos 'convocados' y 'jugadoresEnPista' si no tenemos eventos para eso aún.
   */
  async guardarPartido(partidoObj) {
    try {
      const updatePayload = {
        current_period: partidoObj.parteActual,
        state: partidoObj.estado,
        match_config: partidoObj.configuracion,
        period_duration: partidoObj.duracionParte,
        chronicle: partidoObj.cronica || null, // Map directly to column
        // Optional: Keep updating live_state as backup/cache for 'convocados' etc.
        live_state: {
          convocados: partidoObj.convocados,
          jugadoresEnPista: partidoObj.jugadoresEnPista,
          cronica: partidoObj.cronica || '' // Save inside live_state for backward compatibility just in case
          // We consciously OMIT stats from here to force relational usage? 
          // Better to include them for now as a read-only cache for list views if needed.
        }
      };

      if (partidoObj.fechaHora) updatePayload.date = partidoObj.fechaHora;
      if (partidoObj.pabellon) updatePayload.location = partidoObj.pabellon;
      if (partidoObj.nombreRival) updatePayload.rival_name = partidoObj.nombreRival;
      if (partidoObj.rivalId) updatePayload.rival_id = partidoObj.rivalId;
      if (partidoObj.esLocal !== undefined) updatePayload.is_local = partidoObj.esLocal;

      const { error } = await this.supabase
        .from('matches')
        .update(updatePayload)
        .eq('id', this.matchId);

      if (error) throw error;
    } catch (e) {
      console.error("Error guardando partido:", e);
      // Don't throw if offline, just log. 
      // If metadata update fails due to offline, it's less critical than events.
    }
  }

  getNewEventKey() {
    return crypto.randomUUID();
  }

  /**
   * Logs an event. Tries to send to DB. If offline/fails, adds to queue.
   */
  async pushEvento(evento, key = null) {
    const eventoId = key || this.getNewEventKey();
    evento.id = eventoId;

    const dbEvento = {
      id: eventoId,
      match_id: this.matchId,
      player_id: (evento.jugadorId && evento.jugadorId !== 'rival') ? evento.jugadorId : null,
      type: evento.tipo,
      quarter: evento.cuarto,
      timestamp: evento.tiempoSegundos,
      value: evento.cantidad || (evento.valor || 0),
      properties: evento,
      created_at: new Date().toISOString() // Important for order
    };

    // 1. Try to Send immediately
    if (navigator.onLine) {
      this.supabase.from('match_events').insert([dbEvento])
        .then(({ error }) => {
          if (error) {
            console.warn("Error sending event, queuing:", error);
            this.queueEvent(dbEvento);
          } else {
            console.log("Event sent successfully:", eventoId);
          }
        });
    } else {
      console.log("Offline, queuing event:", eventoId);
      this.queueEvent(dbEvento);
    }

    return eventoId;
  }

  queueEvent(dbEvento) {
    this.eventQueue.push(dbEvento);
    this.saveQueue();
  }

  async syncQueue() {
    if (this.eventQueue.length === 0) return;
    if (!navigator.onLine) return;

    console.log(`Syncing ${this.eventQueue.length} events...`);

    // Send batch if possible, or one by one. 
    // Insert allows array.
    const batch = [...this.eventQueue]; // Copy

    const { error } = await this.supabase.from('match_events').insert(batch);

    if (!error) {
      // Success! Clear queue.
      console.log("Sync successful!");
      this.eventQueue = [];
      this.saveQueue();
    } else {
      console.error("Sync failed:", error);
      // Retry later? Leave in queue.
    }
  }

  async deleteEvento(eventoId) {
    const { error } = await this.supabase
      .from('match_events')
      .delete()
      .eq('id', eventoId);

    if (error) console.error("Error deleting event:", error);

    // Also remove from queue if present
    const idx = this.eventQueue.findIndex(e => e.id === eventoId);
    if (idx !== -1) {
      this.eventQueue.splice(idx, 1);
      this.saveQueue();
    }
  }
}

class PartidosGlobalesDataService {
  constructor() {
    this.supabase = window.supabaseClient;
  }

  async getPartidoGlobal(partidoId) {
    const { data, error } = await this.supabase
      .from('matches')
      .select('*')
      .eq('id', partidoId)
      .single();

    if (error) throw error;
    // For global view, we might need stats. 
    // Ideally we should have a view or aggregation.
    // For now, return live_state or empty.
    return data.live_state || {};
  }
}