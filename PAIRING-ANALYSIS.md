# Counter-Pairing Analysis & Recommendation Engine

> Analysis of match data from the 2026 NDC League season to inform the counter-pairing engine.
> Based on 40 matches across 3 fixtures: Sky Queens (home), Red Team internal (home), Thika Sports Club (away).

---

## 1. Data Summary

| Fixture | Type | Matches | W | L | H | Pend |
|---------|------|---------|---|---|---|------|
| Sky Queens | Home (friendly) | 15 | 9 | 2 | 1 | 3 |
| Red Team Internal | Home (internal) | 10 | 3 | 7 | 0 | 0 |
| Thika Sports Club | Away (NDC League) | 15 | 1 | 12 | 2 | 0 |

**Thika is the critical dataset** — the only competitive NDC League fixture with completed results. We lost 12, halved 2, won 1.

---

## 2. How Thika Paired Their Players (Home Team Lineup)

Thika sent their lineup first (they were home). Their approach:

| # | Player 1 (Hcp) | Player 2 (Hcp) | Combined | Gap | Result vs Us |
|---|----------------|-----------------|----------|-----|--------------|
| 7 | D. Otuke (5.2) | B. Omondi (3.2) | 8.4 | 2.0 | Thika win |
| 5 | D. Matano (3.5) | D. Ndung'u (7.5) | 11.0 | 4.0 | Thika win |
| 9 | L. Mwaniki (8.5) | D. Gakuo (5.6) | 14.1 | 2.9 | Thika win |
| 4 | P. Nduati (6.4) | C. Ngunjiri (12.9) | 19.3 | 6.5 | Thika win |
| 10 | I. Charagu (13.9) | S. Ndung'u (6.0) | 19.9 | 7.9 | Thika win |
| 12 | B. Mugambi (8.0) | B. Kimani (14.0) | 22.0 | 6.0 | Thika win |
| 11 | D. Karuma (9.1) | P. Mukuria (16.0) | 25.1 | 6.9 | Thika half |
| 2 | Sam Njenga (10.7) | J. Gachomba (15.5) | 26.2 | 4.8 | Thika half |
| 13 | M. Gatonye (9.9) | J. Waweru (16.7) | 26.6 | 6.8 | Thika win |
| 3 | J. Wanyaga (11.3) | B. Nyamu (15.6) | 26.9 | 4.3 | Thika win |
| 1 | N. Thuku (11.7) | D. Kaniaru (18.6) | 30.3 | 6.9 | Thika win |
| 6 | S. Mathenge (14.6) | J.K. Njenga (17.6) | 32.2 | 3.0 | Thika win |
| 8 | B. Kiprono (18.7) | J. Mbitu (13.6) | 32.3 | 5.1 | **Thika loss** |
| 14 | M. Ruo (15.1) | C. Njui (18.7) | 33.8 | 3.6 | Thika win |
| 15 | J.M. Ndungu (13.8) | J. Muoria (22.2) | 36.0 | 8.4 | Thika win |

### Thika's Pairing Philosophy

- **Average partner gap: 5.3** (range 2.0–8.4)
- **Anchor model**: 8/15 pairs have at least one sub-10 handicap player as the "anchor"
- **Band grouping**: Pairs stay within a similar handicap band, then use the stronger player to carry
- **Depth**: Thika fielded 8 players under handicap 10 — their roster is simply stronger at the low end

### The One Match Thika Lost

**Kiprono (18.7) & Mbitu (13.6)** vs **Kigen (17.1) & Kitavi (16.1)** → KAFGC Win 2&1

This was Thika's **2nd weakest pair** (combined 32.3) — their only pair without a sub-10 anchor. Our pair was close in combined handicap (+0.9) and all 4 players were in the 13.6–18.7 range (spread = 5.1). After stroke allocation, effective handicaps were nearly identical (14.1/14.1 vs 13.6/14.7).

---

## 3. How We Matched at Thika (Our Counter-Pairing Choices)

