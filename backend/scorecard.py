"""Translates MLB Stats API play-by-play data into traditional scorecard notation."""

from models import (
    AtBat, BaseAdvancement, GameScorecard, InningHalf, Pitch,
    PitchResult, PlayerLine, TeamScorecard,
)

# MLB API position abbreviations to position numbers
POSITION_TO_NUMBER = {
    "P": 1, "C": 2, "1B": 3, "2B": 4, "3B": 5,
    "SS": 6, "LF": 7, "CF": 8, "RF": 9, "DH": 0,
}

NUMBER_TO_POSITION = {v: k for k, v in POSITION_TO_NUMBER.items()}


def parse_pitch(pitch_data: dict) -> Pitch:
    """Convert an MLB API pitch event to our Pitch model."""
    call = pitch_data.get("details", {}).get("call", {}).get("code", "")
    pitch_type = pitch_data.get("details", {}).get("type", {}).get("code")
    velocity = pitch_data.get("pitchData", {}).get("startSpeed")

    result_map = {
        "B": PitchResult.BALL,
        "S": PitchResult.STRIKE_SWINGING,
        "C": PitchResult.STRIKE_LOOKING,
        "F": PitchResult.FOUL,
        "X": PitchResult.IN_PLAY,
        "D": PitchResult.IN_PLAY,
        "E": PitchResult.IN_PLAY,
    }
    result = result_map.get(call, PitchResult.BALL)

    return Pitch(
        result=result,
        pitch_type=pitch_type,
        velocity=velocity,
    )


def translate_play_to_notation(play_data: dict) -> str:
    """Convert an MLB API play result into traditional scorecard notation.

    Examples: '1B', 'K', 'L-4', '6-4-3 DP', 'F-8', 'HR'
    """
    result = play_data.get("result", {})
    event = result.get("event", "")
    event_type = result.get("eventType", "")
    description = result.get("description", "")

    # Map common events to notation
    event_map = {
        "Single": "1B",
        "Double": "2B",
        "Triple": "3B",
        "Home Run": "HR",
        "Walk": "BB",
        "Intent Walk": "IBB",
        "Hit By Pitch": "HP",
        "Strikeout": "K",
        "Strikeout Double Play": "K",
        "Sac Bunt": "SAC",
        "Sac Fly": "SAC",
        "Sac Fly Double Play": "SAC",
    }

    notation = event_map.get(event, event)

    # For outs, try to extract fielder sequence from the play
    if event_type in ("field_out", "force_out", "fielders_choice",
                      "grounded_into_double_play", "double_play",
                      "triple_play", "field_error"):
        # TODO: Parse fielder credits from the detailed play data
        # to produce notation like "6-4-3 DP", "F-8", "L-4", "G 5-3"
        pass

    return notation


def build_scorecard_from_live_feed(feed_data: dict) -> GameScorecard:
    """Build a complete GameScorecard from an MLB Stats API live feed response.

    This is the main entry point for converting API data to scorecard format.
    """
    game_data = feed_data.get("gameData", {})
    live_data = feed_data.get("liveData", {})
    plays = live_data.get("plays", {})

    # Game metadata
    game_pk = game_data.get("game", {}).get("pk", 0)
    game_date = game_data.get("datetime", {}).get("officialDate", "")
    venue = game_data.get("venue", {}).get("name", "")
    status = game_data.get("status", {}).get("detailedState", "Preview")

    # Team info
    teams = game_data.get("teams", {})
    away_info = teams.get("away", {})
    home_info = teams.get("home", {})

    scorecard = GameScorecard(
        game_pk=game_pk,
        game_date=game_date,
        venue=venue,
        game_status=status,
        away_team=TeamScorecard(
            team_name=away_info.get("name", "Away"),
            team_abbreviation=away_info.get("abbreviation", "AWY"),
        ),
        home_team=TeamScorecard(
            team_name=home_info.get("name", "Home"),
            team_abbreviation=home_info.get("abbreviation", "HME"),
        ),
    )

    # Build player lines from boxscore
    boxscore = live_data.get("boxscore", {})
    for side, team_scorecard in [("away", scorecard.away_team), ("home", scorecard.home_team)]:
        team_box = boxscore.get("teams", {}).get(side, {})
        batting_order = team_box.get("battingOrder", [])
        players_data = team_box.get("players", {})

        for order_idx, player_id in enumerate(batting_order):
            player_key = f"ID{player_id}"
            player = players_data.get(player_key, {})
            person = player.get("person", {})
            position = player.get("position", {}).get("abbreviation", "")

            team_scorecard.players.append(PlayerLine(
                name=person.get("fullName", "Unknown"),
                number=person.get("id", 0),
                position=position,
                batting_order=order_idx + 1,
            ))

    # Process all plays
    all_plays = plays.get("allPlays", [])
    for play in all_plays:
        about = play.get("about", {})
        inning = about.get("inning", 0)
        is_top = about.get("isTopInning", True)

        # Build at-bat from play data
        batter = play.get("matchup", {}).get("batter", {})
        at_bat = AtBat(
            batter_name=batter.get("fullName", "Unknown"),
            batter_number=batter.get("id", 0),
        )

        # Parse pitches
        play_events = play.get("playEvents", [])
        for event in play_events:
            if event.get("isPitch", False):
                at_bat.pitches.append(parse_pitch(event))

        # Parse result
        at_bat.result = translate_play_to_notation(play)

        result = play.get("result", {})
        at_bat.rbi = result.get("rbi", 0)
        at_bat.is_out = result.get("isOut", False)

        # Determine which team and assign to player line
        team_scorecard = scorecard.away_team if is_top else scorecard.home_team
        for player_line in team_scorecard.players:
            if player_line.number == batter.get("id"):
                player_line.at_bats[inning] = at_bat
                break

    # Update current game state
    current_play = plays.get("currentPlay", {})
    if current_play:
        about = current_play.get("about", {})
        scorecard.current_inning = about.get("inning", 0)
        scorecard.is_top_inning = about.get("isTopInning", True)

    return scorecard
