"""Translates MLB Stats API play-by-play data into traditional scorecard notation."""

from models import (
    AtBat, BaseAdvancement, GameScorecard, InningTotals,
    Pitch, PitcherLine, PlayerLine, PositionChange, TeamScorecard, BASE_MAP,
)

# MLB API position abbreviations to position numbers
POSITION_TO_NUMBER = {
    "P": 1, "C": 2, "1B": 3, "2B": 4, "3B": 5,
    "SS": 6, "LF": 7, "CF": 8, "RF": 9, "DH": 0,
    "PH": 0, "PR": 0,
}


def parse_pitch(pitch_data: dict) -> Pitch:
    """Convert an MLB API pitch event to our Pitch model."""
    call = pitch_data.get("details", {}).get("call", {}).get("code", "")
    pitch_type = pitch_data.get("details", {}).get("type", {}).get("code")
    velocity = pitch_data.get("pitchData", {}).get("startSpeed")

    result_map = {
        "B": "B",           # Ball
        "S": "S",           # Swinging strike
        "W": "S",           # Swinging strike (blocked)
        "C": "C",           # Called strike (looking)
        "F": "F",           # Foul
        "X": "X",           # In play, out(s)
        "D": "X",           # In play, no out
        "E": "X",           # In play, run(s)
    }
    result = result_map.get(call, "B")

    return Pitch(
        result=result,
        pitch_type=pitch_type,
        velocity=velocity,
        sequence_number=pitch_data.get("pitchNumber", 0),
    )


def _get_fielder_chain(credits_list: list) -> list[int]:
    """Extract ordered fielder position numbers from a runner's credits array.

    Credits come as: f_fielded_ball -> f_assist(s) -> f_putout
    We want them in traditional notation order: assist(s) then putout.
    """
    assists = []
    putout = None
    fielded = None

    for credit in credits_list:
        pos_code = credit.get("position", {}).get("code", "0")
        try:
            pos_num = int(pos_code)
        except ValueError:
            continue

        credit_type = credit.get("credit", "")
        if credit_type == "f_putout":
            putout = pos_num
        elif credit_type == "f_assist":
            assists.append(pos_num)
        elif credit_type == "f_fielded_ball":
            fielded = pos_num

    # Build chain: assists then putout
    chain = assists[:]
    if putout is not None and putout not in chain:
        chain.append(putout)

    # If no assists but we have fielded + putout and they're different
    if not assists and fielded and putout and fielded != putout:
        chain = [fielded, putout]

    # Unassisted putout (fly out, etc.)
    if not chain and putout is not None:
        chain = [putout]
    if not chain and fielded is not None:
        chain = [fielded]

    return chain


def _get_hit_trajectory(play_data: dict) -> str:
    """Determine hit trajectory (G/L/F/P) from play events."""
    for event in play_data.get("playEvents", []):
        if event.get("isPitch") and event.get("details", {}).get("isInPlay"):
            hit_data = event.get("hitData", {})
            trajectory = hit_data.get("trajectory", "")
            traj_map = {
                "ground_ball": "G",
                "line_drive": "L",
                "fly_ball": "F",
                "popup": "P",
            }
            return traj_map.get(trajectory, "")
    return ""


def _is_strikeout_looking(play_data: dict) -> bool:
    """Check if a strikeout was called (looking) vs swinging."""
    desc = play_data.get("result", {}).get("description", "")
    if "called out on strikes" in desc.lower():
        return True
    # Also check the final pitch
    for event in reversed(play_data.get("playEvents", [])):
        if event.get("isPitch"):
            call = event.get("details", {}).get("call", {}).get("code", "")
            return call == "C"
    return False


