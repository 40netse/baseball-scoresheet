/**
 * Main application logic for the Baseball Scoresheet.
 */

(function () {
    const headerBar = document.getElementById('header-bar');
    const gameView = document.getElementById('game-view');
    const backBtn = document.getElementById('back-btn');
    const dateInput = document.getElementById('game-date');
    const loadGamesBtn = document.getElementById('load-games');
    const gameList = document.getElementById('game-list');
    const loadScorecardBtn = document.getElementById('load-scorecard');
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
    const linescoreHead = document.querySelector('#linescore thead tr');
    const linescoreBody = document.querySelector('#linescore tbody');

    let currentWs = null;
    let previousScorecard = null;
    let activeTeam = 'away';
    let autoSwitch = true;

    dateInput.value = new Date().toISOString().split('T')[0];

    // ─── View Switching ───────────────────────────────────────

    function showGameView() {
        headerBar.style.display = 'none';
        gameView.style.display = '';
    }

    function showSelectorView() {
        if (currentWs) { currentWs.close(); currentWs = null; }
        previousScorecard = null;
        headerBar.style.display = '';
        gameView.style.display = 'none';
    }

    backBtn.addEventListener('click', showSelectorView);

    document.getElementById('print-btn').addEventListener('click', () => {
        // Show both team sheets for printing (one per page)
        awaySheetEl.style.display = '';
        homeSheetEl.style.display = '';
        window.print();
        // Restore single-team view after print dialog closes
        showTeam(activeTeam);
    });

    // ─── Team Toggle (click team names in game bar) ───────────

    function showTeam(side) {
        activeTeam = side;
        if (side === 'away') {
            awaySheetEl.style.display = '';
            homeSheetEl.style.display = 'none';
            awayTeamEl.classList.add('team-active');
            awayTeamEl.classList.remove('team-inactive');
            homeTeamEl.classList.remove('team-active');
            homeTeamEl.classList.add('team-inactive');
        } else {
            awaySheetEl.style.display = 'none';
            homeSheetEl.style.display = '';
            homeTeamEl.classList.add('team-active');
            homeTeamEl.classList.remove('team-inactive');
            awayTeamEl.classList.remove('team-active');
            awayTeamEl.classList.add('team-inactive');
        }
    }

    awayTeamEl.addEventListener('click', () => {
        autoSwitch = false;
        showTeam('away');
    });

    homeTeamEl.addEventListener('click', () => {
        autoSwitch = false;
        showTeam('home');
    });

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
        previousScorecard = null;
        autoSwitch = true;

        loadScorecardBtn.textContent = 'Loading...';
        loadScorecardBtn.disabled = true;

        try {
            const scorecard = await ScoresheetAPI.getScorecard(gamePk);
            showGameView();
            renderScorecard(scorecard, false);

            if (scorecard.game_status === 'In Progress') {
                currentWs = ScoresheetAPI.connectLive(gamePk, (msg) => {
                    if (msg.type === 'scorecard') renderScorecard(msg.data, true);
                });
            }
        } catch (err) {
            console.error('Failed to load scorecard:', err);
        } finally {
            loadScorecardBtn.textContent = 'Load Scorecard';
            loadScorecardBtn.disabled = false;
        }
    });

    // ─── Change Detection ─────────────────────────────────────

    function buildFingerprint(sc) {
        const fp = new Map();
        for (const [side, team] of [['away', sc.away_team], ['home', sc.home_team]]) {
            if (!team) continue;
            for (const player of (team.players || [])) {
                for (const [inn, ab] of Object.entries(player.at_bats || {})) {
                    const key = `${side}:${player.player_id}:${inn}`;
                    const pitchSig = (ab.pitches || []).map(p => p.result).join('');
                    fp.set(key, `${ab.result}|${pitchSig}|${ab.bases_reached}|${ab.rbi}|${ab.out_number}`);
                }
            }
            for (const it of (team.inning_totals || [])) {
                fp.set(`${side}:linescore:${it.inning}`, `${it.runs}|${it.hits}|${it.errors}`);
            }
            fp.set(`${side}:totals`, `${team.total_runs}|${team.total_hits}|${team.total_errors}`);
        }
        return fp;
    }

    function detectChanges(oldFp, newFp) {
        const changed = new Set();
        if (!oldFp) return changed;
        for (const [key, val] of newFp) {
            if (!oldFp.has(key) || oldFp.get(key) !== val) {
                changed.add(key);
            }
        }
        return changed;
    }

    // ─── Render ───────────────────────────────────────────────

    function renderScorecard(sc, isLiveUpdate) {
        const away = sc.away_team || {};
        const home = sc.home_team || {};
        const totalInnings = sc.total_innings || 9;

        const newFp = buildFingerprint(sc);
        const changed = detectChanges(previousScorecard, newFp);
        previousScorecard = newFp;

        const changedCells = { away: new Set(), home: new Set() };
        for (const key of changed) {
            const parts = key.split(':');
            const side = parts[0];
            if (parts[1] === 'linescore' || parts[1] === 'totals') continue;
            changedCells[side].add(`${parts[1]}:${parts[2]}`);
        }

        // Game bar
        const awayAbbr = away.team_abbreviation || away.team_name || 'Away';
        const homeAbbr = home.team_abbreviation || home.team_name || 'Home';

        const isLive = sc.game_status === 'In Progress';
        const statusText = isLive
            ? `LIVE \u2014 ${sc.is_top_inning ? 'Top' : 'Bot'} ${sc.current_inning}`
            : (sc.game_status || '');
        gameStatusEl.textContent = statusText;
        gameStatusEl.className = isLive ? 'live-pulse' : '';

        venueEl.textContent = `${sc.game_date || ''} \u2014 ${sc.venue || ''}`;

        // Auto-switch to batting team
        if (isLive && autoSwitch) {
            const battingTeam = sc.is_top_inning ? 'away' : 'home';
            showTeam(battingTeam);
        } else if (!isLiveUpdate) {
            showTeam('away');
        }

        // Team names with auto indicator
        awayTeamEl.innerHTML = awayAbbr +
            (isLive && autoSwitch && sc.is_top_inning ? '<span class="auto-indicator"></span>' : '');
        homeTeamEl.innerHTML = homeAbbr +
            (isLive && autoSwitch && !sc.is_top_inning ? '<span class="auto-indicator"></span>' : '');
        showTeam(activeTeam);

        // Team sheet headers
        awayTeamNameEl.textContent = `${away.team_name || 'Away'} (Visiting)`;
        homeTeamNameEl.textContent = `${home.team_name || 'Home'}`;

        // Render both scorecards
        ScoresheetRenderer.render(awaySvg, away, totalInnings,
            isLiveUpdate ? changedCells.away : null);
        ScoresheetRenderer.render(homeSvg, home, totalInnings,
            isLiveUpdate ? changedCells.home : null);

        // Pitcher boxes (side by side above scoresheet)
        renderPitcherBox(document.getElementById('away-pitchers'), away,
            away.team_abbreviation || 'Away');
        renderPitcherBox(document.getElementById('home-pitchers'), home,
            home.team_abbreviation || 'Home');

        // Linescore
        const linescoreChanged = isLiveUpdate && [...changed].some(k =>
            k.includes('linescore') || k.includes('totals'));
        renderLinescore(sc, totalInnings, linescoreChanged);

        if (isLiveUpdate && changed.size > 0 && isLive) {
            showUpdateFlash();
        }
    }

    function showUpdateFlash() {
        let el = document.getElementById('update-flash');
        if (!el) {
            el = document.createElement('div');
            el.id = 'update-flash';
            document.getElementById('game-top-bar').appendChild(el);
        }
        const now = new Date().toLocaleTimeString([], {
            hour: 'numeric', minute: '2-digit', second: '2-digit'
        });
        el.textContent = `Updated ${now}`;
        el.classList.remove('flash');
        void el.offsetWidth;
        el.classList.add('flash');
    }

    // ─── Pitcher Box ────────────────────────────────────────

    function renderPitcherBox(container, teamData, teamLabel) {
        const pitchers = teamData.pitchers || [];
        if (pitchers.length === 0) {
            container.innerHTML = '';
            return;
        }

        const cols = ['PITCHER', 'IP', 'H', 'R', 'ER', 'BB', 'K', 'HR', 'P/S'];

        let html = `<h3>${teamLabel} Pitching</h3><table><thead><tr>`;
        cols.forEach(c => { html += `<th>${c}</th>`; });
        html += '</tr></thead><tbody>';

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

            const ipParts = String(p.ip).split('.');
            totIP += parseInt(ipParts[0] || '0') * 3 + parseInt(ipParts[1] || '0');
            totH += p.hits || 0;
            totR += p.runs || 0;
            totER += p.earned_runs || 0;
            totBB += p.walks || 0;
            totK += p.strikeouts || 0;
            totHR += p.home_runs || 0;
            totPC += p.pitches || 0;
            totST += p.strikes || 0;
        });

        html += '<tr class="totals-row">';
        html += `<td>TOTALS</td>`;
        html += `<td>${Math.floor(totIP / 3)}.${totIP % 3}</td>`;
        html += `<td>${totH}</td><td>${totR}</td><td>${totER}</td>`;
        html += `<td>${totBB}</td><td>${totK}</td><td>${totHR}</td>`;
        html += `<td><span class="pitch-count">${totPC}-${totST}</span></td>`;
        html += '</tr></tbody></table>';
        container.innerHTML = html;
    }

    // ─── Linescore ────────────────────────────────────────────

    function renderLinescore(sc, totalInnings, flash) {
        const away = sc.away_team || {};
        const home = sc.home_team || {};

        linescoreHead.innerHTML = '<th></th>';
        for (let i = 1; i <= totalInnings; i++) {
            linescoreHead.innerHTML += `<th>${i}</th>`;
        }
        linescoreHead.innerHTML += '<th>R</th><th>H</th><th>E</th>';

        linescoreBody.innerHTML = '';

        for (const data of [away, home]) {
            const tr = document.createElement('tr');
            if (flash) tr.classList.add('linescore-flash');

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
