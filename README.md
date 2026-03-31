# Baseball Scoresheet

A web application that renders a traditional, old-school baseball scoresheet populated with live (or historical) play-by-play data from the MLB Stats API.

## What It Does

Pick any MLB game -- live or completed -- and this app will fill out a classic baseball scorecard automatically, using the same notation that scorekeepers have used for over a century:

- Diamond diagrams for each at-bat showing hits, outs, and base advancement
- Pitch-by-pitch tracking (balls, strikes, fouls)
- Traditional scoring notation (6-4-3 DP, L-4, K, etc.)
- Position numbers, RBI tracking, stolen bases, errors
- Running box score and statistics (BA, OBP, SLG, ERA, WHIP)

## Architecture

```
Frontend (HTML/SVG/JS)  <-->  Backend (Python/FastAPI)  <-->  MLB Stats API
```

- **Backend**: Fetches MLB play-by-play data and translates it into traditional scorecard notation
- **Frontend**: Renders an SVG-based scoresheet that looks like the real thing
- **Data Source**: MLB Stats API (free, no API key required)

## Getting Started

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
python -m http.server 8080
# Open http://localhost:8080
```

## Scoring Notation

See [docs/scoring-reference.md](docs/scoring-reference.md) for a complete guide to baseball scoring notation used in this app.
