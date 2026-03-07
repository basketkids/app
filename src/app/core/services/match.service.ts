import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { MatchRepository } from '../models/data/match.repository';
import { MatchEngineService } from './match-engine.service';
import { Match, MatchEvent, EventType } from '../models/match.model';

@Injectable({
    providedIn: 'root'
})
export class MatchService implements OnDestroy {
    private currentMatchSubject = new BehaviorSubject<Match | null>(null);
    private matchSub: (() => void) | null = null;

    constructor(
        private matchRepo: MatchRepository,
        private matchEngine: MatchEngineService,
        private ngZone: NgZone
    ) { }

    ngOnDestroy(): void {
        if (this.matchSub) {
            this.matchSub();
        }
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
    }

    /**
     * Exposes the match state as an Observable for UI components.
     */
    get currentMatch$(): Observable<Match | null> {
        return this.currentMatchSubject.asObservable();
    }

    /**
     * Loads a match and pushes it to the state.
     */
    async loadMatch(id: string): Promise<void> {
        if (this.matchSub) {
            this.matchSub();
            this.matchSub = null;
        }

        const match = await this.matchRepo.getMatchById(id);
        if (match) {
            this.ngZone.run(() => {
                this.currentMatchSubject.next(match);
            });

            this.matchSub = this.matchRepo.subscribeToMatch(id, (update) => {
                this.ngZone.run(() => this.handleRealtimeUpdate(update));
            });
        }
    }

    /**
     * Clears the current match state and unsubscribes from realtime updates.
     */
    clearMatch(): void {
        if (this.matchSub) {
            this.matchSub();
            this.matchSub = null;
        }
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.currentMatchSubject.next(null);
    }

    private handleRealtimeUpdate(update: { type: 'match' | 'event' | 'roster', payload: any }): void {
        const current = this.currentMatchSubject.getValue();
        if (!current) return;

        const { type, payload } = update;

        if (type === 'match' && payload.new) {
            current.scoreLocal = current.isLocal ? payload.new.team_score : payload.new.rival_score;
            current.scoreVisitor = current.isLocal ? payload.new.rival_score : payload.new.team_score;
            current.state = payload.new.state;
            if (payload.new.live_state) {
                current.currentQuarter = payload.new.live_state.currentQuarter ?? current.currentQuarter;
                current.playersOnCourt = payload.new.live_state.jugadoresEnPista ?? current.playersOnCourt;
            }
        } else if (type === 'event' && payload.eventType === 'INSERT' && payload.new) {
            const ev = payload.new;
            // If we already have it optimistically, don't re-add
            if (!current.events[ev.id]) {
                current.events = {
                    ...current.events,
                    [ev.id]: {
                        id: ev.id,
                        type: ev.event_type_id || ev.event_type,
                        quarter: ev.quarter || 1,
                        secondsRemaining: ev.timestamp,
                        playerId: ev.player_id || -2,
                        quantity: ev.value,
                        detail: ev.properties
                    }
                };
            }
        }

        this.currentMatchSubject.next({ ...current });
    }

    private timerInterval: any = null;

