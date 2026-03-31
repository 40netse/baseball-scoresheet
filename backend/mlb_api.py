"""Client for the MLB Stats API."""

import httpx
from typing import Optional

BASE_URL = "https://statsapi.mlb.com/api"


async def get_schedule(date: str, sport_id: int = 1) -> dict:
    """Fetch the MLB schedule for a given date.

    Args:
        date: Date string in YYYY-MM-DD format.
        sport_id: Sport ID (1 = MLB).

    Returns:
        Schedule data from the API.
    """
    url = f"{BASE_URL}/v1/schedule"
    params = {"sportId": sport_id, "date": date}
    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        return response.json()


async def get_live_feed(game_pk: int) -> dict:
    """Fetch the full live game feed (pitch-by-pitch).

    Args:
        game_pk: The unique game identifier.

    Returns:
        Complete live game feed data.
    """
    url = f"{BASE_URL}/v1.1/game/{game_pk}/feed/live"
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.json()


async def get_play_by_play(game_pk: int) -> dict:
    """Fetch play-by-play data for a game.

    Args:
        game_pk: The unique game identifier.

    Returns:
        Play-by-play data.
    """
    url = f"{BASE_URL}/v1/game/{game_pk}/playByPlay"
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.json()


async def get_boxscore(game_pk: int) -> dict:
    """Fetch the boxscore for a game.

    Args:
        game_pk: The unique game identifier.

    Returns:
        Boxscore data.
    """
    url = f"{BASE_URL}/v1/game/{game_pk}/boxscore"
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.json()


async def get_game_diff(game_pk: int, start_time_stamp: Optional[str] = None) -> dict:
    """Fetch game updates since a given timestamp (for live polling).

    Args:
        game_pk: The unique game identifier.
        start_time_stamp: ISO timestamp to get updates since.

    Returns:
        Diff data since the given timestamp.
    """
    url = f"{BASE_URL}/v1.1/game/{game_pk}/feed/live/diffPatch"
    params = {}
    if start_time_stamp:
        params["startTimecode"] = start_time_stamp
    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        return response.json()
