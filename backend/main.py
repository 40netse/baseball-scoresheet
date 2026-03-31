"""FastAPI application for the Baseball Scoresheet."""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

import mlb_api
from scorecard import build_scorecard_from_live_feed

app = FastAPI(title="Baseball Scoresheet API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/schedule/{date}")
async def get_schedule(date: str):
    """Get MLB games for a given date (YYYY-MM-DD)."""
    data = await mlb_api.get_schedule(date)
    games = []
    for date_entry in data.get("dates", []):
        for game in date_entry.get("games", []):
            games.append({
                "game_pk": game["gamePk"],
                "away_team": game["teams"]["away"]["team"]["name"],
                "home_team": game["teams"]["home"]["team"]["name"],
                "status": game["status"]["detailedState"],
                "game_time": game.get("gameDate", ""),
            })
    return {"date": date, "games": games}


@app.get("/api/game/{game_pk}/scorecard")
async def get_scorecard(game_pk: int):
    """Get the full scorecard for a game."""
    feed = await mlb_api.get_live_feed(game_pk)
    scorecard = build_scorecard_from_live_feed(feed)
    return scorecard


@app.get("/api/game/{game_pk}/live-feed")
async def get_live_feed(game_pk: int):
    """Get raw live feed data (for debugging)."""
    return await mlb_api.get_live_feed(game_pk)


@app.websocket("/ws/game/{game_pk}")
async def websocket_game(websocket: WebSocket, game_pk: int):
    """WebSocket endpoint for live game updates."""
    await websocket.accept()
    try:
        # Send initial scorecard
        feed = await mlb_api.get_live_feed(game_pk)
        scorecard = build_scorecard_from_live_feed(feed)
        await websocket.send_json({"type": "scorecard", "data": scorecard.__dict__})

        # TODO: Poll for updates and push diffs
        while True:
            # Wait for client messages (keep-alive pings, etc.)
            data = await websocket.receive_text()
            if data == "refresh":
                feed = await mlb_api.get_live_feed(game_pk)
                scorecard = build_scorecard_from_live_feed(feed)
                await websocket.send_json({"type": "scorecard", "data": scorecard.__dict__})
    except WebSocketDisconnect:
        pass
