"""FastAPI application for the Baseball Scoresheet."""

import asyncio

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

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
                "away_abbr": game["teams"]["away"]["team"].get("abbreviation", ""),
                "home_team": game["teams"]["home"]["team"]["name"],
                "home_abbr": game["teams"]["home"]["team"].get("abbreviation", ""),
                "status": game["status"]["detailedState"],
                "game_time": game.get("gameDate", ""),
            })
    return {"date": date, "games": games}


@app.get("/api/game/{game_pk}/scorecard")
async def get_scorecard(game_pk: int):
    """Get the full scorecard for a game."""
    feed = await mlb_api.get_live_feed(game_pk)
    scorecard = build_scorecard_from_live_feed(feed)
    return scorecard.to_dict()


@app.get("/api/game/{game_pk}/live-feed")
async def get_live_feed(game_pk: int):
    """Get raw live feed data (for debugging)."""
    return await mlb_api.get_live_feed(game_pk)


@app.websocket("/ws/game/{game_pk}")
async def websocket_game(websocket: WebSocket, game_pk: int):
    """WebSocket endpoint for live game updates.

    Sends scorecard data on connect and polls every 30 seconds for live games.
    Client can also send "refresh" to force an update.
    """
    await websocket.accept()
    try:
        feed = await mlb_api.get_live_feed(game_pk)
        scorecard = build_scorecard_from_live_feed(feed)
        await websocket.send_json({"type": "scorecard", "data": scorecard.to_dict()})

        is_live = scorecard.game_status == "In Progress"

        while True:
            if is_live:
                # Poll every 30 seconds for live games
                try:
                    data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                except asyncio.TimeoutError:
                    data = "refresh"
            else:
                data = await websocket.receive_text()

            if data == "refresh":
                feed = await mlb_api.get_live_feed(game_pk)
                scorecard = build_scorecard_from_live_feed(feed)
                await websocket.send_json({"type": "scorecard", "data": scorecard.to_dict()})
                is_live = scorecard.game_status == "In Progress"

    except WebSocketDisconnect:
        pass
