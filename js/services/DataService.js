class DataService {
  constructor(userId, teamId, competitionId, matchId) {
    this.supabase = window.supabaseClient;
    this.userId = userId;
    this.teamId = teamId;
    this.competitionId = competitionId;
    this.matchId = matchId;
  }

  /**
   * Carga todos los datos del partido.
   * Retorna un objeto partido con la estructura completa.
   */
  async cargarPartido() {
    try {
      const { data: match, error } = await this.supabase
        .from('matches')
        .select('*')
        .eq('id', this.matchId)
        .single();

      if (error) throw error;
      if (!match) return null;

      // Si existe live_state, úsalo como fuente principal.
      // Si no, inicializa desde columnas o valores por defecto.
      let partido = match.live_state || {};

      // Asegurar que campos críticos estén sincronizados con las columnas
      partido.id = match.id;
      partido.equipoId = match.team_id; // Mapping team_id column to internal teamId? 
      // Actually PartidoApp uses equipoId, matchId etc.
      partido.competicionId = match.competition_id;
      // partido.rivalId = match.rival_id; // Sync if column changed?

      // Defaults
      partido.convocados = partido.convocados || {};
      partido.jugadoresEnPista = partido.jugadoresEnPista || {};
      partido.estadisticasJugadores = partido.estadisticasJugadores || {};

      partido.configuracion = partido.configuracion || match.match_config || '4x10';
      partido.parteActual = partido.parteActual || match.current_period || 1;
      partido.duracionParte = partido.duracionParte || (match.period_duration || (partido.configuracion === '6x8' ? 8 * 60 : 10 * 60));
      partido.totalPartes = partido.totalPartes || (partido.configuracion === '6x8' ? 6 : 4);

      partido.estado = partido.estado || match.state || 'no empezado';

      partido.puntosEquipo = partido.puntosEquipo || 0;
      partido.puntosRival = partido.puntosRival || 0;
      partido.faltasEquipo = partido.faltasEquipo || 0;
      partido.faltasRival = partido.faltasRival || 0;

      partido.eventos = partido.eventos || {};

      // Sync basic info that might have been edited in 'edit details' independently of live_state
      partido.fechaHora = match.date;
      partido.pabellon = match.location;
      partido.nombreRival = match.rival_name;
      partido.esLocal = match.is_local;
      partido.rivalId = match.rival_id;

      return partido;
    } catch (e) {
      console.error("Error cargando partido:", e);
      return null;
    }
  }

  /**
   * Carga la plantilla de jugadores del equipo.
   */
  async cargarPlantilla() {
    // Assuming players table has all info needed
    // Plantilla array: [{ id, dorsal, nombre, ... }]
    const { data, error } = await this.supabase
      .from('players')
      .select('*')
      .eq('team_id', this.teamId);

    if (error) {
      console.error("Error cargando plantilla:", error);
      return [];
    }

    return data.map(p => ({
      id: p.id,
      nombre: p.name,
      dorsal: p.number,
      avatarConfig: p.avatar_config || null
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
   * Guarda el objeto completo del partido (live_state) y actualiza columnas clave.
   * @param {Object} partidoObj - Objeto completo del partido.
   */
  async guardarPartido(partidoObj) {
    try {
      // Map properties back to columns for query-ability
      const updatePayload = {
        live_state: partidoObj,
        current_period: partidoObj.parteActual,
        state: partidoObj.estado,
        match_config: partidoObj.configuracion,
        period_duration: partidoObj.duracionParte
      };

      // Update basic fields if they are in partidoObj (from edit modal)
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
      throw e;
    }
  }

  /**
   * Helpers mostly to maintain compatibility if logic used them. 
   * But main logic uses guardarPartido(this.partido) so we are good.
   */

  getNewEventKey() {
    // Generate a UUID locally or just let Supabase handle it for the table.
    // But PartidoApp expects a key immediateley sometimes?
    // PartidoApp logic: pushEvento(evento) returns key.
    return crypto.randomUUID();
  }

  async pushEvento(evento, key = null) {
    const eventoId = key || this.getNewEventKey();
    evento.id = eventoId; // Store ID in event object too

    // 1. Log to match_events table
    const dbEvento = {
      id: eventoId,
      match_id: this.matchId,
      player_id: (evento.jugadorId && evento.jugadorId !== 'rival') ? evento.jugadorId : null, // Handle 'rival' or null
      type: evento.tipo,
      quarter: evento.cuarto,
      timestamp: evento.tiempoSegundos,
      value: evento.cantidad || (evento.valor || 0),
      properties: evento // Store full object as JSONB for fidelity
    };

    // We don't await this insert to block UI? Better to allow fire & forget or return promise.
    // We'll return logic promise.

    const insertPromise = this.supabase.from('match_events').insert([dbEvento]);

    // 2. Process locally to update stats in live_state
    // This function modifies 'estadisticasJugadores' in memory? 
    // No, DataService is stateless regarding 'this.partido' here, it receives data via 'guardarPartido' usually.
    // BUT PartidoApp calls pushEvento AND expects DataService to update the state?
    // Wait, original DataService `pushEvento`:
    // `return newRef.set(evento).then(() => this._procesarEvento(evento))`
    // `_procesarEvento` reads `partidoRef`, modifies it, writes it back!

    // PROBLEM: `DataService.js` in Supabase version doesn't hold `partido`.
    // `PartidoApp.js` holds `this.partido`.
    // `PartidoApp.js` calls `pushEvento`.
    // If `DataService` is responsible for calculating stats (business logic), it needs access to the current state.
    // Option A: `PartidoApp` passes current state to `pushEvento`.
    // Option B: `DataService` fetches state, updates, saves. (Slow, race conditions).
    // Option C: Move `_procesarEvento` logic to `PartidoApp` (or a helper class) and just use DataService for storage.
    // Option C is best for refactoring. The Business Logic of "points -> stats update" belongs in the App or Domain layer, not purely in the Persistence layer if Persistence is dumb.
    // However, `DataService` contained the logic previously.
    // To minimize `PartidoApp.js` changes, I can keep the logic here IF I can access the state.

    // But `DataService` methods `_procesarEvento` used `partidoRef.once('value')`... reading DB.
    // In Supabase, reading DB every event is costly/slow.
    // `PartidoApp` ALREADY has `this.partido` in memory!
    // I should change `PartidoApp` to handle the state update locally, then call `DataService.guardarPartido`.
    // AND call `DataService.logEvent`.

    // This is a paradigm shift.

    // OLD FLOW:
    // UI -> pushEvento -> Firebase Write -> _procesarEvento (Firebase Read/Write) -> Firebase Write.

    // NEW FLOW (Recommended):
    // UI -> Update `this.partido` (State) locally -> DataService.saveState(this.partido) AND DataService.logEvent(event).

    // This means I MUST refactor `PartidoApp.js` to contain the logic of `_procesarEvento`.
    // `PartidoApp.js` currently relies on `pushEvento` doing the magic.

    // I will put `procesarEvento` logic into `PartidoApp.js` (or `MatchLogic.js` helper).
    // For now, I'll put it in `PartidoApp.js`.

    // So DataService.pushEvento becomes:
    // logEvent(event) -> insert to match_events table.

    // I'll rename `pushEvento` to `logEvento` in DataService to be clear, 
    // and update PartidoApp to call `logEvento` AND `guardarPartido`.

    // Wait, `PartidoApp.js` is huge.
    // I can add `procesarEvento` to `PartidoApp`.
    // I will verify this plan.

    return insertPromise.then(({ error }) => {
      if (error) console.error("Error logging event:", error);
      return eventoId;
    });
  }

  async deleteEvento(eventoId, evento) {
    // Delete from match_events
    const { error } = await this.supabase
      .from('match_events')
      .delete()
      .eq('id', eventoId);

    if (error) console.error("Error deleting event:", error);

    // The state reversion logic must happen in PartidoApp now.
  }
}

class PartidosGlobalesDataService {
  constructor() {
    this.supabase = window.supabaseClient;
  }

  async getPartidoGlobal(partidoId) {
    // In Supabase, we can just fetch the match from 'matches' table
    // assuming RLS allows valid access (it does, 'viewable by everyone').
    const { data, error } = await this.supabase
      .from('matches')
      .select('*')
      .eq('id', partidoId)
      .single();

    if (error) throw error;
    return data.live_state; // Return the app-readable state
  }
}