| Thika Pair (Combined) | Our Pair (Combined) | Diff | 4-Ball Spread | Result |
|------------------------|---------------------|------|---------------|--------|
| Otuke & Omondi (8.4) | Ocharo & Mutooni (44.5) | +36.1 | 21.9 | Loss 9&7 |
| Matano & Ndung'u (11.0) | Muchanga & Noi (18.5) | +7.5 | 5.8 | Loss |
| Mwaniki & Gakuo (14.1) | Wanyama & Mokua (17.2) | +3.1 | 4.6 | Loss 2 |
| Nduati & Ngunjiri (19.3) | Kizito & Tororei (23.2) | +3.9 | 8.4 | Loss |
| Charagu & Ndung'u (19.9) | Wekesa & Nyoike (24.7) | +4.8 | 9.1 | Loss |
| Mugambi & Kimani (22.0) | Kiptoo & O. Chacha (38.4) | +16.4 | 12.8 | Loss |
| Karuma & Mukuria (25.1) | Ochieng & Huma (36.1) | +11.0 | 12.2 | **Halved** |
| Njenga & Gachomba (26.2) | Arigo & Musesya (32.5) | +6.3 | 8.2 | **Halved** |
| Gatonye & Waweru (26.6) | Muganda & Shariff (34.9) | +8.3 | 12.0 | Loss 3&2 |
| Wanyaga & Nyamu (26.9) | Nyabiba & Foro (35.6) | +8.7 | 9.9 | Loss 1 |
| Thuku & Kaniaru (30.3) | Ngonge & Munguti (48.5) | +18.2 | 14.8 | Loss 5&4 |
| Mathenge & Njenga (32.2) | Omwoyo & Bwire (50.8) | +18.6 | 10.9 | Loss 5&4 |
| **Kiprono & Mbitu (32.3)** | **Kigen & Kitavi (33.2)** | **+0.9** | **5.1** | **Win 2&1** |
| Ruo & Njui (33.8) | Mulwa & Mwangi (45.7) | +11.9 | 10.3 | Loss 7&6 |
| Ndungu & Muoria (36.0) | Kitur & Omollo (44.0) | +8.0 | 12.4 | Loss |

### What Went Wrong

1. **Massive mismatch on strong pairs**: We put Ocharo(19.4) & Mutooni(25.1) against Otuke(5.2) & Omondi(3.2) — a 36-point combined gap. Lost 9&7. Even with max 8 strokes each, a 20+ effective gap is unwinnable.
2. **Wasted strong players on unwinnable matches**: Muchanga(9.3) & Noi(9.2), our best low-handicap pair, went against Matano(3.5) & Ndung'u(7.5). The effective spread was tight (4.2/4.3 vs 3.5/4.5) but Thika's anchors were just too strong.
3. **Weak players on mid-tier opponents**: Ngonge(22.0) & Munguti(26.5) against Thuku(11.7) & Kaniaru(18.6). Even the weaker Thika pairs are much better than our bench depth.

---

## 4. Effective Handicap Analysis (After Stroke Allocation)

NDC rules: strokes = floor(90% × (handicap − back_marker)), capped at 8 (or 4 for red matches).

**Effective handicap** = raw handicap − strokes received. This represents a player's true competitive level after the stroke allowance.

### Thika Match — Effective Handicaps

