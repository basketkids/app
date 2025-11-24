# Service Usage Guide

This project uses a set of service classes to abstract interactions with the Firebase Realtime Database.

## Initialization

All services require a reference to the Firebase Database instance.

```javascript
const db = firebase.database();

const teamService = new TeamService(db);
const matchService = new MatchService(db);
const competitionService = new CompetitionService(db);
const playerService = new PlayerService(db);
```

## TeamService

Handles team operations.

-   **`getAll(userId, callback)`**: Listens for changes in the user's teams.
    ```javascript
    teamService.getAll(userId, (snapshot) => {
        snapshot.forEach(child => {
            console.log(child.key, child.val());
        });
    });
    ```
-   **`create(userId, name)`**: Creates a new team.
-   **`delete(userId, teamId)`**: Deletes a team.
-   **`get(userId, teamId)`**: Gets a single team once.

## MatchService

Handles match operations and syncs with global matches.

-   **`get(userId, teamId, compId, matchId)`**: Gets match data once.
-   **`updateStatus(..., status)`**: Updates match status ('pendiente', 'en curso', 'finalizado').
-   **`updateStats(..., stats)`**: Updates player statistics.
-   **`updateConvocados(..., convocados)`**: Updates the list of called up players.
-   **`updatePista(..., playersInCourt)`**: Updates the players currently on the court.

## CompetitionService

Handles competition and rival management.

-   **`get(userId, teamId, compId)`**: Gets competition data.
-   **`getRivals(..., callback)`**: Listens for rivals.
-   **`addRival(...)`**: Adds a new rival.
-   **`getMatches(..., callback)`**: Listens for matches in a competition.
-   **`createMatch(...)`**: Creates a new match.

## PlayerService

Handles player (squad) data.

-   **`getSquad(userId, teamId)`**: Gets the team's squad once.