def translate_play_to_notation(play_data: dict) -> tuple[str, str, str, list[int]]:
    """Convert an MLB API play result into traditional scorecard notation.

    Returns:
        (notation, result_type, hit_type, fielders)
        notation: e.g., "1B", "K", "L-4", "6-4-3 DP", "F-8", "HR"
        result_type: "hit", "out", "reach", "sacrifice"
        hit_type: "G", "L", "F", "P" or ""
        fielders: list of position numbers involved
    """
    result = play_data.get("result", {})
    event = result.get("event", "")
    event_type = result.get("eventType", "")
    runners = play_data.get("runners", [])

    hit_type = _get_hit_trajectory(play_data)

    # Find the batter's runner entry to get fielder credits
    batter_runner = None
    for r in runners:
        if r.get("movement", {}).get("originBase") is None:
            batter_runner = r
            break

    fielders = []
    if batter_runner:
        fielders = _get_fielder_chain(batter_runner.get("credits", []))

    fielder_str = "-".join(str(f) for f in fielders)

    # Hits
    if event_type == "single":
        return f"1B", "hit", hit_type, fielders
    if event_type == "double":
        return f"2B", "hit", hit_type, fielders
    if event_type == "triple":
        return f"3B", "hit", hit_type, fielders
    if event_type == "home_run":
        return "HR", "hit", hit_type, fielders

    # Walks / HBP
    if event_type in ("walk", "intent_walk"):
        return "BB", "reach", "", []
    if event_type == "hit_by_pitch":
        return "HP", "reach", "", []

    # Strikeouts
    if event_type in ("strikeout", "strikeout_double_play"):
        k = "Ꝁ" if _is_strikeout_looking(play_data) else "K"
        if "double_play" in event_type:
            k += " DP"
        return k, "out", "", [2]  # putout credited to catcher

    # Sacrifices
    if event_type == "sac_fly":
        notation = f"SF-{fielder_str}" if fielder_str else "SF"
        return notation, "sacrifice", "F", fielders
    if event_type in ("sac_bunt", "sac_bunt_double_play"):
        notation = f"SAC {fielder_str}" if fielder_str else "SAC"
        if "double_play" in event_type:
            notation += " DP"
        return notation, "sacrifice", "G", fielders

    # Field outs (groundout, flyout, lineout, pop out)
    if event_type == "field_out":
        event_name = event.lower()
        if "groundout" in event_name:
            prefix = "G" if not fielder_str else ""
            notation = f"{prefix}{fielder_str}" if fielder_str else "G"
            return notation, "out", "G", fielders
        elif "lineout" in event_name:
            notation = f"L-{fielder_str}" if fielder_str else "L"
            return notation, "out", "L", fielders
        elif "flyout" in event_name or "fly" in event_name:
            notation = f"F-{fielder_str}" if fielder_str else "F"
            return notation, "out", "F", fielders
        elif "pop" in event_name:
            notation = f"P-{fielder_str}" if fielder_str else "P"
            return notation, "out", "P", fielders
        else:
            notation = fielder_str if fielder_str else event
            return notation, "out", hit_type, fielders

    # Double plays
    if event_type in ("grounded_into_double_play", "double_play"):
        # Get the full fielder chain from ALL runner credits
        all_fielders = []
        for r in runners:
            if r.get("movement", {}).get("isOut"):
                chain = _get_fielder_chain(r.get("credits", []))
                for f in chain:
                    if f not in all_fielders:
                        all_fielders.append(f)
        if all_fielders:
            fielder_str = "-".join(str(f) for f in all_fielders)
        notation = f"{fielder_str} DP" if fielder_str else "DP"
        return notation, "out", "G", all_fielders or fielders

    # Triple play
    if event_type == "triple_play":
        return "TP", "out", "", fielders

    # Force out / fielder's choice
    if event_type == "force_out":
        notation = f"FC-{fielder_str}" if fielder_str else "FC"
        return notation, "reach", hit_type, fielders
    if event_type == "fielders_choice":
        notation = f"FC-{fielder_str}" if fielder_str else "FC"
        return notation, "reach", hit_type, fielders
    if event_type == "fielders_choice_out":
        notation = f"FC-{fielder_str}" if fielder_str else "FC"
        return notation, "out", hit_type, fielders

    # Errors
    if event_type == "field_error":
        # Find which fielder committed the error
        error_fielder = ""
        for r in runners:
            for c in r.get("credits", []):
                if c.get("credit") == "f_fielding_error":
                    pos = c.get("position", {}).get("code", "")
                    error_fielder = pos
                    break
        notation = f"E-{error_fielder}" if error_fielder else "E"
        return notation, "reach", hit_type, fielders

    # Caught stealing
    if "caught_stealing" in event_type:
        cs_fielders = []
        for r in runners:
            if r.get("movement", {}).get("isOut"):
                cs_fielders = _get_fielder_chain(r.get("credits", []))
                break
        cs_str = "-".join(str(f) for f in cs_fielders)
        notation = f"CS {cs_str}" if cs_str else "CS"
        return notation, "out", "", cs_fielders

    # Pickoff
    if "pickoff" in event_type:
        return "PO", "out", "", fielders

    # Interference
    if event_type == "catcher_interf":
        return "INT", "reach", "", []

    # Fallback
    return event or "?", "out" if result.get("isOut") else "reach", hit_type, fielders


