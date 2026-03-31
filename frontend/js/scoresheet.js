/**
 * SVG-based baseball scoresheet renderer.
 *
 * Renders a traditional baseball scorecard with:
 * - Player names and positions in the left columns
 * - One diamond per at-bat per inning
 * - Pitch sequences, hit notation, base advancement
 * - Totals columns on the right
 */

const CELL_WIDTH = 80;
const CELL_HEIGHT = 80;
const HEADER_WIDTH = 180;  // Player name + position column
const DIAMOND_SIZE = 22;   // Half-width of the diamond
const INNINGS = 9;

const ScoresheetRenderer = {
    /**
     * Render a team's scorecard into an SVG element.
     * @param {SVGElement} svgEl - The target SVG element.
     * @param {Object} teamData - TeamScorecard data from the API.
     */
    render(svgEl, teamData) {
        // Clear existing content
        svgEl.innerHTML = '';

        const players = teamData.players || [];
        const numRows = Math.max(players.length, 9);
        const totalWidth = HEADER_WIDTH + (INNINGS * CELL_WIDTH) + 160; // +160 for totals
        const totalHeight = 30 + (numRows * CELL_HEIGHT);

        svgEl.setAttribute('viewBox', `0 0 ${totalWidth} ${totalHeight}`);
        svgEl.setAttribute('width', totalWidth);
        svgEl.setAttribute('height', totalHeight);

        // Draw header row
        this._drawHeader(svgEl);

        // Draw player rows
        players.forEach((player, idx) => {
            this._drawPlayerRow(svgEl, player, idx);
        });

        // Draw grid lines
        this._drawGrid(svgEl, numRows);
    },

    _drawHeader(svg) {
        const g = this._createGroup(svg, 'header');

        // Player column header
        this._drawText(g, 10, 20, 'Player', { fontWeight: 'bold', fontSize: '12px' });

        // Inning headers
        for (let i = 1; i <= INNINGS; i++) {
            const x = HEADER_WIDTH + ((i - 1) * CELL_WIDTH) + (CELL_WIDTH / 2);
            this._drawText(g, x, 20, String(i), {
                fontWeight: 'bold', fontSize: '14px', textAnchor: 'middle'
            });
        }

        // Totals headers
        const totalsLabels = ['AB', 'R', 'H', 'RBI'];
        totalsLabels.forEach((label, idx) => {
            const x = HEADER_WIDTH + (INNINGS * CELL_WIDTH) + (idx * 40) + 20;
            this._drawText(g, x, 20, label, {
                fontWeight: 'bold', fontSize: '11px', textAnchor: 'middle'
            });
        });
    },

    _drawPlayerRow(svg, player, rowIndex) {
        const y = 30 + (rowIndex * CELL_HEIGHT);
        const g = this._createGroup(svg, `player-${rowIndex}`);

        // Player name and position
        const pos = player.position || '';
        const name = player.name || 'Unknown';
        const displayName = name.length > 15 ? name.substring(0, 15) + '.' : name;
        this._drawText(g, 10, y + 25, `${pos}`, { fontSize: '10px', fontWeight: 'bold' });
        this._drawText(g, 10, y + 42, displayName, { fontSize: '11px' });

        // Draw at-bat cells for each inning
        for (let inning = 1; inning <= INNINGS; inning++) {
            const cellX = HEADER_WIDTH + ((inning - 1) * CELL_WIDTH);
            const atBat = (player.at_bats || {})[inning];
            if (atBat) {
                this._drawAtBatCell(g, cellX, y, atBat);
            }
        }
    },

    /**
     * Draw a single at-bat cell with diamond, pitches, and notation.
     */
    _drawAtBatCell(parent, x, y, atBat) {
        const cx = x + CELL_WIDTH / 2;
        const cy = y + CELL_HEIGHT / 2 - 5;

        // Draw the diamond (bases)
        const diamondPath = `M ${cx} ${cy - DIAMOND_SIZE}
            L ${cx + DIAMOND_SIZE} ${cy}
            L ${cx} ${cy + DIAMOND_SIZE}
            L ${cx - DIAMOND_SIZE} ${cy} Z`;

        const diamond = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        diamond.setAttribute('d', diamondPath);
        diamond.setAttribute('class', atBat.bases_reached >= 4 ? 'diamond scored' : 'diamond');
        parent.appendChild(diamond);

        // Draw base paths for bases reached
        if (atBat.bases_reached >= 1) {
            this._drawBasePath(parent, cx, cy, 0, 1); // Home to 1st
        }
        if (atBat.bases_reached >= 2) {
            this._drawBasePath(parent, cx, cy, 1, 2); // 1st to 2nd
        }
        if (atBat.bases_reached >= 3) {
            this._drawBasePath(parent, cx, cy, 2, 3); // 2nd to 3rd
        }
        if (atBat.bases_reached >= 4) {
            this._drawBasePath(parent, cx, cy, 3, 0); // 3rd to Home
        }

        // Draw result notation
        const notation = atBat.result || '';
        this._drawText(parent, cx, y + CELL_HEIGHT - 8, notation, {
            fontSize: '10px', textAnchor: 'middle', fontWeight: 'bold'
        });

        // Draw out number if applicable
        if (atBat.is_out && atBat.out_number) {
            this._drawText(parent, x + CELL_WIDTH - 12, y + 14, String(atBat.out_number), {
                fontSize: '12px', textAnchor: 'middle', fontWeight: 'bold', fill: '#c00'
            });
        }

        // Draw pitch sequence dots
        this._drawPitchSequence(parent, x + 8, y + CELL_HEIGHT - 20, atBat.pitches || []);

        // Draw RBI indicators
        if (atBat.rbi > 0) {
            for (let r = 0; r < atBat.rbi; r++) {
                this._drawText(parent, x + 5 + (r * 8), y + 14, 'x', {
                    fontSize: '10px', fontWeight: 'bold'
                });
            }
        }
    },

    _drawBasePath(parent, cx, cy, fromBase, toBase) {
        const points = {
            0: { x: cx, y: cy + DIAMOND_SIZE },           // Home
            1: { x: cx + DIAMOND_SIZE, y: cy },            // 1st
            2: { x: cx, y: cy - DIAMOND_SIZE },            // 2nd
            3: { x: cx - DIAMOND_SIZE, y: cy },            // 3rd
        };

        const from = points[fromBase];
        const to = points[toBase];

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', from.x);
        line.setAttribute('y1', from.y);
        line.setAttribute('x2', to.x);
        line.setAttribute('y2', to.y);
        line.setAttribute('class', 'base-path');
        parent.appendChild(line);
    },

    _drawPitchSequence(parent, startX, startY, pitches) {
        pitches.forEach((pitch, idx) => {
            if (idx >= 8) return; // Max 8 pitch dots in the cell
            const px = startX + (idx * 8);
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', px);
            circle.setAttribute('cy', startY);

            let className = 'pitch-dot ';
            if (pitch.result === 'B') className += 'ball';
            else if (pitch.result === 'F') className += 'foul';
            else className += 'strike';

            circle.setAttribute('class', className);
            circle.setAttribute('r', '3');
            parent.appendChild(circle);
        });
    },

    _drawGrid(svg, numRows) {
        const g = this._createGroup(svg, 'grid');

        // Horizontal lines
        for (let i = 0; i <= numRows; i++) {
            const y = 30 + (i * CELL_HEIGHT);
            this._drawLine(g, 0, y, HEADER_WIDTH + (INNINGS * CELL_WIDTH) + 160, y);
        }
        // Top header line
        this._drawLine(g, 0, 0, HEADER_WIDTH + (INNINGS * CELL_WIDTH) + 160, 0);
        this._drawLine(g, 0, 28, HEADER_WIDTH + (INNINGS * CELL_WIDTH) + 160, 28);

        // Vertical lines
        this._drawLine(g, 0, 0, 0, 30 + numRows * CELL_HEIGHT);
        this._drawLine(g, HEADER_WIDTH, 0, HEADER_WIDTH, 30 + numRows * CELL_HEIGHT);

        for (let i = 1; i <= INNINGS; i++) {
            const x = HEADER_WIDTH + (i * CELL_WIDTH);
            this._drawLine(g, x, 0, x, 30 + numRows * CELL_HEIGHT);
        }

        // Totals vertical lines
        for (let i = 0; i <= 4; i++) {
            const x = HEADER_WIDTH + (INNINGS * CELL_WIDTH) + (i * 40);
            this._drawLine(g, x, 0, x, 30 + numRows * CELL_HEIGHT);
        }
    },

    // SVG helper methods

    _createGroup(parent, id) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('id', id);
        parent.appendChild(g);
        return g;
    },

    _drawText(parent, x, y, text, opts = {}) {
        const el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        el.setAttribute('x', x);
        el.setAttribute('y', y);
        el.textContent = text;
        el.style.fontFamily = "'Courier New', monospace";
        if (opts.fontSize) el.style.fontSize = opts.fontSize;
        if (opts.fontWeight) el.style.fontWeight = opts.fontWeight;
        if (opts.textAnchor) el.setAttribute('text-anchor', opts.textAnchor);
        if (opts.fill) el.style.fill = opts.fill;
        parent.appendChild(el);
        return el;
    },

    _drawLine(parent, x1, y1, x2, y2) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.style.stroke = '#2c2c2c';
        line.style.strokeWidth = '1';
        parent.appendChild(line);
        return line;
    }
};