| Our Pair | Eff. Hcp | Opp Pair | Eff. Hcp | Eff. Spread | Result |
|----------|----------|----------|----------|-------------|--------|
| Kigen & Kitavi | 14.1 / 14.1 | Kiprono & Mbitu | 14.7 / 13.6 | **1.1** | **Win** |
| Arigo & Musesya | 11.6 / 11.9 | Njenga & Gachomba | 10.7 / 11.5 | 1.2 | Halved |
| Wanyama & Mokua | 6.0 / 6.2 | Mwaniki & Gakuo | 6.5 / 5.6 | 0.6 | Loss 2 |
| Muchanga & Noi | 4.2 / 4.3 | Matano & Ndung'u | 3.5 / 4.5 | 1.0 | Loss |
| Kizito & Tororei | 7.4 / 7.8 | Nduati & Ngunjiri | 6.4 / 7.9 | 1.4 | Loss |
| Wekesa & Nyoike | 6.6 / 7.1 | Charagu & Ndung'u | 6.0 / 6.9 | 1.1 | Loss |
| Ochieng & Huma | 9.8 / 13.3 | Karuma & Mukuria | 9.1 / 10.0 | 4.2 | Halved |
| Nyabiba & Foro | 12.4 / 13.2 | Wanyaga & Nyamu | 11.3 / 12.6 | 1.9 | Loss 1 |
| Kiptoo & O. Chacha | 9.6 / 12.8 | Mugambi & Kimani | 8.0 / 9.0 | 4.8 | Loss |
| Muganda & Shariff | 11.0 / 13.9 | Gatonye & Waweru | 9.9 / 10.7 | 4.0 | Loss 3&2 |
| Ngonge & Munguti | 14.0 / 18.5 | Thuku & Kaniaru | 11.7 / 12.6 | 6.8 | Loss 5&4 |
| Omwoyo & Bwire | 17.3 / 17.5 | Mathenge & Njenga | 14.6 / 15.6 | 2.9 | Loss 5&4 |
| Mulwa & Mwangi | 16.3 / 17.4 | Ruo & Njui | 15.1 / 15.7 | 2.3 | Loss 7&6 |
| Kitur & Omollo | 14.8 / 18.2 | Ndungu & Muoria | 13.8 / 15.2 | 4.4 | Loss |
| Ocharo & Mutooni | 11.4 / 17.1 | Otuke & Omondi | 4.2 / 3.2 | 13.9 | Loss 9&7 |

### Key Finding: Effective Spread and Deficits

Interesting twist: some matches with **low** effective spread still lost (Wanyama & Mokua: spread 0.6, loss by 2). This means **effective spread is necessary but not sufficient** — it tells us the match is competitive, but Thika's players were simply more skilled even at equivalent effective levels.

What really matters:
- **Low effective spread** makes the match competitive (gives us a chance)
- **Low combined diff** means we're not outgunned on raw skill
- **No large stroke deficits** ensures the cap isn't handicapping our players

---

## 5. Metrics by Result (All Matches)

| Metric | Wins (n=13) | Losses (n=21) | Halved (n=3) |
|--------|-------------|---------------|--------------|
| Combined hcp diff (us−them) | −4.4 | +9.0 | +2.1 |
| Team partner gap | 5.0 | 4.7 | 4.2 |
| Opponent partner gap | 5.0 | 5.1 | 4.1 |
| 4-ball max spread (raw) | 9.8 | 9.9 | 8.8 |
| Best eff vs Best eff gap | −0.5 | +1.2 | +0.3 |
| Worst eff vs Worst eff gap | −1.8 | +1.7 | +1.1 |

### Thika-Only (NDC League Away)

| Metric | Wins (n=1) | Losses (n=12) | Halved (n=2) |
|--------|------------|---------------|--------------|
| Combined hcp diff | +0.9 | +12.1 | +8.7 |
| Team partner gap | 1.0 | 4.8 | 5.9 |
| 4-ball max spread | 5.1 | 11.1 | 10.2 |
| Best eff vs Best eff gap | +0.5 | +1.8 | +0.8 |
| Worst eff vs Worst eff gap | −0.6 | +2.7 | +1.8 |

**The winning formula at Thika**: Combined diff near zero (+0.9), tight partner gap (1.0), small 4-ball spread (5.1).

---

## 6. User-Cited "Good Matchups" — Validated

The user identified these as quality pairings regardless of result:

| Matchup | Eff. Spread | Combined Diff | Result | Why It Works |
|---------|-------------|---------------|--------|--------------|
| Kigen(17.1) & Kitavi(16.1) vs Kiprono(18.7) & Mbitu(13.6) | 1.1 | +0.9 | Win | All 4 in similar band |
| Ochieng(15.6) & Shariff(22.5) vs Muchiri(16.3) & Omollo(20.9) | 1.3 | +0.9 | Loss | Evenly matched bands |
| Arigo(13.4) & Chacha(14.4) vs Akoth(10.2) & Odima(13.7) | 1.2 | +3.9 | Loss | Tight 4-ball, competitive |
| Kigen(16.8) & Kitavi(16.1) vs Ochiel(21.7) & Ogutu(22.2) | 1.1 | −11.0 | Halved | All within 6.1 raw spread |

