# Baseball Scoring Reference

Reference guide for traditional baseball scorecard notation, adapted from the Shelley Youth Baseball Scoring Cheat Sheet.

## Position Numbers

| # | Position |
|---|----------|
| 1 | Pitcher |
| 2 | Catcher |
| 3 | First Baseman |
| 4 | Second Baseman |
| 5 | Third Baseman |
| 6 | Shortstop |
| 7 | Left Fielder |
| 8 | Center Fielder |
| 9 | Right Fielder |

## Reached Base

| Code | Meaning |
|------|---------|
| 1B | Single |
| 2B | Double |
| 3B | Triple |
| HR | Home Run |
| BB | Base on Balls (Walk) |
| HP | Hit by Pitch |
| E | Error (e.g., E-3 = error by first baseman) |
| FC | Fielder's Choice |
| INT | Interference |

## Outs

| Code | Meaning |
|------|---------|
| K | Strikeout Swinging |
| Backwards K | Strikeout Looking |
| F | Fly Out (e.g., F-8 = fly out to center field) |
| L | Line Out (e.g., L-4 = line out to second baseman) |
| G | Ground Out (e.g., G 6-3 = grounder fielded by shortstop, thrown to first) |
| FO | Force Out |
| PO | Picked Off |
| CS | Caught Stealing (e.g., CS 2-6 = catcher throws to shortstop) |
| DP | Double Play (e.g., 5-4-3 DP = 3B to 2B to 1B) |
| TP | Triple Play |
| U | Unassisted Put Out |
| SAC | Sacrifice (bunt or fly) |

## Other Notations

| Code | Meaning |
|------|---------|
| SB | Stolen Base (e.g., SB2 = stole second) |
| BA | Advanced by Batter (e.g., BA7 = advanced by 7th batter's hit) |
| BK | Balk |
| PB | Passed Ball |
| WP | Wild Pitch |

## Pitch Tracking

In the scorecard diamond, pitches are tracked in the lower portion of the box:
- **Ball**: Represented by a small open dot or the number in sequence
- **Strike (swinging)**: Represented by a filled dot
- **Strike (looking)**: Represented by a filled dot or different marker
- **Foul ball**: Represented by a slash or specific marker

## Scorecard Diamond

Each at-bat is represented by a diamond (representing the bases):
- **Bottom**: Home plate
- **Right**: First base
- **Top**: Second base
- **Left**: Third base

### Base Path Lines
- **Solid line**: Runner advanced on the base paths
- **Dashed line**: Ground ball hit
- **Solid straight line**: Line drive

### Filling the Diamond
- When a runner scores, the diamond is filled in completely
- Base advancement is shown by drawing lines along the base paths
- The method of advancement is annotated along the base path line

## Statistics

| Stat | Formula |
|------|---------|
| BA (Batting Average) | H / AB |
| OBP (On Base %) | (H + BB + HP) / (AB + BB + HP + SAC) |
| SLG (Slugging %) | [(H-2B-3B-HR) + 2(2B) + 3(3B) + 4(HR)] / AB |
| ERA (Earned Run Average) | 9 * ER / IP |
| WHIP | (BB + H) / IP |
| FA (Fielding Average) | (PO + A) / (PO + A + E) |

## Proving a Scorecard

To verify a scorecard is correct:

```
R + LOB + Opponent PO = AB + BB + SAC + HP + INT
```

## Detailed Rules

### At-Bat
A batter has an at-bat during any plate appearance except when:
- He hits a sacrifice bunt or sacrifice fly
- He walks
- He is hit by a pitch
- He is awarded first base because of interference or obstruction

### Innings Pitched
Count each putout as 1/3 of an inning (e.g., a starter replaced with two outs in the 3rd inning = 2 2/3 IP).

### RBI
Credit the batter with an RBI for every run that scores because of:
- A hit
- Sacrifice bunt or fly
- Infield out or fielder's choice
- A walk or HBP with the bases loaded

### Earned Runs
Runs for which the pitcher is accountable. To determine earned runs, reconstruct the inning without errors. The benefit of the doubt goes to the pitcher.

### Error
Each misplay that prolongs the at-bat, prolongs the life of a runner, or permits a runner to advance. Slow handling (no mechanical misplay) and mental mistakes are NOT errors.
