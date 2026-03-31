/**
 * Main application logic for the Baseball Scoresheet.
 */

(function () {
    const dateInput = document.getElementById('game-date');
    const loadGamesBtn = document.getElementById('load-games');
    const gameList = document.getElementById('game-list');
    const loadScorecardBtn = document.getElementById('load-scorecard');
    const gameInfoEl = document.getElementById('game-info');
    const awayTeamEl = document.getElementById('away-team');
    const homeTeamEl = document.getElementById('home-team');
    const gameStatusEl = document.getElementById('game-status');
    const venueEl = document.getElementById('venue');
    const awaySheetEl = document.getElementById('away-sheet');
    const homeSheetEl = document.getElementById('home-sheet');
    const awayTeamNameEl = document.getElementById('away-team-name');
    const homeTeamNameEl = document.getElementById('home-team-name');
    const awaySvg = document.getElementById('away-scorecard');
    const homeSvg = document.getElementById('home-scorecard');
    const linescoreContainer = document.getElementById('linescore-container');
    const linescoreHead = document.querySelector('#linescore thead tr');
    const linescoreBody = document.querySelector('#linescore tbody');

    let currentWs = null;

    // Default to today
    dateInput.value = new Date().toISOString().split('T')[0];

    // ─── Load Games ───────────────────────────────────────────

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
                    const opt = document.createElement('option');
                    opt.value = game.game_pk;
                    const time = new Date(game.game_time).toLocaleTimeString([], {
                        hour: 'numeric', minute: '2-digit'
                    });
                    opt.textContent = `${game.away_team} @ ${game.home_team} — ${time} (${game.status})`;
                    gameList.appendChild(opt);
                });
            } else {
                gameList.innerHTML = '<option value="">No games found</option>';
            }
        } catch (err) {
            console.error('Failed to load games:', err);
            gameList.innerHTML = '<option value="">Error — is the backend running?</option>';
        }
    });

    gameList.addEventListener('change', () => {
        loadScorecardBtn.disabled = !gameList.value;
    });

    // ─── Load Scorecard ───────────────────────────────────────

    loadScorecardBtn.addEventListener('click', async () => {
        const gamePk = gameList.value;
        if (!gamePk) return;

        if (currentWs) { currentWs.close(); currentWs = null; }

        loadScorecardBtn.textContent = 'Loading...';
        loadScorecardBtn.disabled = true;

        try {
            const scorecard = await ScoresheetAPI.getScorecard(gamePk);
            renderScorecard(scorecard);

            if (scorecard.game_status === 'In Progress') {
                currentWs = ScoresheetAPI.connectLive(gamePk, (msg) => {
                    if (msg.type === 'scorecard') renderScorecard(msg.data);
                });
            }
        } catch (err) {
            console.error('Failed to load scorecard:', err);
        } finally {
            loadScorecardBtn.textContent = 'Load Scorecard';
            loadScorecardBtn.disabled = false;
        }
    });

    // ─── Render ───────────────────────────────────────────────

    function renderScorecard(sc) {
        const away = sc.away_team || {};
        const home = sc.home_team || {};
        const totalInnings = sc.total_innings || 9;

        // Show sections
        gameInfoEl.style.display = '';
        awaySheetEl.style.display = '';
        homeSheetEl.style.display = '';
        linescoreContainer.style.display = '';

        // Game info
        awayTeamEl.textContent = away.team_abbreviation || away.team_name || 'Away';
        homeTeamEl.textContent = home.team_abbreviation || home.team_name || 'Home';
        gameStatusEl.textContent = sc.game_status || '';
        venueEl.textContent = `${sc.game_date || ''} \u2014 ${sc.venue || ''}`;

        // Team headers
        awayTeamNameEl.textContent = `${away.team_name || 'Away'} (Visiting)`;
        homeTeamNameEl.textContent = `${home.team_name || 'Home'}`;

        // SVG scorecards
        ScoresheetRenderer.render(awaySvg, away, totalInnings);
        ScoresheetRenderer.render(homeSvg, home, totalInnings);

        // Linescore
        renderLinescore(sc, totalInnings);
    }

    function renderLinescore(sc, totalInnings) {
        const away = sc.away_team || {};
        const home = sc.home_team || {};

        // Header
        linescoreHead.innerHTML = '<th></th>';
        for (let i = 1; i <= totalInnings; i++) {
            linescoreHead.innerHTML += `<th>${i}</th>`;
        }
        linescoreHead.innerHTML += '<th>R</th><th>H</th><th>E</th>';

        // Rows
        linescoreBody.innerHTML = '';

        for (const data of [away, home]) {
            const tr = document.createElement('tr');
            const td0 = document.createElement('td');
            td0.textContent = data.team_abbreviation || '';
            tr.appendChild(td0);

            const innMap = {};
            (data.inning_totals || []).forEach(it => { innMap[it.inning] = it; });

            for (let i = 1; i <= totalInnings; i++) {
                const td = document.createElement('td');
                td.textContent = innMap[i] ? String(innMap[i].runs) : '';
                tr.appendChild(td);
            }

            [data.total_runs || 0, data.total_hits || 0, data.total_errors || 0].forEach(v => {
                const td = document.createElement('td');
                td.textContent = String(v);
                td.style.fontWeight = 'bold';
                tr.appendChild(td);
            });

            linescoreBody.appendChild(tr);
        }
    }
})();