Common traits of "good matchups":
1. **Effective spread 1.0–1.3** — all players at similar competitive level after strokes
2. **No stroke deficits** — the 8-stroke cap isn't leaving anyone exposed
3. **Band coherence** — our pair is in a similar handicap band to the opponent pair
4. **Player awareness** — known pairings with chemistry (Kigen & Kitavi, Arigo & Chacha)

---

## 7. How Opponents Structure Lineups

### Comparison of Pairing Strategies

| Team | Avg Partner Gap | Range | Sub-10 Anchors | Philosophy |
|------|-----------------|-------|----------------|------------|
| Thika Sports | 5.3 | 2.0–8.4 | 8/15 pairs | Low anchor + mid partner |
| Royal Nairobi | 6.4 | 1.8–10.3 | 12/16 pairs | Strong anchor + wide partner |
| KAFGC Blue (internal) | 5.5 | 3.3–7.9 | — | Similar-band pairs |
| KAFGC Red (internal) | 6.7 | 1.9–17.3 | — | Mixed approach |

### Royal Nairobi Lineup (Upcoming Match)

Royal's 16 pairs use a pronounced **anchor + partner** model:
- **12/16 pairs** have at least one sub-10 handicap anchor
- Strongest: Sagoo (4.4), Gachuba (5.8), Kamuri (6.0), Mastamet (6.6)
- The anchor carries holes while the higher-handicap partner gets strokes and contributes on good holes
- Average gap 6.4 — wider than Thika, meaning the anchor is doing more carrying

### KAFGC Depth Problem

KAFGC sub-10 players (active roster):

| Player | Handicap |
|--------|----------|
| Harun Wanyama | 7.0 |
| Don Tororei | 8.4 |
| Victor Noi | 9.2 |
| Joel Muchanga | 9.3 |
| Lincolyn Wekesa | 9.6 |

**5 sub-10 players** vs Thika's 8 and Royal's 12+. We cannot match opponent depth at the low end. This makes counter-pairing strategy critical — we must be smart about where we deploy limited strength.

---

## 8. Current Engine Flaws

The existing `scoreStrokeAdvantage()` function in `pairing-engine.ts`:

```
composite = bestVsBest * 0.6 + secondVsSecond * 0.4
normalized = (composite + 10) / 20   // ±10 window
```

**Problems:**

1. **Rewards large handicap differentials**: A 20+ hcp player against a 5 hcp opponent shows "+10 net strokes" but the 8-stroke cap means the player is still outclassed by 7+ effective strokes.

2. **±10 window too wide**: Real competitive matches have effective gaps of 0–2. The 0–10 window treats a 5-stroke effective gap as only "moderately bad" when it's actually devastating.

3. **No deficit penalty**: A player needing 14 strokes but getting only 8 (deficit of 6) is treated the same as a player getting all their strokes. The deficit completely undermines competitiveness.

4. **No band-matching concept**: The engine doesn't consider whether the 4-ball is in a coherent handicap band. It just looks at net advantages.

5. **Greedy allocation doesn't consider concession strategy**: The engine tries to optimize every match equally, rather than conceding unwinnable matches and focusing resources on winnable ones.

---

## 9. Recommended Engine Improvements

### 9.1 Primary Scoring: Competitiveness Score (replaces stroke advantage)

Instead of maximizing stroke advantage, maximize **competitive closeness**:

```
competitiveness = f(effective_spread, max_deficit, band_coherence)
```

Where:
- **Effective spread** = max(all 4 effective hcps) − min(all 4 effective hcps). Target: < 2.0
- **Max deficit** = largest stroke deficit among our players. Target: 0
- **Band coherence** = how well the 4-ball stays within a handicap band