    /**
     * Adds a statistic event to a player/team and syncs with repository.
     */
    async addStat(playerId: string | -2, type: EventType, value: number = 1): Promise<void> {
        const match = this.currentMatchSubject.getValue();
        if (!match) return;

        // Old app saves 'jugadoresEnPista' array with the event
        const enPista = match.playersOnCourt ? Object.keys(match.playersOnCourt) : [];

        const newEvent: MatchEvent = {
            id: crypto.randomUUID(),
            type,
            quarter: match.currentQuarter,
            secondsRemaining: match.timerState.remainingSeconds,
            playerId,
            quantity: value,
            detail: null,
            // We would ideally extend MatchEvent to accept an arbitrary properties payload to match legacy
            // but for MVP of basic DB compatibility, we'll store it in detail as JSON temporarily
            // OR if the repository supports `properties`, we pass it. The model needs checking.
        };

        // If the repository `appendMatchEvent` doesn't handle properties, we'll have to pass it
        // For now we just mutate `match.events` locally and tell repo to save.

        // Optimistically update local state via engine 
        // (Note: MatchEngineService might need update if it only knows PTS)
        const events = { ...match.events, [newEvent.id]: { ...newEvent, properties: { jugadoresEnPista: enPista } } as any };
        const newScore = this.matchEngine.recalculateScore(events);

        match.events = events;
        match.scoreLocal = newScore.local;
        match.scoreVisitor = newScore.visitor;

        // Update basic local stats instantly so UI feels snappy
        if (playerId !== -2 && match.stats[playerId]) {
            if (type === EventType.POINTS) match.stats[playerId].points += value;
            if (type === EventType.FOULS) match.stats[playerId].fouls += value;
            if (type === EventType.ASSISTS) match.stats[playerId].assists += value;
            if (type === EventType.REBOUNDS) match.stats[playerId].rebounds += value;
            if (type === EventType.STEALS) match.stats[playerId].steals += value;
            if (type === EventType.BLOCKS) match.stats[playerId].blocks += value;

            // Re-calculate valoracion
            const st = match.stats[playerId];
            st.valoracion = st.points + st.rebounds + st.assists + st.steals + st.blocks - st.fouls;
        }

        this.currentMatchSubject.next({ ...match });

        // Persist (pass the extended properties event to the Repo)
        await this.matchRepo.appendMatchEvent(match.id, events[newEvent.id]);
        await this.matchRepo.saveMatchState(match.id, match);
    }

    // --- Court Management ---
    async setPlayersOnCourt(playerIds: string[]): Promise<void> {
        const match = this.currentMatchSubject.getValue();
        if (!match) return;

        match.playersOnCourt = {};
        playerIds.forEach(id => match.playersOnCourt[id] = true);

        this.currentMatchSubject.next({ ...match });
        await this.matchRepo.saveMatchState(match.id, match);
    }

    async setConvocados(playerIds: string[]): Promise<void> {
        const match = this.currentMatchSubject.getValue();
        if (!match) return;

        match.convocados = {};
        playerIds.forEach(id => {
            if (match.plantilla[id]) {
                match.convocados[id] = match.plantilla[id];
            }
        });

        this.currentMatchSubject.next({ ...match });
        await this.matchRepo.updateConvocatoria(match.id, playerIds);
        await this.matchRepo.saveMatchState(match.id, match);
    }

    // --- Timer & Match Flow Controls ---
    toggleTimer(): void {
        const match = this.currentMatchSubject.getValue();
        if (!match || match.state === 'finalizado') return;

        if (this.timerInterval) {
            // Pause
            clearInterval(this.timerInterval);
            this.timerInterval = null;
            match.timerState.active = false;
        } else {
            // Play
            match.state = 'en curso' as any; // Legacy compatibility
            match.timerState.active = true;
            this.timerInterval = setInterval(() => {
                const current = this.currentMatchSubject.getValue();
                if (current && current.timerState.remainingSeconds > 0) {
                    current.timerState.remainingSeconds--;
                    this.currentMatchSubject.next({ ...current });
                } else {
                    this.toggleTimer(); // Auto-pause at 0
                }
            }, 1000);
        }
        this.currentMatchSubject.next({ ...match });
        this.matchRepo.saveMatchState(match.id, match);
    }

    advanceQuarter(): void {
        const match = this.currentMatchSubject.getValue();
        if (!match) return;

        if (this.timerInterval) this.toggleTimer();

        match.currentQuarter++;
        match.timerState.remainingSeconds = 600; // Reset to 10 min (or config based)
        this.currentMatchSubject.next({ ...match });
        this.matchRepo.saveMatchState(match.id, match);
    }

    endMatch(): void {
        const match = this.currentMatchSubject.getValue();
        if (!match) return;

        if (this.timerInterval) this.toggleTimer();

        match.state = 'finalizado' as any;
        this.currentMatchSubject.next({ ...match });
        this.matchRepo.saveMatchState(match.id, match);
    }
}
