"""Data models for baseball scorecard notation."""

from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Optional


# Base-string mapping for the API
BASE_MAP = {None: 0, "1B": 1, "2B": 2, "3B": 3, "score": 4}


class PitchResult(str, Enum):
    BALL = "B"
    STRIKE_SWINGING = "S"
    STRIKE_LOOKING = "C"
    FOUL = "F"
    IN_PLAY = "X"


@dataclass
class Pitch:
    """A single pitch in an at-bat."""
    result: str  # PitchResult value: B, S, C, F, X
    pitch_type: Optional[str] = None
    velocity: Optional[float] = None
    sequence_number: int = 0


@dataclass
class BaseAdvancement:
    """How a runner advanced on the bases."""
    runner_name: str = ""
    from_base: int = 0  # 0=home, 1=first, 2=second, 3=third
    to_base: int = 0    # 0-4, 4=scored
    method: str = ""    # e.g., "SB", "BA5", "WP", "BK", "CS 2-6"
    is_out: bool = False
    out_number: Optional[int] = None
    fielder_credits: str = ""  # e.g., "2-6" for caught stealing


@dataclass
class AtBat:
    """A single plate appearance."""
    batter_name: str = ""
    batter_id: int = 0
    inning: int = 0
    pitches: list[Pitch] = field(default_factory=list)
    result: str = ""          # Scoring notation: "1B", "K", "L-4", "6-4-3 DP"
    result_type: str = ""     # "hit", "out", "reach", "sacrifice"
    hit_type: str = ""        # "G", "L", "F", "P" (ground, line, fly, popup)
    fielders: list[int] = field(default_factory=list)
    rbi: int = 0
    out_number: Optional[int] = None
    is_out: bool = False
    bases_reached: int = 0    # Furthest base reached by batter (0-4, 4=scored)
    runner_advancements: list[BaseAdvancement] = field(default_factory=list)
    description: str = ""

    def to_dict(self):
        return asdict(self)


@dataclass
class PlayerLine:
    """A player's line in the scorecard (one row)."""
    name: str = ""
    player_id: int = 0
    position: str = ""
    jersey_number: str = ""
    batting_order: int = 0
    batting_order_seq: int = 0  # 0=starter, 1=first sub, etc.
    at_bats: dict = field(default_factory=dict)  # keyed by inning number (str for JSON)

    def to_dict(self):
        d = {
            "name": self.name,
            "player_id": self.player_id,
            "position": self.position,
            "jersey_number": self.jersey_number,
            "batting_order": self.batting_order,
            "batting_order_seq": self.batting_order_seq,
            "at_bats": {str(k): v.to_dict() for k, v in self.at_bats.items()},
        }
        return d


@dataclass
class InningTotals:
    """Totals for one half-inning."""
    inning: int = 0
    runs: int = 0
    hits: int = 0
    errors: int = 0
    left_on_base: int = 0


@dataclass
class TeamScorecard:
    """Complete scorecard for one team."""
    team_name: str = ""
    team_abbreviation: str = ""
    players: list[PlayerLine] = field(default_factory=list)
    inning_totals: list[InningTotals] = field(default_factory=list)
    total_runs: int = 0
    total_hits: int = 0
    total_errors: int = 0

    def to_dict(self):
        return {
            "team_name": self.team_name,
            "team_abbreviation": self.team_abbreviation,
            "players": [p.to_dict() for p in self.players],
            "inning_totals": [asdict(i) for i in self.inning_totals],
            "total_runs": self.total_runs,
            "total_hits": self.total_hits,
            "total_errors": self.total_errors,
        }


@dataclass
class GameScorecard:
    """Complete scorecard for a game (both teams)."""
    game_pk: int = 0
    game_date: str = ""
    venue: str = ""
    away_team: TeamScorecard = field(default_factory=TeamScorecard)
    home_team: TeamScorecard = field(default_factory=TeamScorecard)
    game_status: str = "Preview"
    current_inning: int = 0
    is_top_inning: bool = True
    total_innings: int = 9

    def to_dict(self):
        return {
            "game_pk": self.game_pk,
            "game_date": self.game_date,
            "venue": self.venue,
            "away_team": self.away_team.to_dict(),
            "home_team": self.home_team.to_dict(),
            "game_status": self.game_status,
            "current_inning": self.current_inning,
            "is_top_inning": self.is_top_inning,
            "total_innings": self.total_innings,
        }
