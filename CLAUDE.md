# Baseball Scoresheet

## Project Overview
An old-school baseball scoresheet web application that consumes live play-by-play data from the MLB Stats API and renders it as a traditional hand-scored baseball scorecard using SVG graphics.

## Architecture
- **Backend**: Python / FastAPI
  - Fetches play-by-play from MLB Stats API (statsapi.mlb.com)
  - Translates API events into traditional scorecard notation
  - Serves game data to frontend via REST + WebSocket (live updates)
- **Frontend**: HTML / CSS / JavaScript with SVG rendering
  - Renders traditional scoresheet grid (9 innings x 9+ batters per team)
  - Diamond diagram per at-bat with base paths, hit lines, scoring notation
  - Pitch-by-pitch tracking (balls, strikes, fouls)
  - Auto-updates during live games

## MLB Stats API (no API key required)
- Schedule: `GET https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=YYYY-MM-DD`
- Live feed: `GET https://statsapi.mlb.com/api/v1.1/game/{gamePk}/feed/live`
- Play-by-play: `GET https://statsapi.mlb.com/api/v1/game/{gamePk}/playByPlay`
- Boxscore: `GET https://statsapi.mlb.com/api/v1/game/{gamePk}/boxscore`

## Scoring Notation Reference
See `docs/scoring-reference.md` for the full scoring notation guide (from Shelley Youth Baseball cheat sheet).

### Position Numbers
1-Pitcher, 2-Catcher, 3-First Base, 4-Second Base, 5-Third Base, 6-Shortstop, 7-Left Field, 8-Center Field, 9-Right Field

### Key Abbreviations
- Reached base: 1B, 2B, 3B, HR, BB, HP, E, FC, INT
- Outs: K, backwards-K (looking), F, L, G, FO, PO, CS, DP, TP, U, SAC
- Other: SB, BA, BK, PB, WP

## Development
```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend
cd frontend
# Open index.html or use a local server
python -m http.server 8080
```

## Project Structure
```
baseball-scoresheet/
├── backend/
│   ├── main.py              # FastAPI app entry point
│   ├── mlb_api.py           # MLB Stats API client
│   ├── scorecard.py         # Play-to-notation translator
│   ├── models.py            # Data models
│   └── requirements.txt
├── frontend/
│   ├── index.html           # Main page
│   ├── css/
│   │   └── scoresheet.css
│   └── js/
│       ├── app.js           # App entry point
│       ├── scoresheet.js    # SVG scoresheet renderer
│       └── api.js           # Backend API client
├── docs/
│   └── scoring-reference.md
├── CLAUDE.md
└── README.md
```