Scoring approach:
- Effective spread 0–1.5: excellent (0.9–1.0)
- Effective spread 1.5–3.0: good (0.6–0.9)
- Effective spread 3.0–5.0: marginal (0.3–0.6)
- Effective spread 5.0+: poor (0.0–0.3)
- **Deficit penalty**: Subtract 0.1 per stroke of deficit on our players
- **Band bonus**: +0.05 if all 4 raw handicaps are within 8 strokes of each other

### 9.2 Strategic Allocation: Concede & Focus

Not every match can be won. The engine should:

1. **Identify unwinnable matches**: Opponent pairs where no available pair can achieve effective spread < 4.0
2. **Concede these early**: Assign weakest remaining players to unwinnable matches
3. **Focus resources**: Deploy best players against matches where we can achieve effective spread < 2.0
4. **Maximize expected points**: Better to win 5 and lose 10 than to lose all 15 narrowly

Implementation:
```
Phase 1: Score all (opponent, our_pair) combinations
Phase 2: Identify opponent pairs where best possible our_pair score < threshold
Phase 3: Assign sacrificial pairs to unwinnable matches
Phase 4: Optimally assign remaining players to winnable matches
```

### 9.3 Updated Weight Distribution

| Factor | Current Weight | Proposed Weight | Rationale |
|--------|---------------|-----------------|-----------|
| Stroke Advantage | 0.40 | **0.00** | Remove — replaced by competitiveness |
| **Competitiveness** | — | **0.40** | Primary metric (effective spread + deficit) |
| Historical Win Rate | 0.25 | **0.25** | Keep — proven pairs matter |
| Recent Form | 0.20 | **0.15** | Slight reduction |
| Venue Affinity | 0.15 | **0.10** | Less important |
| **Band Coherence** | — | **0.05** | All 4 in similar handicap range |
| **Player Strength** | — | **0.05** | Prefer fielding stronger players |

### 9.4 Concession Strategy

When facing significantly stronger teams:
- Accept that some matches are unwinnable
- Allocate weaker players to opponent's strongest pairs (concede)
- Focus competitive players against opponent's mid-range and weak pairs
- **Goal**: Maximize total points, not per-match competitiveness

Example at Thika: Instead of putting Ocharo & Mutooni against Otuke & Omondi (lost 9&7), concede that match with expendable players and use competitive players where the gap is closable.

### 9.5 Player Priority Rules (Strength-First Drafting)

**Core principle**: Stronger players put up a better fight regardless of stroke differentials. The engine must never leave a strong player on the bench while fielding a weaker one.

**Thresholds:**
| Tier | Handicap | Rule |
|------|----------|------|
| Must-play | < 14 | MUST be drafted — never left as reserves |
| Preferred | 14–20 | Standard drafting pool |
| Bench | 21+ | Only drafted when must-play + preferred are exhausted |

**Implementation — built into the pairing loop, not a post-fix:**

1. Before each match assignment, build the candidate pool:
   - Include all remaining must-play + preferred players
   - Only include bench players if fewer than 2 must-play/preferred remain
2. The greedy algorithm evaluates pairs from this filtered pool
3. This naturally ensures bench (21+) players are never considered while stronger players are available
4. A `playerStrength` scoring bonus (weight 0.05) further tips tie-breaking toward lower-handicap pairs

**Safety net**: After all matches are assigned, verify no sub-14 player is on reserves. If found, swap with the highest-handicap drafted player.

**Why this matters**: At Thika, even our losses by narrow margins (1 up, 2 up) featured players in the 13–17 range. These players are competitive in NDC league play. Players above 21 handicap struggle even with maximum stroke allowance against opponent anchors.

**Updated weights (v3):**
| Factor | Weight | Purpose |
|--------|--------|---------|
| Competitiveness | 0.40 | Effective spread + deficit penalty |
| Historical Win Rate | 0.25 | Proven pair performance |
| Recent Form | 0.15 | Individual recent results |
| Venue Affinity | 0.10 | Performance at specific courses |
| Band Coherence | 0.05 | All 4 players in similar range |
| Player Strength | 0.05 | Prefer lower handicap pairs |

---

## 10. Validation: What Would Ideal Thika Counter-Pairing Look Like?

Against Thika's lineup, with our 30 players, the ideal strategy would be:

