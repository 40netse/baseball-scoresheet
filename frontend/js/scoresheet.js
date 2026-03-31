/**
 * SVG-based baseball scoresheet renderer.
 *
 * Renders a traditional baseball scorecard with:
 * - Player names and positions in the left columns
 * - One diamond per at-bat per inning
 * - Pitch sequences, hit notation, base advancement
 * - Totals columns on the right
 */

const CELL_WIDTH = 85;
const CELL_HEIGHT = 85;
const NAME_COL_WIDTH = 160;
const POS_COL_WIDTH = 35;
const HEADER_WIDTH = NAME_COL_WIDTH + POS_COL_WIDTH;
const DIAMOND_SIZE = 20;
const TOTALS_COLS = ['AB', 'R', 'H', 'RBI'];
const TOTALS_COL_WIDTH = 35;

const SVG_NS = 'http://www.w3.org/2000/svg';

const ScoresheetRenderer = {
    /**
     * Render a team's scorecard into an SVG element.
     * @param {SVGElement} svgEl - The target SVG element.
     * @param {Object} teamData - TeamScorecard data from the API.
     * @param {number} totalInnings - Total innings to render.
     */
    render(svgEl, teamData, totalInnings = 9) {
        svgEl.innerHTML = '';

        const players = teamData.players || [];
        const numRows = Math.max(players.length, 9);
        const numInnings = Math.max(totalInnings, 9);
        const totalWidth = HEADER_WIDTH + (numInnings * CELL_WIDTH) + (TOTALS_COLS.length * TOTALS_COL_WIDTH) + 2;
        const headerHeight = 28;
        const totalHeight = headerHeight + (numRows * CELL_HEIGHT) + 2;

        svgEl.setAttribute('viewBox', `0 0 ${totalWidth} ${totalHeight}`);
        svgEl.style.width = '100%';
        svgEl.style.height = 'auto';

        // Background
        const bg = this._rect(svgEl, 0, 0, totalWidth, totalHeight, '#fff', '#2c2c2c', 1);

        // Header row
        this._drawHeader(svgEl, numInnings, headerHeight);

        // Player rows
        players.forEach((player, idx) => {
            this._drawPlayerRow(svgEl, player, idx, numInnings, headerHeight);
        });

        // Fill empty rows if less than 9 players
        for (let i = players.length; i < 9; i++) {
            // just grid lines, drawn by _drawGrid
        }

        // Grid lines
        this._drawGrid(svgEl, numRows, numInnings, headerHeight);

        // Inning totals row at bottom
        this._drawInningTotals(svgEl, teamData, numRows, numInnings, headerHeight);
    },

    _drawHeader(svg, numInnings, headerHeight) {
        const g = this._group(svg, 'header');

        // Header background
        this._rect(g, 0, 0, HEADER_WIDTH + (numInnings * CELL_WIDTH) + (TOTALS_COLS.length * TOTALS_COL_WIDTH) + 2, headerHeight, '#2c2c2c');

        // "Player" label
        this._text(g, 8, 19, 'PLAYER', {
            fontSize: '11px', fontWeight: 'bold', fill: '#f5f0e8'
        });

        // "Pos" label
        this._text(g, NAME_COL_WIDTH + 5, 19, 'POS', {
            fontSize: '10px', fontWeight: 'bold', fill: '#f5f0e8'
        });

        // Inning numbers
        for (let i = 1; i <= numInnings; i++) {
            const x = HEADER_WIDTH + ((i - 1) * CELL_WIDTH) + (CELL_WIDTH / 2);
            this._text(g, x, 19, String(i), {
                fontWeight: 'bold', fontSize: '13px', textAnchor: 'middle', fill: '#f5f0e8'
            });
        }

        // Totals headers
        TOTALS_COLS.forEach((label, idx) => {
            const x = HEADER_WIDTH + (numInnings * CELL_WIDTH) + (idx * TOTALS_COL_WIDTH) + (TOTALS_COL_WIDTH / 2);
            this._text(g, x, 19, label, {
                fontWeight: 'bold', fontSize: '10px', textAnchor: 'middle', fill: '#f5f0e8'
            });
        });
    },

    _drawPlayerRow(svg, player, rowIndex, numInnings, headerHeight) {
        const y = headerHeight + (rowIndex * CELL_HEIGHT);
        const g = this._group(svg, `player-${rowIndex}`);

        // Alternating row background
        if (rowIndex % 2 === 1) {
            this._rect(g, 1, y + 1, HEADER_WIDTH - 1, CELL_HEIGHT - 1, '#f9f6f0');
        }

        // Player name
        const name = player.name || '';
        const displayName = name.length > 18 ? name.substring(0, 18) + '.' : name;
        this._text(g, 8, y + 30, displayName, { fontSize: '11px' });

        // Jersey number
        if (player.jersey_number) {
            this._text(g, 8, y + 45, `#${player.jersey_number}`, {
                fontSize: '9px', fill: '#888'
            });
        }

        // Sub indicator
        if (player.batting_order_seq > 0) {
            this._text(g, 8, y + 58, '(sub)', {
                fontSize: '8px', fill: '#999', fontStyle: 'italic'
            });
        }

        // Position
        this._text(g, NAME_COL_WIDTH + 8, y + 35, player.position || '', {
            fontSize: '12px', fontWeight: 'bold'
        });

        // At-bat cells
        const atBats = player.at_bats || {};
        for (let inning = 1; inning <= numInnings; inning++) {
            const cellX = HEADER_WIDTH + ((inning - 1) * CELL_WIDTH);
            const atBat = atBats[String(inning)];
            if (atBat) {
                this._drawAtBatCell(g, cellX, y, atBat);
            }
        }
    },

    _drawAtBatCell(parent, x, y, atBat) {
        const cx = x + CELL_WIDTH / 2;
        const cy = y + CELL_HEIGHT / 2 - 8;

        // Diamond
        const d = DIAMOND_SIZE;
        const diamondPoints = [
            [cx, cy - d],       // top (2nd base)
            [cx + d, cy],       // right (1st base)
            [cx, cy + d],       // bottom (home)
            [cx - d, cy],       // left (3rd base)
        ];

        const diamondPath = `M${diamondPoints[0][0]},${diamondPoints[0][1]} ` +
            `L${diamondPoints[1][0]},${diamondPoints[1][1]} ` +
            `L${diamondPoints[2][0]},${diamondPoints[2][1]} ` +
            `L${diamondPoints[3][0]},${diamondPoints[3][1]} Z`;

        const scored = atBat.bases_reached >= 4;

        const diamond = document.createElementNS(SVG_NS, 'path');
        diamond.setAttribute('d', diamondPath);
        diamond.setAttribute('fill', scored ? '#2c2c2c' : 'none');
        diamond.setAttribute('stroke', '#2c2c2c');
        diamond.setAttribute('stroke-width', '1.2');
        parent.appendChild(diamond);

        // Base paths (bold lines on the diamond edges for bases reached)
        const basesReached = atBat.bases_reached || 0;
        if (basesReached >= 1) {
            this._basePath(parent, diamondPoints[2], diamondPoints[1], scored); // home -> 1st
        }
        if (basesReached >= 2) {
            this._basePath(parent, diamondPoints[1], diamondPoints[0], scored); // 1st -> 2nd
        }
        if (basesReached >= 3) {
            this._basePath(parent, diamondPoints[0], diamondPoints[3], scored); // 2nd -> 3rd
        }
        if (basesReached >= 4) {
            this._basePath(parent, diamondPoints[3], diamondPoints[2], scored); // 3rd -> home
        }

        // Hit type line from home plate toward the field
        if (atBat.hit_type && atBat.result_type === 'hit') {
            this._drawHitLine(parent, cx, cy, d, atBat);
        }

        // Result notation at bottom of cell
        const notation = atBat.result || '';
        this._text(parent, cx, y + CELL_HEIGHT - 5, notation, {
            fontSize: '10px', textAnchor: 'middle', fontWeight: 'bold'
        });

        // Out number (top-right corner, red)
        if (atBat.is_out && atBat.out_number) {
            const circle = document.createElementNS(SVG_NS, 'circle');
            circle.setAttribute('cx', x + CELL_WIDTH - 12);
            circle.setAttribute('cy', y + 12);
            circle.setAttribute('r', '8');
            circle.setAttribute('fill', 'none');
            circle.setAttribute('stroke', '#c00');
            circle.setAttribute('stroke-width', '1.5');
            parent.appendChild(circle);
            this._text(parent, x + CELL_WIDTH - 12, y + 16, String(atBat.out_number), {
                fontSize: '11px', textAnchor: 'middle', fontWeight: 'bold', fill: '#c00'
            });
        }

        // Pitch sequence
        this._drawPitchSequence(parent, x + 5, y + CELL_HEIGHT - 18, atBat.pitches || []);

        // RBI indicators (X marks in bottom-left)
        if (atBat.rbi > 0) {
            for (let r = 0; r < atBat.rbi; r++) {
                this._text(parent, x + 4 + (r * 8), y + 12, '\u00d7', {
                    fontSize: '10px', fontWeight: 'bold', fill: '#006600'
                });
            }
        }

        // Runner advancement annotations along base paths
        this._drawRunnerAnnotations(parent, cx, cy, d, atBat.runner_advancements || []);
    },

    _basePath(parent, from, to, scored) {
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', from[0]);
        line.setAttribute('y1', from[1]);
        line.setAttribute('x2', to[0]);
        line.setAttribute('y2', to[1]);
        line.setAttribute('stroke', scored ? '#f5f0e8' : '#2c2c2c');
        line.setAttribute('stroke-width', '3');
        parent.appendChild(line);
    },

    _drawHitLine(parent, cx, cy, d, atBat) {
        // Draw a line from home plate into the field to indicate hit direction
        const homeX = cx;
        const homeY = cy + d;

        let endX, endY;
        const hitLen = d * 1.3;

        // Default: straight up (center)
        endX = cx;
        endY = cy - d - 5;

        // Use fielder positions to approximate direction
        const fielders = atBat.fielders || [];
        if (fielders.length > 0) {
            const firstFielder = fielders[0];
            // Approximate field positions
            const angles = {
                1: -90,  // pitcher (up middle)
                2: -90,  // catcher (shouldn't happen for hits)
                3: -45,  // 1B (right side)
                4: -60,  // 2B (right-center)
                5: -120, // 3B (left side)
                6: -110, // SS (left-center)
                7: -140, // LF
                8: -90,  // CF
                9: -40,  // RF
            };
            const angle = (angles[firstFielder] || -90) * Math.PI / 180;
            endX = homeX + Math.cos(angle) * hitLen;
            endY = homeY + Math.sin(angle) * hitLen;
        }

        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', homeX);
        line.setAttribute('y1', homeY);
        line.setAttribute('x2', endX);
        line.setAttribute('y2', endY);

        // Solid line = line drive, dashed = ground ball
        if (atBat.hit_type === 'G') {
            line.setAttribute('stroke-dasharray', '3,2');
        }
        line.setAttribute('stroke', '#2c2c2c');
        line.setAttribute('stroke-width', '1.5');
        parent.appendChild(line);
    },

    _drawPitchSequence(parent, startX, startY, pitches) {
        const maxDots = Math.min(pitches.length, 10);
        for (let i = 0; i < maxDots; i++) {
            const pitch = pitches[i];
            const px = startX + (i * 7);
            const circle = document.createElementNS(SVG_NS, 'circle');
            circle.setAttribute('cx', px);
            circle.setAttribute('cy', startY);
            circle.setAttribute('r', '2.5');

            if (pitch.result === 'B') {
                // Ball: open circle
                circle.setAttribute('fill', 'none');
                circle.setAttribute('stroke', '#2c2c2c');
                circle.setAttribute('stroke-width', '1');
            } else if (pitch.result === 'F') {
                // Foul: half-filled
                circle.setAttribute('fill', '#999');
                circle.setAttribute('stroke', '#2c2c2c');
                circle.setAttribute('stroke-width', '0.5');
            } else if (pitch.result === 'C') {
                // Called strike: filled with line through
                circle.setAttribute('fill', '#2c2c2c');
                // Add a small horizontal line through it
                const line = document.createElementNS(SVG_NS, 'line');
                line.setAttribute('x1', px - 4);
                line.setAttribute('y1', startY);
                line.setAttribute('x2', px + 4);
                line.setAttribute('y2', startY);
                line.setAttribute('stroke', '#2c2c2c');
                line.setAttribute('stroke-width', '1');
                parent.appendChild(line);
            } else {
                // Strike swinging or in play: filled circle
                circle.setAttribute('fill', '#2c2c2c');
            }
            parent.appendChild(circle);
        }
    },

    _drawRunnerAnnotations(parent, cx, cy, d, advancements) {
        // Draw small text annotations along base paths for runner movements
        for (const adv of advancements) {
            if (!adv.method) continue;

            // Position the annotation along the relevant base path
            let textX, textY;
            const from = adv.from_base;
            const to = adv.to_base || (adv.is_out ? from : 0);

            // Midpoint of the base path segment
            const baseCoords = {
                0: [cx, cy + d],       // home
                1: [cx + d, cy],       // 1st
                2: [cx, cy - d],       // 2nd
                3: [cx - d, cy],       // 3rd
                4: [cx, cy + d],       // score (home)
            };

            const fromPt = baseCoords[from] || baseCoords[0];
            const actualTo = adv.is_out ? from + 1 : to;
            const toPt = baseCoords[actualTo] || baseCoords[to] || fromPt;

            textX = (fromPt[0] + toPt[0]) / 2;
            textY = (fromPt[1] + toPt[1]) / 2;

            // Offset text slightly away from the diamond
            const offsetX = textX > cx ? 8 : textX < cx ? -8 : 0;
            const offsetY = textY > cy ? 6 : textY < cy ? -4 : 0;

            // Abbreviated method
            let label = adv.method;
            if (label.startsWith('BA')) label = ''; // Don't clutter with batter-advanced

            if (label) {
                this._text(parent, textX + offsetX, textY + offsetY, label, {
                    fontSize: '7px', textAnchor: 'middle', fill: '#666'
                });
            }
        }
    },

    _drawGrid(svg, numRows, numInnings, headerHeight) {
        const g = this._group(svg, 'grid');
        const totalWidth = HEADER_WIDTH + (numInnings * CELL_WIDTH) + (TOTALS_COLS.length * TOTALS_COL_WIDTH);
        const totalHeight = headerHeight + (numRows * CELL_HEIGHT);

        // Horizontal lines
        for (let i = 0; i <= numRows; i++) {
            const y = headerHeight + (i * CELL_HEIGHT);
            this._line(g, 0, y, totalWidth, y);
        }

        // Vertical: left edge
        this._line(g, 0, 0, 0, totalHeight);

        // Name/pos separator
        this._line(g, NAME_COL_WIDTH, 0, NAME_COL_WIDTH, totalHeight, '#ccc');

        // Header/inning separator
        this._line(g, HEADER_WIDTH, 0, HEADER_WIDTH, totalHeight);

        // Inning separators
        for (let i = 1; i <= numInnings; i++) {
            const x = HEADER_WIDTH + (i * CELL_WIDTH);
            this._line(g, x, 0, x, totalHeight);
        }

        // Totals separators
        for (let i = 0; i <= TOTALS_COLS.length; i++) {
            const x = HEADER_WIDTH + (numInnings * CELL_WIDTH) + (i * TOTALS_COL_WIDTH);
            this._line(g, x, 0, x, totalHeight);
        }
    },

    _drawInningTotals(svg, teamData, numRows, numInnings, headerHeight) {
        // Draw R/H/E row below the last player row
        const y = headerHeight + (numRows * CELL_HEIGHT);
        const g = this._group(svg, 'inning-totals');

        // Background
        this._rect(g, 0, y, HEADER_WIDTH + (numInnings * CELL_WIDTH) + (TOTALS_COLS.length * TOTALS_COL_WIDTH), 22, '#eee');

        this._text(g, 8, y + 16, 'RUNS', { fontSize: '10px', fontWeight: 'bold' });

        const inningTotals = teamData.inning_totals || [];
        for (const it of inningTotals) {
            if (it.inning <= numInnings) {
                const cx = HEADER_WIDTH + ((it.inning - 1) * CELL_WIDTH) + (CELL_WIDTH / 2);
                this._text(g, cx, y + 16, String(it.runs), {
                    fontSize: '12px', textAnchor: 'middle', fontWeight: 'bold'
                });
            }
        }

        // Totals
        const totalsX = HEADER_WIDTH + (numInnings * CELL_WIDTH);
        // R
        this._text(g, totalsX + TOTALS_COL_WIDTH / 2, y + 16,
            String(teamData.total_runs || 0), {
                fontSize: '12px', textAnchor: 'middle', fontWeight: 'bold'
            });
        // H
        this._text(g, totalsX + TOTALS_COL_WIDTH * 1.5, y + 16,
            String(teamData.total_hits || 0), {
                fontSize: '12px', textAnchor: 'middle', fontWeight: 'bold'
            });
    },

    // SVG helpers

    _group(parent, id) {
        const g = document.createElementNS(SVG_NS, 'g');
        if (id) g.setAttribute('id', id);
        parent.appendChild(g);
        return g;
    },

    _text(parent, x, y, text, opts = {}) {
        const el = document.createElementNS(SVG_NS, 'text');
        el.setAttribute('x', x);
        el.setAttribute('y', y);
        el.textContent = text;
        el.style.fontFamily = "'Courier New', monospace";
        if (opts.fontSize) el.style.fontSize = opts.fontSize;
        if (opts.fontWeight) el.style.fontWeight = opts.fontWeight;
        if (opts.fontStyle) el.style.fontStyle = opts.fontStyle;
        if (opts.fill) el.style.fill = opts.fill;
        if (opts.textAnchor) el.setAttribute('text-anchor', opts.textAnchor);
        parent.appendChild(el);
        return el;
    },

    _line(parent, x1, y1, x2, y2, color = '#2c2c2c', width = 1) {
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', width);
        parent.appendChild(line);
        return line;
    },

    _rect(parent, x, y, w, h, fill = 'none', stroke = 'none', strokeWidth = 0) {
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', w);
        rect.setAttribute('height', h);
        rect.setAttribute('fill', fill);
        if (stroke !== 'none') {
            rect.setAttribute('stroke', stroke);
            rect.setAttribute('stroke-width', strokeWidth);
        }
        parent.appendChild(rect);
        return rect;
    },
};