def _parse_runner_advancements(play_data: dict, batter_lineup_num: int) -> list[BaseAdvancement]:
    """Parse runner movements from a play (excluding the batter's own movement).

    batter_lineup_num: the batting order # (1-9) of the current batter,
    used for traditional BA notation (e.g., "5" means advanced by #5 hitter).
    """
    advancements = []
    runners = play_data.get("runners", [])

    batter_initial_seen = False
    for r in runners:
        movement = r.get("movement", {})
        origin = movement.get("originBase")

        # For the batter (originBase is None): skip the first entry (initial reach),
        # but process subsequent entries (extra advancement on errors, WP, etc.)
        if origin is None:
            if not batter_initial_seen:
                batter_initial_seen = True
                continue
            # This is an extra advancement by the batter (error, WP, etc.)
            # Use 'start' field which has the actual starting base (e.g., "1B")
            origin = movement.get("start")

        from_base = BASE_MAP.get(origin, 0)
        end = movement.get("end")
        to_base = BASE_MAP.get(end, 0)
        is_out = movement.get("isOut", False)
        out_number = movement.get("outNumber")

        details = r.get("details", {})
        reason = details.get("movementReason", "") or ""
        event_type = details.get("eventType", "") or ""
        runner_name = details.get("runner", {}).get("fullName", "")

        # Determine the method annotation
        # For batter-advanced, use the batter's lineup number (traditional notation)
        batter_num_str = str(batter_lineup_num) if batter_lineup_num else ""
        method = ""
        if "stolen_base" in reason:
            method = f"SB{to_base}"
        elif event_type == "error":
            # Advancement on an error — find the fielder who committed it
            error_pos = ""
            for c in r.get("credits", []):
                if "error" in c.get("credit", ""):
                    error_pos = c.get("position", {}).get("code", "")
                    break
            method = f"E-{error_pos}" if error_pos else "E"
        elif "r_adv_force" in reason:
            method = batter_num_str
        elif "r_adv_play" in reason:
            method = batter_num_str
        elif "caught_stealing" in event_type:
            cs_chain = _get_fielder_chain(r.get("credits", []))
            cs_str = "-".join(str(f) for f in cs_chain)
            method = f"CS {cs_str}" if cs_str else "CS"
        elif is_out and "r_runner_out" in reason:
            # Runner thrown out on a play that isn't a force — e.g. caught
            # advancing on a fly ball (8-5 DP), tagged out trying to stretch
            # a hit. Show the fielding chain from THIS runner's credits.
            ro_chain = _get_fielder_chain(r.get("credits", []))
            ro_str = "-".join(str(f) for f in ro_chain)
            method = ro_str if ro_str else batter_num_str
        elif is_out and "force_out" in reason:
            fo_chain = _get_fielder_chain(r.get("credits", []))
            fo_str = "-".join(str(f) for f in fo_chain)
            if len(fo_chain) == 1:
                method = f"{fo_str}U"  # unassisted putout
            else:
                method = fo_str if fo_str else "FO"
        elif "wild_pitch" in reason:
            method = "WP"
        elif "passed_ball" in reason:
            method = "PB"
        elif "balk" in reason:
            method = "BK"
        elif "pickoff" in event_type:
            method = "PO"
        else:
            method = batter_num_str

        # Get fielder credits for outs
        fielder_credits = ""
        if is_out:
            chain = _get_fielder_chain(r.get("credits", []))
            fielder_credits = "-".join(str(f) for f in chain)

        advancements.append(BaseAdvancement(
            runner_name=runner_name,
            from_base=from_base,
            to_base=to_base if not is_out else 0,
            method=method,
            is_out=is_out,
            out_number=out_number,
            fielder_credits=fielder_credits,
        ))

    return advancements