### Concede (3-4 matches)
- Otuke(5.2) & Omondi(3.2) — combined 8.4, no KAFGC pair can compete
- Matano(3.5) & Ndung'u(7.5) — combined 11.0, too strong
- Mwaniki(8.5) & Gakuo(5.6) — combined 14.1, borderline

### Compete (11-12 matches)
- Deploy Kigen & Kitavi against mid-range pairs (combined 30-36)
- Deploy Arigo & Chacha/Musesya against mid pairs (combined 25-30)
- Match Ochieng, Huma, Nyabiba against their 25-27 combined range
- Focus on getting 4-ball spreads under 5.0

### Expected Improvement
Current: 1W 2H 12L (4 points out of 30)
With better matching: Target 4-5W, 3-4H, 6-8L (~14-16 points)

---

## 11. Royal Nairobi Counter-Pairing Preview

Royal's lineup for 15 Mar 2026 (16 pairs, saved as lineup #1):

**Their strongest 5:**
1. Gachuba(5.8) & Ndungu(8.5) — combined 14.3
2. Mastamet(6.6) & Ouko(11.0) — combined 17.6
3. Kamuri(6.0) & Ogindo(12.5) — combined 18.5
4. Sagoo(4.4) & Kirui(13.9) — combined 18.3
5. Kombe(7.5) & Bachoo(13.6) — combined 21.1

**Their weakest 5:**
1. Maari(12.8) & Masiga(19.4) — combined 32.2
2. Kihoro(10.3) & Odumbe(17.7) — combined 28.0
3. Wambua(12.5) & Mbithi(16.2) — combined 28.7
4. Okuku(9.9) & Kounah(17.1) — combined 27.0
5. Itemere(10.5) & Kiruthu(15.6) — combined 26.1

**Strategy against Royal:**
- Concede the top 3-4 pairs (combined < 18.5, all have sub-7 anchors)
- Focus competitive pairs on matches 6-16 where combined is 23-32
- KAFGC's mid-range strength (Kigen, Kitavi, Arigo, Chacha, Ochieng in the 13-17 range) can compete with Royal's weaker pairs
- Key: ensure our 4-ball effective spread stays under 2.0 on targeted matches

---

## Appendix A: Glossary

| Term | Definition |
|------|-----------|
| **Back marker** | Lowest handicap player in the 4-ball — plays off scratch (0 strokes) |
| **Stroke allowance** | floor(90% × (handicap − back_marker)), capped at 8 (or 4 for red) |
| **Effective handicap** | Raw handicap − strokes received. True competitive level after allowance |
| **Effective spread** | Max − min of all 4 effective handicaps. Lower = more competitive match |
| **Stroke deficit** | Uncapped strokes needed − actual strokes received. Shows cap damage |
| **Combined handicap** | Sum of both players' handicaps in a pair |
| **Partner gap** | Absolute difference between partners' handicaps |
| **4-ball spread** | Max − min of all 4 raw handicaps (before strokes) |
| **Band coherence** | Whether all 4 players in a match are in a similar handicap range |
| **Anchor** | The lower-handicap player in a pair who "carries" more holes |
| **Concession match** | A match identified as unwinnable, assigned weakest available players |

## Appendix B: Data Sources

- **Thika match data**: 15 matches loaded from fixture results (Feb 8, 2026)
- **Sky Queens match data**: 15 matches (Jan 10, 2026) — less relevant (friendly, different format)
- **Red Team internal**: 10 matches (Feb 1, 2026) — useful for KAFGC player-vs-player insight
- **Royal lineup**: Extracted from PDF, 16 pairs saved as opponent lineup #1

## Appendix C: Engine Code Reference

- Scoring engine: `src/lib/pairing-engine.ts`
  - `calculateStrokeAnalysis()` — stroke allocation and effective handicaps
  - `scoreStrokeAdvantage()` — current scoring (to be replaced)
  - `suggestCounterPairings()` — greedy assignment algorithm
- Counter-pairing UI: `src/app/analytics/counter/counter-client.tsx`
- Server actions: `src/lib/actions.ts` (saveLineup, getLineups, etc.)
