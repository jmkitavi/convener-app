# NDC League Rules & Constraints Reference

Key rules from the **Nairobi District Championship (NDC) Terms of Competition 2026** and implementation discussions that affect how the Convener App works.

---

## Match Format

- **Four Ball Better Ball (4BBB) Match Play** — each player plays their own ball, best score of the pair counts per hole
- **NOT foursomes** (alternate shot) — despite some historical references in the app
- Each match is 2 players (our pair) vs 2 opponents (their pair)

## Fixture Structure

- Standard NDC fixture: **15 matches** per match day
- If a club cannot field 15 teams, they forfeit points for missing teams
- Maximum **30 points** per fixture, distributed across matches:
  - `pointsPerMatch = min(30 / totalMatches, 2)` — **capped at 2 per match**
  - Win = full `pointsPerMatch`
  - Halved = half `pointsPerMatch` (each team)
  - Loss = 0
- Internal/friendly matches also use this system (e.g., 10 matches → 2 pts each → 20 max)

## Handicap & Stroke Allowance

- Players play off **90% of their full course handicap**
- Strokes are assigned relative to the **back marker** (lowest handicap in the 4-ball)
- Formula: `strokes = floor(0.9 × (player_handicap - back_marker_handicap))`
- **3 "Red" matches** per fixture:
  - Highlighted by the home team
  - Maximum **4 strokes** allowed
- **Remaining matches** (typically 12):
  - Maximum **8 strokes** allowed
- Important: when the handicap gap exceeds the stroke cap, the player is **under-compensated** (deficit). The app tracks this as "stroke deficit" — strokes needed but not received due to the cap.

### Effective Handicap

The app computes **effective handicap** = `raw_handicap - strokes_received` to measure true competitiveness after stroke allocation. This matters because:

- A player with handicap 22 getting max 8 strokes against a scratch player still plays "effectively" off 14 — a significant disadvantage
- The counter-pairing engine uses effective handicap comparisons (best-vs-best, second-vs-second) rather than raw net strokes

## Home vs Away Scenarios

### Home Match
- **Our club sends the lineup** by Friday 10am
- Away team responds by Saturday 10am
- Use **Pairing Suggestions** tool — selects optimal pairings from available players
- Home team designates which 3 matches are "red" (max 4 strokes)

### Away Match
- **Opponent sends their lineup** by Friday 10am
- We respond by Saturday 10am with our counter-pairings
- Use **Counter-Pairing** tool — input opponent lineup, get optimal counter-assignments
- Engine prioritises red matches first (limited strokes require careful player selection)

## Bonus Points

- **Away team**: +1 bonus point if they score **≥16 points**
- **Home team**: +1 bonus point if they score **≥22 points**
- (Not yet implemented in the app)

## Win Rate Calculation

- `winRate = (wins + halved × 0.5) / totalMatches`
- Halved matches count as 0.5 wins (not 0 or 1)
- Minimum 3 matches for "proven" pair status

## Counter-Pairing Strategy

The counter-pairing engine uses weighted scoring:
- **Competitiveness (40%)** — effective handicap comparison (best-vs-best 60%, second-vs-second 40%)
- **Historical win rate (25%)** — pair's track record together
- **Recent form (20%)** — both players' last 5 matches
- **Venue affinity (15%)** — performance at the specific course

Assignment order: red matches first (limited strokes need best low-handicap players), then strongest opponent pairs by combined handicap.

## Penalty Points

- Late submission of lineup incurs penalty points (per NDC TOCs)
- Specific penalties not yet tracked in the app

---

*Source: NDC Terms of Competition 2026 (scanned PDF), implementation discussions with team convener.*