def build_scorecard_from_live_feed(feed_data: dict) -> GameScorecard:
    """Build a complete GameScorecard from an MLB Stats API live feed response."""
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

    # Build player lines from boxscore, handling substitutions
    boxscore = live_data.get("boxscore", {})
    for side, team_sc in [("away", scorecard.away_team), ("home", scorecard.home_team)]:
        team_box = boxscore.get("teams", {}).get(side, {})
        players_data = team_box.get("players", {})
        batters = team_box.get("batters", [])

        # Group players by batting order slot
        order_slots = {}  # slot_num -> list of (seq, player_data)
        for player_id in batters:
            player_key = f"ID{player_id}"
            player = players_data.get(player_key, {})
            batting_order_str = player.get("battingOrder", "000")
            try:
                bo = int(batting_order_str)
            except (ValueError, TypeError):
                continue
            slot = bo // 100       # 1-9 lineup position
            seq = bo % 100         # 00=starter, 01=first sub, etc.
            if slot == 0:
                continue
            if slot not in order_slots:
                order_slots[slot] = []
            order_slots[slot].append((seq, player_id, player))

        # Sort each slot by sequence and add to players list
        for slot in sorted(order_slots.keys()):
            entries = sorted(order_slots[slot], key=lambda x: x[0])
            for seq, player_id, player in entries:
                person = player.get("person", {})
                position = player.get("position", {}).get("abbreviation", "")
                jersey = player.get("jerseyNumber", "")

                team_sc.players.append(PlayerLine(
                    name=person.get("fullName", "Unknown"),
                    player_id=person.get("id", 0),
                    position=position,
                    jersey_number=jersey,
                    batting_order=slot,
                    batting_order_seq=seq,
                ))

    # Build a player_id -> PlayerLine index up-front so the advancement loop
    # can route ghost-runner-out events to the runner's own row.
    player_lookup = {}
    for side_team in [scorecard.away_team, scorecard.home_team]:
        for pl in side_team.players:
            player_lookup[pl.player_id] = pl

    # Process all plays
    all_plays = plays.get("allPlays", [])
    player_inning_count = {}  # (player_id, inning) -> count

    # Track each player's most recent at-bat so we can mark them as scored later
    # Key: player_id -> most recent AtBat object (the one they're currently on base from)
    player_last_at_bat = {}  # player_id -> AtBat

    # Track which extras half-innings have had their zombie-runner cell created
    seen_extras_halves = set()

    for play in all_plays:
        about = play.get("about", {})
        inning = about.get("inning", 0)
        is_top = about.get("isTopInning", True)
        at_bat_index = about.get("atBatIndex", 0)

        # Extras zombie-runner detection: for each extras half-inning, the
        # first play where the placed runner appears in runners (origin=2B,
        # start=2B) creates a synthetic "placed on 2B" cell on the runner's
        # row. Subsequent advancements/scores/outs attach to this cell via
        # player_last_at_bat.
        if inning >= 10:
            half_key = (inning, is_top)
            if half_key not in seen_extras_halves:
                batter_id_for_zr = play.get("matchup", {}).get("batter", {}).get("id")
                for r in play.get("runners", []):
                    mov = r.get("movement", {})
                    if mov.get("originBase") == "2B" and mov.get("start") == "2B":
                        zr_id = r.get("details", {}).get("runner", {}).get("id")
                        zr_name = r.get("details", {}).get("runner", {}).get("fullName", "")
                        if zr_id and zr_id != batter_id_for_zr and zr_id in player_lookup:
                            runner_line = player_lookup[zr_id]
                            zr_cell = AtBat(
                                batter_name=zr_name,
                                batter_id=zr_id,
                                inning=inning,
                                bases_reached=2,          # started on 2B
                                is_ghost_runner=True,
                            )
                            slot_key = inning
                            offset = 1
                            while slot_key in runner_line.at_bats:
                                slot_key = inning + offset * 100
                                offset += 1
                            runner_line.at_bats[slot_key] = zr_cell
                            player_last_at_bat[zr_id] = zr_cell
                            seen_extras_halves.add(half_key)
                            break

        # Build at-bat
        matchup = play.get("matchup", {})
        batter = matchup.get("batter", {})
        batter_id = batter.get("id", 0)
        pitcher = matchup.get("pitcher", {})

        at_bat = AtBat(
            batter_name=batter.get("fullName", "Unknown"),
            batter_id=batter_id,
            inning=inning,
            pitcher_id=pitcher.get("id", 0),
            pitcher_name=pitcher.get("fullName", ""),
            play_index=at_bat_index,
        )

        # Parse pitches + count those attributed to the starting pitcher.
        # Always collect every pitch event into at_bat.pitches so the total
        # count is correct. If a pitching substitution appears AFTER at least
        # one pitch (mid-PA change), stop incrementing the starting-pitcher
        # counter so remaining pitches don't get credited to the outgoing SP.
        seen_pitch = False
        count_for_starting_pitcher = True
        for event in play.get("playEvents", []):
            if event.get("type") == "action":
                details = event.get("details", {})
                if details.get("eventType") == "pitching_substitution" and seen_pitch:
                    count_for_starting_pitcher = False
            if event.get("isPitch", False):
                at_bat.pitches.append(parse_pitch(event))
                seen_pitch = True
                if count_for_starting_pitcher:
                    at_bat.pitches_by_starting_pitcher += 1

        # Parse result
        notation, result_type, hit_type, fielders = translate_play_to_notation(play)
        at_bat.result = notation
        at_bat.result_type = result_type
        at_bat.hit_type = hit_type
        at_bat.fielders = fielders

        result = play.get("result", {})
        at_bat.rbi = result.get("rbi", 0)
        at_bat.is_out = result.get("isOut", False)
        at_bat.description = result.get("description", "")

        # Determine batter's out number
        # Determine how far the batter reached + extract the batter's own
        # out number from their runner entry. The runner-entry outNumber is
        # correct even on double plays (count.outs is the TOTAL after the
        # play, which would mis-label the batter as out #2 on an 8-5 DP).
        for r in play.get("runners", []):
            if r.get("movement", {}).get("originBase") is None:
                # This is the batter
                end = r.get("movement", {}).get("end")
                at_bat.bases_reached = BASE_MAP.get(end, 0)
                if r.get("movement", {}).get("isOut"):
                    at_bat.bases_reached = 0
                    at_bat.out_number = r.get("movement", {}).get("outNumber")
                break

        # Fallback for out plays where the batter's runner entry wasn't found
        if at_bat.is_out and at_bat.out_number is None:
            count_info = play.get("count", {})
            at_bat.out_number = count_info.get("outs")

        # Track this batter's at-bat if they reached base
        if at_bat.bases_reached > 0:
            player_last_at_bat[batter_id] = at_bat

        # Attach runner advancements to the RUNNER's at-bat cell (not the batter's)
        # so the lineup number and path lines appear on the correct row.
        # Must happen BEFORE we remove scored runners from tracking.
        team_sc = scorecard.away_team if is_top else scorecard.home_team
        batter_lineup_num = 0
        for player_line in team_sc.players:
            if player_line.player_id == batter_id:
                batter_lineup_num = player_line.batting_order
                break

        advancements = _parse_runner_advancements(play, batter_lineup_num)
        for adv in advancements:
            runner_id = None
            for r in play.get("runners", []):
                r_name = r.get("details", {}).get("runner", {}).get("fullName", "")
                r_id = r.get("details", {}).get("runner", {}).get("id")
                if r_name == adv.runner_name and r_id:
                    runner_id = r_id
                    break
            if runner_id and runner_id in player_last_at_bat:
                runner_ab = player_last_at_bat[runner_id]
                runner_ab.runner_advancements.append(adv)
                # Update bases_reached so bold lines are drawn on the runner's cell
                if not adv.is_out and adv.to_base > runner_ab.bases_reached:
                    runner_ab.bases_reached = adv.to_base
            elif (adv.is_out and runner_id and runner_id in player_lookup
                  and runner_id != batter_id):
                # Ghost-runner-out (e.g. extra-innings baserunner put out on a
                # fly-ball DP). The runner has no tracked plate appearance to
                # attach to, but their out belongs on THEIR row at this inning
                # — not the batter's cell. Create a synthetic out-only cell.
                runner_line = player_lookup[runner_id]
                synthetic = AtBat(
                    batter_name=adv.runner_name,
                    batter_id=runner_id,
                    inning=inning,
                    is_out=True,
                    out_number=adv.out_number,
                    bases_reached=0,
                    runner_advancements=[adv],
                    is_out_only=True,
                )
                slot_key = inning
                offset = 1
                while slot_key in runner_line.at_bats:
                    slot_key = inning + offset * 100
                    offset += 1
                runner_line.at_bats[slot_key] = synthetic
            else:
                at_bat.runner_advancements.append(adv)

        # Check ALL runners in this play for scoring — update their at-bat cells
        # Must happen AFTER advancements so runners are still in the tracking dict.
        for r in play.get("runners", []):
            movement = r.get("movement", {})
            if movement.get("end") == "score" and not movement.get("isOut", False):
                runner_id = r.get("details", {}).get("runner", {}).get("id")
                if runner_id and runner_id in player_last_at_bat:
                    player_last_at_bat[runner_id].bases_reached = 4
                    del player_last_at_bat[runner_id]
                elif runner_id == batter_id:
                    at_bat.bases_reached = 4

        # Skip assigning at-bat for plays where the batter isn't involved
        # (caught stealing, pickoff — the out belongs on the runner's cell)
        event_type = play.get("result", {}).get("eventType", "")
        is_runner_only_play = event_type in (
            "caught_stealing_2b", "caught_stealing_3b", "caught_stealing_home",
            "pickoff_1b", "pickoff_2b", "pickoff_3b",
            "pickoff_caught_stealing_2b", "pickoff_caught_stealing_3b",
            "pickoff_caught_stealing_home",
        )
        if is_runner_only_play:
            continue

        # Assign to the correct player line
        for player_line in team_sc.players:
            if player_line.player_id == batter_id:
                # Handle multiple at-bats in same inning (use inning * 100 + count)
                key = (batter_id, inning)
                count = player_inning_count.get(key, 0)
                player_inning_count[key] = count + 1

                if count == 0:
                    player_line.at_bats[inning] = at_bat
                else:
                    # Multiple at-bats in same inning (rare, big innings)
                    player_line.at_bats[inning + count * 100] = at_bat
                break

    # Parse defensive switches and set starting positions.
    # (player_lookup was built earlier for the advancement loop.)
    for play in all_plays:
        about = play.get("about", {})
        inning = about.get("inning", 0)
        is_top = about.get("isTopInning", True)

        for event in play.get("playEvents", []):
            if event.get("type") != "action":
                continue
            details = event.get("details", {})
            event_type = details.get("eventType", "")
            desc = details.get("description", "")

            if event_type == "defensive_switch":
                player_data = event.get("player", {})
                pid = player_data.get("id") if player_data else None

                import re
                m = re.search(r'from\s+(.+?)\s+to\s+(.+?)\s+for\s+', desc, re.IGNORECASE)
                if m and pid and pid in player_lookup:
                    from_pos_full = m.group(1).strip().rstrip('.')
                    to_pos_full = m.group(2).strip().rstrip('.')
                    pos_abbrev = {
                        'pitcher': 'P', 'catcher': 'C', 'first base': '1B',
                        'second base': '2B', 'third base': '3B', 'shortstop': 'SS',
                        'left field': 'LF', 'center field': 'CF', 'right field': 'RF',
                        'designated hitter': 'DH',
                    }
                    from_pos = pos_abbrev.get(from_pos_full.lower(), from_pos_full)
                    to_pos = pos_abbrev.get(to_pos_full.lower(), to_pos_full)

                    pl = player_lookup[pid]
                    if not pl.position_changes:
                        pl.position = from_pos
                    pl.position_changes.append(PositionChange(
                        from_pos=from_pos,
                        to_pos=to_pos,
                        inning=inning,
                        is_top=is_top,
                    ))

    # Calculate inning totals from linescore
    linescore = live_data.get("linescore", {})
    innings_data = linescore.get("innings", [])
    total_innings = len(innings_data)
    scorecard.total_innings = max(total_innings, 9)

    for inning_data in innings_data:
        inning_num = inning_data.get("num", 0)
        for side, team_sc in [("away", scorecard.away_team), ("home", scorecard.home_team)]:
            side_data = inning_data.get(side, {})
            team_sc.inning_totals.append(InningTotals(
                inning=inning_num,
                runs=side_data.get("runs", 0),
                hits=side_data.get("hits", 0),
                errors=side_data.get("errors", 0),
                left_on_base=side_data.get("leftOnBase", 0),
            ))

    # Game totals
    for side, team_sc in [("away", scorecard.away_team), ("home", scorecard.home_team)]:
        totals = linescore.get("teams", {}).get(side, {})
        team_sc.total_runs = totals.get("runs", 0)
        team_sc.total_hits = totals.get("hits", 0)
        team_sc.total_errors = totals.get("errors", 0)

    # Current game state
    scorecard.current_inning = linescore.get("currentInning", 0)
    scorecard.is_top_inning = linescore.get("isTopInning", True)

    # Pitching summary box
    decisions = live_data.get("decisions", {})
    decision_map = {}
    for decision_type, label in [("winner", "W"), ("loser", "L"), ("save", "S")]:
        d = decisions.get(decision_type, {})
        if d:
            decision_map[d.get("id")] = label

    for side, team_sc in [("away", scorecard.away_team), ("home", scorecard.home_team)]:
        team_box = boxscore.get("teams", {}).get(side, {})
        pitcher_ids = team_box.get("pitchers", [])
        players_data = team_box.get("players", {})

        for pid in pitcher_ids:
            p = players_data.get(f"ID{pid}", {})
            person = p.get("person", {})
            stats = p.get("stats", {}).get("pitching", {})
            player_id = person.get("id", 0)

            team_sc.pitchers.append(PitcherLine(
                name=person.get("fullName", "Unknown"),
                player_id=player_id,
                jersey_number=p.get("jerseyNumber", ""),
                ip=stats.get("inningsPitched", "0"),
                hits=stats.get("hits", 0),
                runs=stats.get("runs", 0),
                earned_runs=stats.get("earnedRuns", 0),
                walks=stats.get("baseOnBalls", 0),
                strikeouts=stats.get("strikeOuts", 0),
                home_runs=stats.get("homeRuns", 0),
                pitches=stats.get("numberOfPitches", 0),
                strikes=stats.get("strikes", 0),
                decision=decision_map.get(player_id, ""),
            ))

    return scorecard
