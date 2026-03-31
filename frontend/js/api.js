/**
 * API client for the Baseball Scoresheet backend.
 */

const API_BASE = 'http://localhost:8001/api';
const WS_BASE = 'ws://localhost:8001/ws';

const ScoresheetAPI = {
    /**
     * Fetch games for a given date.
     * @param {string} date - Date in YYYY-MM-DD format.
     * @returns {Promise<Object>} Schedule data with games array.
     */
    async getSchedule(date) {
        const response = await fetch(`${API_BASE}/schedule/${date}`);
        if (!response.ok) throw new Error(`Failed to fetch schedule: ${response.status}`);
        return response.json();
    },

    /**
     * Fetch the scorecard for a specific game.
     * @param {number} gamePk - The MLB game identifier.
     * @returns {Promise<Object>} Scorecard data.
     */
    async getScorecard(gamePk) {
        const response = await fetch(`${API_BASE}/game/${gamePk}/scorecard`);
        if (!response.ok) throw new Error(`Failed to fetch scorecard: ${response.status}`);
        return response.json();
    },

    /**
     * Open a WebSocket connection for live game updates.
     * @param {number} gamePk - The MLB game identifier.
     * @param {function} onMessage - Callback for incoming messages.
     * @returns {WebSocket} The WebSocket connection.
     */
    connectLive(gamePk, onMessage) {
        const ws = new WebSocket(`${WS_BASE}/game/${gamePk}`);
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            onMessage(data);
        };
        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
        return ws;
    }
};
