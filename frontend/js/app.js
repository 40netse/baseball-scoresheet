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
    const linescoreBody = document.querySelector('#linescore tbody');
    const linescoreHead = document.querySelector('#linescore thead tr');

    let currentWs = null;

    // Default to today's date
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;

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
            gameList.innerHTML = '<option value="">Error loading games - is the backend running?</option>';
        }
    });

    gameList.addEventListener('change', () => {
        loadScorecardBtn.disabled = !gameList.value;
    });

    loadScorecardBtn.addEventListener('click', async () => {
        const gamePk = gameList.value;
        if (!gamePk) return;

        if (currentWs) {
            currentWs.close();
            currentWs = null;
        }

        loadScorecardBtn.textContent = 'Loading...';
        loadScorecardBtn.disabled = true;

        try {
            const scorecard = await ScoresheetAPI.getScorecard(gamePk);
            renderScorecard(scorecard);

            if (scorecard.game_status === 'In Progress') {
                currentWs = ScoresheetAPI.connectLive(gamePk, (msg) => {
                    if (msg.type === 'scorecard') {
                        renderScorecard(msg.data);
                    }
                });
            }
        } catch (err) {
            console.error('Failed to load scorecard:', err);
        } finally {
            loadScorecardBtn.textContent = 'Load Scorecard';
            loadScorecardBtn.disabled = false;
        }
    });

    function renderScorecard(scorecard) {
        const away = scorecard.away_team || {};
        const home = scorecard.home_team || {};
        const totalInnings = scorecard.total_innings || 9;

        // Game info bar
        awayTeamEl.textContent = away.team_abbreviation || away.team_name || 'Away';
        homeTeamEl.textContent = home.team_abbreviation || home.team_name || 'Home';
        gameStatusEl.textContent = scorecard.game_status || '';
        venueEl.textContent = `${scorecard.game_date || ''} — ${scorecard.venue || ''}`;

        // Team headers
        awayTeamNameEl.textContent = away.team_name || 'Away';
        homeTeamNameEl.textContent = home.team_name || 'Home';

        // Render SVG scorecards
        ScoresheetRenderer.render(awaySvg, away, totalInnings);
        ScoresheetRenderer.render(homeSvg, home, totalInnings);

        // Line score table
        renderLinescore(scorecard);
    }

    function renderLinescore(scorecard) {
        const away = scorecard.away_team || {};
        const home = scorecard.home_team || {};
        const totalInnings = scorecard.total_innings || 9;

        // Rebuild header
        linescoreHead.innerHTML = '<th>Team</th>';
        for (let i = 1; i <= totalInnings; i++) {
            linescoreHead.innerHTML += `<th>${i}</th>`;
        }
        linescoreHead.innerHTML += '<th>R</th><th>H</th><th>E</th>';

        // Build rows
        linescoreBody.innerHTML = '';

        for (const [team, data] of [['away', away], ['home', home]]) {
            const tr = document.createElement('tr');
            const nameTd = document.createElement('td');
            nameTd.textContent = data.team_abbreviation || data.team_name || '';
            tr.appendChild(nameTd);

            const inningTotals = data.inning_totals || [];
            const inningMap = {};
            inningTotals.forEach(it => { inningMap[it.inning] = it; });

            for (let i = 1; i <= totalInnings; i++) {
                const td = document.createElement('td');
                const it = inningMap[i];
                td.textContent = it ? String(it.runs) : '';
                tr.appendChild(td);
            }

            // R, H, E
            for (const val of [data.total_runs || 0, data.total_hits || 0, data.total_errors || 0]) {
                const td = document.createElement('td');
                td.textContent = String(val);
                td.style.fontWeight = 'bold';
                tr.appendChild(td);
            }

            linescoreBody.appendChild(tr);
        }
    }
})();
