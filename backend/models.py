"""Data models for baseball scorecard notation."""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class HitType(Enum):
    GROUND = "G"
    LINE = "L"
    FLY = "F"
    POPUP = "P"


class ReachedBase(Enum):
    SINGLE = "1B"
    DOUBLE = "2B"
    TRIPLE = "3B"
    HOME_RUN = "HR"
    WALK = "BB"
    HIT_BY_PITCH = "HP"
    ERROR = "E"
    FIELDERS_CHOICE = "FC"
    INTERFERENCE = "INT"


class OutType(Enum):
    STRIKEOUT_SWINGING = "K"
    STRIKEOUT_LOOKING = "KL"
    FLY_OUT = "F"
    LINE_OUT = "L"
    GROUND_OUT = "G"
    FORCE_OUT = "FO"
    PICKED_OFF = "PO"
    CAUGHT_STEALING = "CS"
    DOUBLE_PLAY = "DP"
    TRIPLE_PLAY = "TP"
    UNASSISTED = "U"
    SACRIFICE = "SAC"


class PitchResult(Enum):
    BALL = "B"
    STRIKE_SWINGING = "S"
    STRIKE_LOOKING = "C"
    FOUL = "F"
    IN_PLAY = "X"


@dataclass
class Pitch:
    """A single pitch in an at-bat."""
    result: PitchResult
    pitch_type: Optional[str] = None
    velocity: Optional[float] = None
    sequence_number: int = 0


@dataclass
class BaseAdvancement:
    """How a runner advanced on the bases."""
    from_base: int  # 0=home, 1=first, 2=second, 3=third
    to_base: int
    method: str  # e.g., "SB", "BA5", "WP", "BK"


@dataclass
class AtBat:
    """A single plate appearance."""
    batter_name: str
    batter_number: int
    pitches: list[Pitch] = field(default_factory=list)
    result: Optional[str] = None  # Scoring notation, e.g., "1B", "K", "L-4", "6-4-3 DP"
    reached_base: Optional[ReachedBase] = None
    out_type: Optional[OutType] = None
    out_number: Optional[int] = None  # 1st, 2nd, or 3rd out of inning
    fielders: list[int] = field(default_factory=list)  # Position numbers involved
    rbi: int = 0
    base_advancements: list[BaseAdvancement] = field(default_factory=list)
    is_out: bool = False
    bases_reached: int = 0  # Furthest base reached (0-4, 4=scored)


@dataclass
class InningHalf:
    """One half of an inning (top or bottom)."""
    inning: int
    is_top: bool
    at_bats: list[AtBat] = field(default_factory=list)
    runs: int = 0
    hits: int = 0
    errors: int = 0
    left_on_base: int = 0


@dataclass
class PlayerLine:
    """A player's line in the scorecard (one row)."""
    name: str
    number: int
    position: str
    batting_order: int
    at_bats: dict[int, AtBat] = field(default_factory=dict)  # keyed by inning


@dataclass
class TeamScorecard:
    """Complete scorecard for one team."""
    team_name: str
    team_abbreviation: str
    players: list[PlayerLine] = field(default_factory=list)
    innings: list[InningHalf] = field(default_factory=list)
    totals: dict = field(default_factory=dict)  # R, H, E, LOB, etc.


@dataclass
class GameScorecard:
    """Complete scorecard for a game (both teams)."""
    game_pk: int
    game_date: str
    venue: str
    away_team: TeamScorecard = field(default_factory=lambda: TeamScorecard("", ""))
    home_team: TeamScorecard = field(default_factory=lambda: TeamScorecard("", ""))
    game_status: str = "Preview"
    current_inning: int = 0
    is_top_inning: bool = True
