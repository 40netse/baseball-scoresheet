/**
 * Main application logic for the Baseball Scoresheet.
 */

(function () {
    const dateInput = document.getElementById('game-date');
    const loadGamesBtn = document.getElementById('load-games');
    const gameList = document.getElementById('game-list');
    const loadScorecardBtn = document.getElementById('load-scorecard');
    const awayTeamEl = document.getElementById('away-team');
    const homeTeamEl = document.getElementById('home-team');
    const gameStatusEl = document.getElementById('game-status');
    const venueEl = document.getElementById('venue');
    const awayTeamNameEl = document.getElementById('away-team-name');
    const homeTeamNameEl = document.getElementById('home-team-name');
    const awaySvg = document.getElementById('away-scorecard');
    const homeSvg = document.getElementById('home-scorecard');

    let currentWs = null;

    // Default to today's date
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;

    // Load games for the selected date
    loadGamesBtn.addEventListener('click', async () => {
        const date = dateInput.value;
        if (!date) return;

        gameList.innerHTML = '<option value="">Loading...</option>';
        loadScorecardBtn.disabled = true;

        try {
            const data = await ScoresheetAPI.getSchedule(date);
            gameList.innerHTML = '<option value="">-- Select a game --</option>';

            if (data.games && data.games.length > 0) {
                data.games.forEach(game => {
                    const option = document.createElement('option');
                    option.value = game.game_pk;
                    option.textContent = `${game.away_team} @ ${game.home_team} (${game.status})`;
                    gameList.appendChild(option);
                });
            } else {
                gameList.innerHTML = '<option value="">No games found</option>';
            }
        } catch (err) {
            console.error('Failed to load games:', err);
            gameList.innerHTML = '<option value="">Error loading games</option>';
        }
    });

    // Enable load button when a game is selected
    gameList.addEventListener('change', () => {
        loadScorecardBtn.disabled = !gameList.value;
    });

    // Load scorecard for the selected game
    loadScorecardBtn.addEventListener('click', async () => {
        const gamePk = gameList.value;
        if (!gamePk) return;

        // Close existing WebSocket
        if (currentWs) {
            currentWs.close();
            currentWs = null;
        }

        try {
            const scorecard = await ScoresheetAPI.getScorecard(gamePk);
            renderScorecard(scorecard);

            // If game is live, connect WebSocket
            if (scorecard.game_status === 'In Progress') {
                currentWs = ScoresheetAPI.connectLive(gamePk, (msg) => {
                    if (msg.type === 'scorecard') {
                        renderScorecard(msg.data);
                    }
                });
            }
        } catch (err) {
            console.error('Failed to load scorecard:', err);
        }
    });

    function renderScorecard(scorecard) {
        // Update game info
        awayTeamEl.textContent = scorecard.away_team?.team_name || 'Away';
        homeTeamEl.textContent = scorecard.home_team?.team_name || 'Home';
        gameStatusEl.textContent = scorecard.game_status || '';
        venueEl.textContent = scorecard.venue || '';
        awayTeamNameEl.textContent = scorecard.away_team?.team_name || 'Away';
        homeTeamNameEl.textContent = scorecard.home_team?.team_name || 'Home';

        // Render scorecards
        ScoresheetRenderer.render(awaySvg, scorecard.away_team || {});
        ScoresheetRenderer.render(homeSvg, scorecard.home_team || {});
    }
})();
