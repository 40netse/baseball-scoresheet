/**
 * SVG-based baseball scoresheet renderer — classic paper scorecard style.
 *
 * Matches the traditional layout from the Shelley Youth Baseball cheat sheet:
 *  - Diamond centered-left in each cell
 *  - Right sidebar with HR/3B/2B/1B/SAC/HP/BB labels (highlighted on reach)
 *  - Pitch count boxes in bottom-left corner
 *  - Hit lines from home plate into the field
 *  - Bold base-path lines for advancement, filled diamond on scoring
 *  - Circled out numbers, RBI X marks
 *  - End-of-inning arrow on the last out
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

// Layout constants
const CELL_W = 100;
const CELL_H = 100;
const NUM_COL_W = 30;       // batting order # column
const NAME_COL_W = 145;     // player name column
const POS_COL_W = 32;       // position column
const HEADER_W = NUM_COL_W + NAME_COL_W + POS_COL_W;
const HDR_H = 26;           // header row height
const DIAMOND_R = 18;       // diamond "radius" (center to vertex)
const SIDEBAR_W = 22;       // right sidebar inside each cell for reached-base labels
const TOTALS_COLS = ['AB', 'R', 'H', 'RBI'];
const TOTALS_COL_W = 34;
const SUMMARY_ROW_H = 24;   // bottom totals row

// Colors
const INK = '#1a1a1a';
const GRID = '#8b8070';
const GRID_LIGHT = '#c4b9aa';
const PAPER = '#fcf9f3';
const PAPER_ALT = '#f6f1e7';
const ACCENT = '#b22222';    // out numbers, end-of-inning arrow
const SCORE_FILL = '#b22222';  // bold red for scored runs — easy to spot
const HIT_REACHED = '#2e6b2e'; // green tint for reached-base sidebar highlight
const REACH_BG = '#d8ecd8';
const FLASH_BG = '#fff4b0';  // yellow flash for changed cells

// Which sidebar labels map to which result codes
const SIDEBAR_LABELS = ['HR', '3B', '2B', '1B', 'SAC', 'HP', 'BB'];
const REACH_MAP = {
    'HR': 'HR', '3B': '3B', '2B': '2B', '1B': '1B',
    'SAC': 'SAC', 'SF': 'SAC',
    'HP': 'HP', 'HBP': 'HP',
    'BB': 'BB', 'IBB': 'BB',
};

const ScoresheetRenderer = {

    /**
     * @param {SVGElement} svgEl
     * @param {Object} teamData
     * @param {number} totalInnings
     * @param {Set|null} changedCells - Set of "playerId:inning" strings that changed (for flash)
     */
    render(svgEl, teamData, totalInnings = 9, changedCells = null) {
        svgEl.innerHTML = '';

        const players = teamData.players || [];
        const numRows = Math.max(players.length, 9);
        const numInn = Math.max(totalInnings, 9);
        const W = HEADER_W + (numInn * CELL_W) + (TOTALS_COLS.length * TOTALS_COL_W) + 1;
        const H = HDR_H + (numRows * CELL_H) + SUMMARY_ROW_H + 1;

        svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
        svgEl.style.width = '100%';
        svgEl.style.height = 'auto';

        // SVG <defs> for flash animation
        const defs = document.createElementNS(SVG_NS, 'defs');
        svgEl.appendChild(defs);
        const anim = document.createElementNS(SVG_NS, 'style');
        anim.textContent = `
            @keyframes cell-flash {
                0%   { fill: ${FLASH_BG}; }
                50%  { fill: ${FLASH_BG}; }
                100% { fill: ${PAPER}; }
            }
            .cell-changed {
                animation: cell-flash 2s ease-out 1;
            }
        `;
        defs.appendChild(anim);

        // Paper background
        this._rect(svgEl, 0, 0, W, H, PAPER);

        // Render layers bottom-up: grid, then content on top
        const gridLayer = this._g(svgEl, 'grid');
        const contentLayer = this._g(svgEl, 'content');

        // Header row
        this._drawHeader(contentLayer, numInn, W);

        // Player rows
        players.forEach((player, idx) => {
            this._drawPlayerRow(contentLayer, player, idx, numInn, teamData, changedCells);
        });

        // Grid lines (on top of backgrounds, below content text — but we draw grid last
        // so the lines are crisp on top)
        this._drawGrid(gridLayer, numRows, numInn, W, H);

        // Summary row at bottom
        this._drawSummaryRow(contentLayer, teamData, numRows, numInn);
    },

    // ─── HEADER ───────────────────────────────────────────────

    _drawHeader(layer, numInn, W) {
        const g = this._g(layer, 'hdr');
        this._rect(g, 0, 0, W, HDR_H, '#3a3530');

        // Column headers
        this._txt(g, NUM_COL_W / 2, 17, '#', { anchor: 'middle', size: 10, bold: true, fill: '#c4b9aa' });
        this._txt(g, NUM_COL_W + 6, 17, 'PLAYER', { size: 10, bold: true, fill: '#f5f0e8' });
        this._txt(g, NUM_COL_W + NAME_COL_W + POS_COL_W / 2, 17, 'POS',
            { anchor: 'middle', size: 9, bold: true, fill: '#c4b9aa' });

        for (let i = 1; i <= numInn; i++) {
            const cx = HEADER_W + ((i - 1) * CELL_W) + CELL_W / 2;
            this._txt(g, cx, 18, String(i), { anchor: 'middle', size: 13, bold: true, fill: '#f5f0e8' });
        }

        TOTALS_COLS.forEach((label, idx) => {
            const cx = HEADER_W + (numInn * CELL_W) + (idx * TOTALS_COL_W) + TOTALS_COL_W / 2;
            this._txt(g, cx, 17, label, { anchor: 'middle', size: 9, bold: true, fill: '#c4b9aa' });
        });
    },

    // ─── PLAYER ROW ───────────────────────────────────────────

    _drawPlayerRow(layer, player, rowIdx, numInn, teamData, changedCells) {
        const y = HDR_H + rowIdx * CELL_H;
        const g = this._g(layer, `p${rowIdx}`);

        // Alternating row tint on name columns
        if (rowIdx % 2 === 1) {
            this._rect(g, 0, y, HEADER_W, CELL_H, PAPER_ALT);
        }

        // Batting order number
        this._txt(g, NUM_COL_W / 2, y + CELL_H / 2 + 5, String(player.batting_order || ''),
            { anchor: 'middle', size: 14, bold: true });

        // Player name
        const name = player.name || '';
        const display = name.length > 16 ? name.substring(0, 16) + '.' : name;
        this._txt(g, NUM_COL_W + 5, y + 28, display, { size: 11 });

        // Jersey number
        if (player.jersey_number) {
            this._txt(g, NUM_COL_W + 5, y + 42, `#${player.jersey_number}`, { size: 9, fill: '#999' });
        }

        // Sub indicator
        if (player.batting_order_seq > 0) {
            this._txt(g, NUM_COL_W + 5, y + 55, 'SUB', {
                size: 8, fill: ACCENT, bold: true
            });
        }

        // Position — split if position_changes exist
        const posChanges = player.position_changes || [];
        if (posChanges.length > 0) {
            const halfH = CELL_H / 2;
            this._txt(g, NUM_COL_W + NAME_COL_W + POS_COL_W / 2, y + 22,
                player.position || '', { anchor: 'middle', size: 10, bold: true });
            this._seg(g, [NUM_COL_W + NAME_COL_W, y + halfH],
                [HEADER_W, y + halfH], ACCENT, 1.5);
            const lastChange = posChanges[posChanges.length - 1];
            this._txt(g, NUM_COL_W + NAME_COL_W + POS_COL_W / 2, y + halfH + 18,
                lastChange.to_pos || '', { anchor: 'middle', size: 10, bold: true, fill: ACCENT });

            // Red vertical line at the inning where the position change happened
            for (const pc of posChanges) {
                if (pc.inning >= 1 && pc.inning <= numInn) {
                    const lx = HEADER_W + (pc.inning - 1) * CELL_W;
                    this._seg(g, [lx, y + 2], [lx, y + CELL_H - 2], ACCENT, 2.5);
                }
            }
        } else {
            this._txt(g, NUM_COL_W + NAME_COL_W + POS_COL_W / 2, y + CELL_H / 2 + 5,
                player.position || '', { anchor: 'middle', size: 13, bold: true });
        }

        // At-bat cells
        const atBats = player.at_bats || {};
        for (let inn = 1; inn <= numInn; inn++) {
            const ab = atBats[String(inn)];
            if (ab) {
                const cellX = HEADER_W + (inn - 1) * CELL_W;

                // Flash background if this cell changed
                const cellKey = `${player.player_id}:${inn}`;
                if (changedCells && changedCells.has(cellKey)) {
                    const flash = this._rect(g, cellX + 1, y + 1, CELL_W - 2, CELL_H - 2, FLASH_BG);
                    flash.setAttribute('class', 'cell-changed');
                }

                this._drawAtBat(g, cellX, y, ab, teamData);
            }
        }

        // Totals — compute from at_bats
        this._drawPlayerTotals(g, player, numInn, y);
    },

    _drawPlayerTotals(g, player, numInn, y) {
        const atBats = player.at_bats || {};
        let ab = 0, r = 0, h = 0, rbi = 0;
        for (const [, pa] of Object.entries(atBats)) {
            // AB excludes walks, HBP, sacrifices
            const res = (pa.result || '').toUpperCase();
            const isNotAB = ['BB', 'IBB', 'HP', 'HBP', 'INT'].includes(res)
                || res.startsWith('SAC') || res.startsWith('SF');
            if (!isNotAB) ab++;
            if (pa.bases_reached >= 4) r++;
            if (['1B', '2B', '3B', 'HR'].includes(res)) h++;
            rbi += pa.rbi || 0;
        }

        const vals = [ab, r, h, rbi];
        const baseX = HEADER_W + numInn * CELL_W;
        vals.forEach((v, i) => {
            this._txt(g, baseX + i * TOTALS_COL_W + TOTALS_COL_W / 2, y + CELL_H / 2 + 5,
                String(v), { anchor: 'middle', size: 13, bold: true });
        });
    },

    // ─── AT-BAT CELL ──────────────────────────────────────────

    _drawAtBat(parent, x, y, ab, teamData) {
        const g = this._g(parent);

        // Diamond area: offset left to leave room for sidebar
        const diamondAreaW = CELL_W - SIDEBAR_W;
        const cx = x + diamondAreaW / 2;
        const cy = y + CELL_H / 2 - 4;
        const d = DIAMOND_R;

        // Vertices: top=2B, right=1B, bottom=Home, left=3B
        const pts = {
            top:   [cx, cy - d],
            right: [cx + d, cy],
            bot:   [cx, cy + d],
            left:  [cx - d, cy],
        };

        const scored = (ab.bases_reached || 0) >= 4;

        // Draw diamond — dashed blue by default, solid red fill when scored
        const dPath = `M${pts.top[0]},${pts.top[1]}L${pts.right[0]},${pts.right[1]}` +
            `L${pts.bot[0]},${pts.bot[1]}L${pts.left[0]},${pts.left[1]}Z`;
        if (scored) {
            this._path(g, dPath, SCORE_FILL, SCORE_FILL, 2);
        } else {
            const diamond = this._path(g, dPath, 'none', '#2266aa', 1.2);
            diamond.setAttribute('stroke-dasharray', '4,3');

            // Bold black base-path lines where the batter advanced
            const basesReached = ab.bases_reached || 0;
            if (basesReached >= 1) this._seg(g, pts.bot, pts.right, INK, 3);
            if (basesReached >= 2) this._seg(g, pts.right, pts.top, INK, 3);
            if (basesReached >= 3) this._seg(g, pts.top, pts.left, INK, 3);
        }

        // Hit line from home plate into the field
        if (ab.hit_type && ab.result_type === 'hit') {
            this._drawHitLine(g, cx, cy, d, ab);
        }

        // ── Right sidebar: HR / 3B / 2B / 1B / SAC / HP / BB ──
        this._drawSidebar(g, x, y, ab);

        // ── Pitch count boxes (bottom-left of cell) ──
        this._drawPitchBoxes(g, x, y, ab.pitches || []);

        // ── Strikeout: big K (or Kc) centered in the diamond ──
        const notation = ab.result || '';
        const isStrikeout = notation === 'K' || notation === 'Ꝁ' || notation.startsWith('K ');
        const isCalledStrikeout = notation === 'Ꝁ';

        if (isStrikeout) {
            const kLabel = isCalledStrikeout ? 'Kc' : 'K';
            this._txt(g, cx, cy + 6, kLabel, {
                anchor: 'middle', size: 22, bold: true, fill: ACCENT
            });
        } else if (ab.is_out || ab.result_type === 'out' || ab.result_type === 'sacrifice') {
            // Other outs/sacrifices: notation centered inside the diamond, bold
            const outSize = notation.length > 6 ? 9 : notation.length > 4 ? 10 : 12;
            this._txt(g, cx, cy + 5, notation, {
                anchor: 'middle', size: outSize, bold: true
            });
        } else if (!REACH_MAP[notation]) {
            // Non-standard reach notations (FC, E-3, etc.) inside diamond
            this._txt(g, cx, cy + 5, notation, {
                anchor: 'middle', size: 12, bold: true
            });
        }

        // ── Out number (circled, top-right of diamond area) ──
        if (ab.is_out && ab.out_number) {
            const ox = x + diamondAreaW - 8;
            const oy = y + 12;
            this._circle(g, ox, oy, 8, 'none', ACCENT, 1.8);
            this._txt(g, ox, oy + 4, String(ab.out_number), {
                anchor: 'middle', size: 12, bold: true, fill: ACCENT
            });

            // End-of-inning arrow: solid line under the cell for 3rd out
            if (ab.out_number === 3) {
                const arrowY = y + CELL_H - 2;
                this._seg(g, [x + 4, arrowY], [x + diamondAreaW - 4, arrowY], ACCENT, 2.5);
                // Arrowhead
                const ax = x + diamondAreaW - 4;
                this._path(g,
                    `M${ax},${arrowY}L${ax - 6},${arrowY - 4}L${ax - 6},${arrowY + 4}Z`,
                    ACCENT, ACCENT, 0);
            }
        }

        // ── RBI marks (X's in bottom-left, above pitch boxes) ──
        if (ab.rbi > 0) {
            for (let r = 0; r < Math.min(ab.rbi, 4); r++) {
                this._txt(g, x + 4 + r * 10, y + 14, 'X', {
                    size: 10, bold: true, fill: HIT_REACHED
                });
            }
        }

        // ── Runner advancement annotations ──
        this._drawRunnerAnnotations(g, cx, cy, d, ab.runner_advancements || []);
    },

    // ─── SIDEBAR (HR/3B/2B/1B/SAC/HP/BB) ─────────────────────

    _drawSidebar(g, cellX, cellY, ab) {
        const sx = cellX + CELL_W - SIDEBAR_W;
        const labelH = CELL_H / SIDEBAR_LABELS.length;
        const resultFull = (ab.result || '').toUpperCase();
        // Match "SF-7" -> SAC, "SAC 1-3" -> SAC via prefix check
        let matched = REACH_MAP[resultFull] || null;
        if (!matched && resultFull.startsWith('SF')) matched = 'SAC';
        if (!matched && resultFull.startsWith('SAC')) matched = 'SAC';

        // Sidebar separator line
        this._seg(g, [sx, cellY + 1], [sx, cellY + CELL_H - 1], GRID_LIGHT, 0.5);

        SIDEBAR_LABELS.forEach((label, i) => {
            const ly = cellY + i * labelH;
            const isActive = matched === label;

            if (isActive) {
                // Highlight background
                this._rect(g, sx + 1, ly + 1, SIDEBAR_W - 2, labelH - 1, REACH_BG);
            }

            this._txt(g, sx + SIDEBAR_W / 2, ly + labelH / 2 + 3, label, {
                anchor: 'middle',
                size: 7,
                bold: isActive,
                fill: isActive ? HIT_REACHED : '#bbb',
            });

            // Subtle separator between sidebar labels
            if (i > 0) {
                this._seg(g, [sx + 2, ly], [sx + SIDEBAR_W - 2, ly], '#e0d8cc', 0.3);
            }
        });
    },

    // ─── PITCH COUNT (B/S/Fouls) ────────────────────────────

    _drawPitchBoxes(g, cellX, cellY, pitches) {
        // Count balls, strikes, fouls from pitch sequence
        let balls = 0, strikes = 0, fouls = 0;
        for (const p of pitches) {
            if (p.result === 'B') {
                balls++;
            } else if (p.result === 'F') {
                fouls++;
            } else {
                // S, C, X all count as strikes (up to 2 filled boxes; 3rd ends AB)
                strikes++;
            }
        }

        const boxSize = 7;
        const gap = 2;
        const startX = cellX + 3;
        const ballY = cellY + CELL_H - 28;
        const strikeY = ballY + boxSize + gap;
        const foulY = strikeY + boxSize + gap;

        // 3 ball boxes — filled from left for each ball taken
        for (let i = 0; i < 3; i++) {
            const bx = startX + i * (boxSize + gap);
            const filled = i < balls;
            this._rect(g, bx, ballY, boxSize, boxSize,
                filled ? '#4a7a4a' : 'none', '#999', 0.8);
        }

        // Label
        this._txt(g, startX + 3 * (boxSize + gap) + 1, ballY + boxSize - 1, 'B', {
            size: 6, fill: '#999'
        });

        // 2 strike boxes — filled from left for each strike
        for (let i = 0; i < 2; i++) {
            const bx = startX + i * (boxSize + gap);
            const filled = i < strikes;
            this._rect(g, bx, strikeY, boxSize, boxSize,
                filled ? ACCENT : 'none', '#999', 0.8);
        }

        // Label
        this._txt(g, startX + 2 * (boxSize + gap) + 1, strikeY + boxSize - 1, 'S', {
            size: 6, fill: '#999'
        });

        // Foul slashes
        if (fouls > 0) {
            for (let i = 0; i < Math.min(fouls, 6); i++) {
                const fx = startX + i * 6;
                this._txt(g, fx, foulY + 6, '/', {
                    size: 8, fill: '#999'
                });
            }
        }
    },

    // ─── HIT LINE ─────────────────────────────────────────────

    _drawHitLine(g, cx, cy, d, ab) {
        // Skip HRs — filled diamond is enough
        if (ab.result === 'HR') return;

        const homeX = cx;
        const homeY = cy + d;
        const hitLen = d * 2.2;

        const fielders = ab.fielders || [];
        const firstFielder = fielders.length > 0 ? fielders[0] : 8;

        // All angles stay INSIDE the baselines (-45° is 1B line, -135° is 3B line)
        const angles = {
            1: -90, 2: -90, 3: -55, 4: -70,
            5: -110, 6: -95, 7: -125, 8: -90, 9: -55,
        };
        const angleDeg = angles[firstFielder] || -90;
        const angleRad = angleDeg * Math.PI / 180;

        const endX = homeX + Math.cos(angleRad) * hitLen;
        const endY = homeY + Math.sin(angleRad) * hitLen;

        // All hit lines are solid
        this._seg(g, [homeX, homeY], [endX, endY], INK, 1.5);
    },

    // ─── RUNNER ANNOTATIONS ───────────────────────────────────

    _drawRunnerAnnotations(g, cx, cy, d, advancements) {
        const baseCoords = {
            0: [cx, cy + d],       // home
            1: [cx + d, cy],       // 1st
            2: [cx, cy - d],       // 2nd
            3: [cx - d, cy],       // 3rd
            4: [cx, cy + d],       // score = home
        };

        const labelOffset = (segFrom, segTo) => {
            const mx = (segFrom[0] + segTo[0]) / 2;
            const my = (segFrom[1] + segTo[1]) / 2;
            const ddx = mx - cx, ddy = my - cy;
            const len = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
            return [mx + (ddx / len) * 10, my + (ddy / len) * 8];
        };

        for (const adv of advancements) {
            const from = adv.from_base || 0;
            const to = adv.is_out ? Math.min(from + 1, 4) : (adv.to_base || 0);

            let label = adv.method || '';
            if (!label || from === to) continue;
            if (label.length > 8) label = label.substring(0, 8);

            if (adv.is_out) {
                const fromPt = baseCoords[from] || baseCoords[0];
                const toPt = baseCoords[to] || baseCoords[0];
                const pathLine = this._seg(g, fromPt, toPt, ACCENT, 1.5);
                pathLine.setAttribute('stroke-dasharray', '3,2');

                const midX = (fromPt[0] + toPt[0]) / 2;
                const midY = (fromPt[1] + toPt[1]) / 2;
                const dx = toPt[0] - fromPt[0];
                const dy = toPt[1] - fromPt[1];
                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                const perpX = -dy / len * 6;
                const perpY = dx / len * 6;
                this._seg(g,
                    [midX - perpX, midY - perpY],
                    [midX + perpX, midY + perpY],
                    ACCENT, 2);

                const [lx, ly] = labelOffset(fromPt, toPt);
                this._txt(g, lx, ly, label, {
                    anchor: 'middle', size: 7, fill: ACCENT, bold: true,
                });
            } else {
                // Place label on the LAST segment of the runner's path
                const lastFrom = Math.max(from, (to >= 4 ? 3 : to - 1));
                const lastTo = to >= 4 ? 4 : to;
                const segA = baseCoords[lastFrom] || baseCoords[0];
                const segB = baseCoords[lastTo] || baseCoords[0];
                const [lx, ly] = labelOffset(segA, segB);
                this._txt(g, lx, ly, label, {
                    anchor: 'middle', size: 7, fill: '#2266aa', bold: true,
                });
            }
        }
    },

    // ─── GRID ─────────────────────────────────────────────────

    _drawGrid(gridLayer, numRows, numInn, W, H) {
        const g = this._g(gridLayer, 'lines');
        const gridBottom = HDR_H + numRows * CELL_H;
        const rightEdge = HEADER_W + numInn * CELL_W + TOTALS_COLS.length * TOTALS_COL_W;

        // Outer border
        this._rect(g, 0, 0, rightEdge, gridBottom + SUMMARY_ROW_H, 'none', '#3a3530', 2);

        // Horizontal row lines
        for (let i = 0; i <= numRows; i++) {
            const y = HDR_H + i * CELL_H;
            this._seg(g, [0, y], [rightEdge, y], GRID, 0.8);
        }

        // Summary row top line
        this._seg(g, [0, gridBottom], [rightEdge, gridBottom], '#3a3530', 1.5);

        // Vertical: batting order | name | pos | innings... | totals...
        this._seg(g, [NUM_COL_W, HDR_H], [NUM_COL_W, gridBottom + SUMMARY_ROW_H], GRID_LIGHT, 0.6);
        this._seg(g, [NUM_COL_W + NAME_COL_W, HDR_H], [NUM_COL_W + NAME_COL_W, gridBottom + SUMMARY_ROW_H], GRID_LIGHT, 0.6);
        this._seg(g, [HEADER_W, 0], [HEADER_W, gridBottom + SUMMARY_ROW_H], '#3a3530', 1.5);

        // Inning column lines
        for (let i = 1; i <= numInn; i++) {
            const lx = HEADER_W + i * CELL_W;
            this._seg(g, [lx, HDR_H], [lx, gridBottom + SUMMARY_ROW_H], GRID, 0.8);
        }

        // Totals separator (heavier line before totals)
        const totalsX = HEADER_W + numInn * CELL_W;
        this._seg(g, [totalsX, 0], [totalsX, gridBottom + SUMMARY_ROW_H], '#3a3530', 1.5);

        for (let i = 1; i < TOTALS_COLS.length; i++) {
            const lx = totalsX + i * TOTALS_COL_W;
            this._seg(g, [lx, HDR_H], [lx, gridBottom + SUMMARY_ROW_H], GRID_LIGHT, 0.6);
        }
    },

    // ─── SUMMARY ROW ──────────────────────────────────────────

    _drawSummaryRow(layer, teamData, numRows, numInn) {
        const y = HDR_H + numRows * CELL_H;
        const g = this._g(layer, 'summary');

        this._rect(g, 0, y, HEADER_W + numInn * CELL_W + TOTALS_COLS.length * TOTALS_COL_W,
            SUMMARY_ROW_H, PAPER_ALT);

        this._txt(g, NUM_COL_W + 6, y + 17, 'RUNS', { size: 10, bold: true, fill: '#666' });

        // Per-inning run totals
        const inningTotals = teamData.inning_totals || [];
        const innMap = {};
        inningTotals.forEach(it => { innMap[it.inning] = it; });

        for (let i = 1; i <= numInn; i++) {
            const it = innMap[i];
            const cx = HEADER_W + (i - 1) * CELL_W + CELL_W / 2;
            const val = it ? String(it.runs) : '';
            this._txt(g, cx, y + 17, val, { anchor: 'middle', size: 13, bold: true });
        }

        // Grand totals
        const totalsX = HEADER_W + numInn * CELL_W;
        const totals = [
            '', // AB — sum displayed per-player only
            String(teamData.total_runs || 0),
            String(teamData.total_hits || 0),
            '', // RBI — sum per-player only
        ];
        totals.forEach((v, i) => {
            if (v) {
                this._txt(g, totalsX + i * TOTALS_COL_W + TOTALS_COL_W / 2, y + 17,
                    v, { anchor: 'middle', size: 13, bold: true });
            }
        });
    },

    // ─── SVG PRIMITIVES ───────────────────────────────────────

    _g(parent, id) {
        const g = document.createElementNS(SVG_NS, 'g');
        if (id) g.setAttribute('id', id);
        parent.appendChild(g);
        return g;
    },

    _txt(parent, x, y, text, opts = {}) {
        const el = document.createElementNS(SVG_NS, 'text');
        el.setAttribute('x', x);
        el.setAttribute('y', y);
        el.textContent = text;
        el.style.fontFamily = "'Courier New', monospace";
        el.style.fontSize = (opts.size || 11) + 'px';
        if (opts.bold) el.style.fontWeight = 'bold';
        if (opts.fill) el.style.fill = opts.fill; else el.style.fill = INK;
        if (opts.anchor) el.setAttribute('text-anchor', opts.anchor);
        parent.appendChild(el);
        return el;
    },

    _seg(parent, from, to, color = INK, width = 1) {
        const l = document.createElementNS(SVG_NS, 'line');
        l.setAttribute('x1', from[0]);
        l.setAttribute('y1', from[1]);
        l.setAttribute('x2', to[0]);
        l.setAttribute('y2', to[1]);
        l.setAttribute('stroke', color);
        l.setAttribute('stroke-width', width);
        parent.appendChild(l);
        return l;
    },

    _rect(parent, x, y, w, h, fill = 'none', stroke = 'none', sw = 0) {
        const r = document.createElementNS(SVG_NS, 'rect');
        r.setAttribute('x', x);
        r.setAttribute('y', y);
        r.setAttribute('width', w);
        r.setAttribute('height', h);
        r.setAttribute('fill', fill);
        if (stroke !== 'none') {
            r.setAttribute('stroke', stroke);
            r.setAttribute('stroke-width', sw);
        }
        parent.appendChild(r);
        return r;
    },

    _circle(parent, cx, cy, r, fill = 'none', stroke = INK, sw = 1) {
        const c = document.createElementNS(SVG_NS, 'circle');
        c.setAttribute('cx', cx);
        c.setAttribute('cy', cy);
        c.setAttribute('r', r);
        c.setAttribute('fill', fill);
        c.setAttribute('stroke', stroke);
        c.setAttribute('stroke-width', sw);
        parent.appendChild(c);
        return c;
    },

    _path(parent, d, fill = 'none', stroke = INK, sw = 1) {
        const p = document.createElementNS(SVG_NS, 'path');
        p.setAttribute('d', d);
        p.setAttribute('fill', fill);
        p.setAttribute('stroke', stroke);
        p.setAttribute('stroke-width', sw);
        parent.appendChild(p);
        return p;
    },
};
