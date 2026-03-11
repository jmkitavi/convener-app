# Convener App — Implementation Tasks

## Phase 1: Foundation

### 1. `project-setup` — Initialize Next.js Project
**Status:** ✅ Done | **Dependencies:** None

Create Next.js 14 app with TypeScript, install Tailwind CSS, shadcn/ui, Drizzle ORM, better-sqlite3, Recharts. Configure tailwind.config.ts and drizzle.config.ts.

---

### 2. `db-schema` — Create Database Schema
**Status:** ✅ Done | **Dependencies:** project-setup

Define Drizzle ORM schema in `src/db/schema.ts` with tables: players, opponent_clubs, courses, fixtures, matches. Set up DB connection in `src/db/index.ts`. Run initial migration.

**Tables:**
- `players` — id, name, email, phone, default_handicap, active, created_at
- `opponent_clubs` — id, name
- `courses` — id, name, par, slope_rating, course_rating
- `fixtures` — id, date, opponent_club_id, course_id, home_away, notes, created_at
- `matches` — id, fixture_id, player1_id, player2_id, player1_handicap, player2_handicap, opponent1_name, opponent2_name, opponent1_handicap, opponent2_handicap, result, margin, match_order, notes

---

### 3. `player-crud` — Player Management Pages
**Status:** ✅ Done | **Dependencies:** db-schema

- Player list page (`src/app/players/page.tsx`) with search and add/edit/deactivate
- Player detail page (`src/app/players/[id]/page.tsx`)
- Default handicap field (used to pre-fill match forms)
- Server actions for CRUD operations

---

### 4. `club-course-crud` — Club & Course Management
**Status:** ✅ Done | **Dependencies:** db-schema

- Opponent club management (`src/app/clubs/page.tsx`) — add/edit/delete clubs
- Course management (`src/app/courses/page.tsx`) — add/edit courses with par, slope rating, course rating
- Server actions for CRUD operations

---

### 5. `fixture-crud` — Fixture Management Pages
**Status:** ✅ Done | **Dependencies:** db-schema, club-course-crud

- Fixture list (`src/app/fixtures/page.tsx`) with filters by date, opponent, course
- New fixture form (`src/app/fixtures/new/page.tsx`) — date, opponent club, course, home/away
- Fixture detail page (`src/app/fixtures/[id]/page.tsx`) — shows fixture info and its matches

---

### 6. `match-recording` — Match Recording Within Fixtures
**Status:** ✅ Done | **Dependencies:** fixture-crud, player-crud

- Match entry form on fixture detail page
- Select 2 squad players from dropdown (with search)
- Handicaps pre-filled from player defaults, editable for the day
- Enter opponent names + handicaps
- Record result (Win / Loss / Halved) and margin (e.g., "3&2", "1up")
- Edit and delete existing matches
- Match order tracking within fixture

---

## Phase 2: Dashboard & Stats

### 7. `dashboard` — Main Dashboard
**Status:** ✅ Done | **Dependencies:** match-recording

Dashboard at `src/app/page.tsx` showing:
- Overall team record (Wins - Losses - Halved)
- Recent fixture results (last 5)
- Quick stats: most played players, best individual win rate, current form streaks
- Recharts visualizations (win rate over time, results breakdown)

---

### 8. `player-stats` — Player Performance Stats
**Status:** ✅ Done | **Dependencies:** match-recording

Individual player page (`src/app/players/[id]/page.tsx`) with:
- Matches played, W-L-H record, win percentage
- Handicap trend over time (line chart)
- Performance breakdown by venue
- Performance breakdown by opponent club
- List of all matches with details

---

## Phase 3: Analytics & Optimization

### 9. `pairing-analytics` — Partner Compatibility Analytics
**Status:** ✅ Done | **Dependencies:** match-recording

Page at `src/app/analytics/pairings/page.tsx`:
- Matrix/table of every pairing combination that has played together
- Metrics per pairing: win rate, matches played, average combined handicap
- Sort and filter by win rate or matches played
- Visual highlighting of "proven" pairings (high win rate + sufficient sample size)

---

### 10. `handicap-analysis` — Handicap Matchup Analysis
**Status:** ✅ Done | **Dependencies:** match-recording

Page at `src/app/analytics/handicaps/page.tsx`:
- Performance of pairings vs opponent handicap ranges (low/mid/high)
- Combined team handicap differential vs result correlation
- Identify where pairings are strongest/weakest by handicap matchup
- Chart: win rate by handicap differential bucket

---

### 11. `venue-analytics` — Venue Performance Analytics
**Status:** ✅ Done | **Dependencies:** match-recording

Page at `src/app/analytics/venues/page.tsx`:
- Team record by course (W-L-H at each venue)
- Player performance breakdown by venue
- Pairing performance breakdown by venue
- Home vs away trend analysis

---

### 12. `pairing-engine` — Pairing Suggestion Engine
**Status:** ✅ Done | **Dependencies:** pairing-analytics, handicap-analysis, venue-analytics

Algorithm in `src/lib/pairing-engine.ts` + UI at `src/app/analytics/suggest/page.tsx`:

**Scoring factors:**
| Factor | Weight | Description |
|--------|--------|-------------|
| Historical Win Rate | 40% | How often this pair wins together |
| Sample Size Confidence | 10% | More matches = more reliable data |
| Handicap Compatibility | 20% | Balanced pairings preferred |
| Venue Affinity | 15% | Performance at the selected course |
| Recent Form | 15% | Last 3-5 matches weighted more |

**UI:**
- Select available players for the fixture
- Optionally select venue for venue-weighted suggestions
- Generate ranked pairing suggestions with composite scores
- Show reasoning for each suggestion (e.g., "5-1 record together, strong at this course")
- "Exploration bonus" for promising but untested combinations

---

## Dependency Graph

```
project-setup
    └── db-schema
            ├── player-crud ──────────────┐
            ├── club-course-crud          │
            │       └── fixture-crud      │
            │               └── match-recording
            │                       ├── dashboard
            │                       ├── player-stats
            │                       ├── pairing-analytics ──┐
            │                       ├── handicap-analysis ──┤
            │                       └── venue-analytics ────┤
            │                                               └── pairing-engine
```
