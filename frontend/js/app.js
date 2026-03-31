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

        // Pitcher boxes
        renderPitcherBox(document.getElementById('away-pitchers'), away);
        renderPitcherBox(document.getElementById('home-pitchers'), home);

        // Linescore
        renderLinescore(sc, totalInnings);
    }

    // ─── Pitcher Box ────────────────────────────────────────

    function renderPitcherBox(container, teamData) {
        const pitchers = teamData.pitchers || [];
        if (pitchers.length === 0) {
            container.innerHTML = '';
            return;
        }

        const cols = ['PITCHER', 'IP', 'H', 'R', 'ER', 'BB', 'K', 'HR', 'PC-ST'];

        let html = '<h3>Pitching</h3><table><thead><tr>';
        cols.forEach(c => { html += `<th>${c}</th>`; });
        html += '</tr></thead><tbody>';

        // Totals accumulators
        let totIP = 0, totH = 0, totR = 0, totER = 0, totBB = 0, totK = 0, totHR = 0, totPC = 0, totST = 0;

        pitchers.forEach(p => {
            const decision = p.decision
                ? `<span class="decision decision-${p.decision}">${p.decision}</span>`
                : '';
            const nameCell = `#${p.jersey_number || '?'} ${p.name}${decision}`;
            const pcStr = `<span class="pitch-count">${p.pitches}-${p.strikes}</span>`;

            html += '<tr>';
            html += `<td>${nameCell}</td>`;
            html += `<td>${p.ip}</td>`;
            html += `<td>${p.hits}</td>`;
            html += `<td>${p.runs}</td>`;
            html += `<td>${p.earned_runs}</td>`;
            html += `<td>${p.walks}</td>`;
            html += `<td>${p.strikeouts}</td>`;
            html += `<td>${p.home_runs}</td>`;
            html += `<td>${pcStr}</td>`;
            html += '</tr>';

            // Parse IP for totals (e.g., "5.2" means 5 and 2/3)
            const ipParts = String(p.ip).split('.');
            const wholeInnings = parseInt(ipParts[0] || '0');
            const thirds = parseInt(ipParts[1] || '0');
            totIP += wholeInnings * 3 + thirds;

            totH += p.hits || 0;
            totR += p.runs || 0;
            totER += p.earned_runs || 0;
            totBB += p.walks || 0;
            totK += p.strikeouts || 0;
            totHR += p.home_runs || 0;
            totPC += p.pitches || 0;
            totST += p.strikes || 0;
        });

        // Totals row
        const totalIPWhole = Math.floor(totIP / 3);
        const totalIPThirds = totIP % 3;
        const totalIPStr = `${totalIPWhole}.${totalIPThirds}`;

        html += '<tr class="totals-row">';
        html += `<td>TOTALS</td>`;
        html += `<td>${totalIPStr}</td>`;
        html += `<td>${totH}</td>`;
        html += `<td>${totR}</td>`;
        html += `<td>${totER}</td>`;
        html += `<td>${totBB}</td>`;
        html += `<td>${totK}</td>`;
        html += `<td>${totHR}</td>`;
        html += `<td><span class="pitch-count">${totPC}-${totST}</span></td>`;
        html += '</tr>';

        html += '</tbody></table>';
        container.innerHTML = html;
    }

    // ─── Linescore ────────────────────────────────────────────

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
