# Convener App — Nairobi District Golf League Team Manager

## Problem Statement

A team convener for the Nairobi District Golf League needs a tool to track foursomes match play performance, manage player pairings, and use data-driven insights to optimize future team selections. With 15+ foursomes per fixture (~30+ squad players), manually tracking partner compatibility, handicap matchups, and venue performance is impractical.

## Proposed Approach

**Next.js 14 web app** with **SQLite** (via Drizzle ORM) for local-first persistence. The app is designed for a single club's convener — it tracks your squad, records match results, and surfaces analytics to help choose better pairings.

---

## Data Model

### Core Entities

1. **Player** — Squad members from your club
   - id, name, email (optional), phone (optional), default_handicap, active (boolean), created_at

2. **OpponentClub** — Other clubs in the league
   - id, name

3. **Course** — Venues where fixtures are played
   - id, name, par, slope_rating (optional), course_rating (optional)

4. **Fixture** — A match day event against another club
   - id, date, opponent_club_id, course_id, home_away, notes, created_at

5. **Match** — A single foursome within a fixture
   - id, fixture_id
   - player1_id, player2_id (your pair)
   - player1_handicap, player2_handicap (handicap on the day)
   - opponent1_name, opponent2_name
   - opponent1_handicap, opponent2_handicap
   - result: 'win' | 'loss' | 'halved'
   - margin (text, e.g., "3&2", "1up", "halved")
   - match_order (position in the draw)
   - notes

### Derived/Computed

- **Pairing** = unique unordered pair of player IDs (computed from Match records)
- **Player handicap history** = derived from match records over time

---

## Feature Breakdown

### Phase 1 — Core Data Entry & Management

1. **Player Management**
   - Add/edit/deactivate squad players
   - Set default handicap (updatable)
   - Player list with search

2. **Club & Course Management**
   - Add opponent clubs
   - Add courses with optional ratings

3. **Fixture Management**
   - Create fixture (date, opponent club, course, home/away)
   - List fixtures with filters (by date, opponent, course)

4. **Match Recording**
   - Enter foursomes within a fixture
   - Select 2 players from squad, enter handicaps on the day
   - Enter opponent names + handicaps
   - Record result (win/loss/halved) and margin (e.g., "3&2")
   - Edit/delete matches

### Phase 2 — Dashboard & Basic Analytics

5. **Dashboard**
   - Overall team record (W-L-H) across all fixtures
   - Recent fixture results
   - Quick stats: most played players, best win rate, current form

6. **Player Performance**
   - Individual player stats: matches played, W-L-H, win %
   - Handicap trend over time
   - Performance by venue, by opponent club

### Phase 3 — Pairing Analytics & Optimization

7. **Partner Compatibility**
   - Matrix/table showing every pairing combination that has played
   - Win rate, matches played, average combined handicap for each pairing
   - Sort/filter by win rate, matches played
   - Highlight "proven" pairings (high win rate + enough matches)

8. **Handicap Matchup Analysis**
   - Performance of pairings vs opponent handicap ranges
   - Identify where your pairings are strongest/weakest
   - Combined team handicap differential vs result correlation

9. **Venue Performance**
   - Team record by course
   - Player/pairing performance by course

10. **Pairing Suggestion Engine**
    - Given available players and their current handicaps, suggest optimal pairings
    - Factors: historical win rate together, handicap compatibility, venue history, recent form
    - Rank pairing options with a composite score
    - Show reasoning (e.g., "These two are 5-1 together, strong at this course")

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | SQLite (via better-sqlite3) |
| ORM | Drizzle ORM |
| UI | Tailwind CSS + shadcn/ui |
| Charts | Recharts |
| State | React Server Components + Server Actions |

---

## Project Structure

```
convener-app/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # Dashboard
│   │   ├── players/
│   │   │   ├── page.tsx              # Player list
│   │   │   └── [id]/page.tsx         # Player detail + stats
│   │   ├── fixtures/
│   │   │   ├── page.tsx              # Fixture list
│   │   │   ├── new/page.tsx          # Create fixture
│   │   │   └── [id]/page.tsx         # Fixture detail + matches
│   │   ├── analytics/
│   │   │   ├── page.tsx              # Analytics overview
│   │   │   ├── pairings/page.tsx     # Partner compatibility
│   │   │   ├── handicaps/page.tsx    # Handicap matchup analysis
│   │   │   ├── venues/page.tsx       # Venue performance
│   │   │   └── suggest/page.tsx      # Pairing suggestions
│   │   ├── clubs/page.tsx            # Opponent club management
│   │   └── courses/page.tsx          # Course management
│   ├── db/
│   │   ├── schema.ts                 # Drizzle schema
│   │   ├── index.ts                  # DB connection
│   │   └── migrations/               # SQL migrations
│   ├── lib/
│   │   ├── analytics.ts              # Analytics computation functions
│   │   ├── pairing-engine.ts         # Pairing suggestion algorithm
│   │   └── utils.ts                  # Shared utilities
│   └── components/
│       ├── ui/                       # shadcn/ui components
│       ├── match-form.tsx
│       ├── player-card.tsx
│       ├── pairing-matrix.tsx
│       ├── stats-card.tsx
│       └── fixture-card.tsx
├── drizzle.config.ts
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## Pairing Suggestion Algorithm (Phase 3)

The engine scores potential pairings based on weighted factors:

1. **Historical Win Rate** (weight: 40%) — How often this pair wins together
2. **Sample Size Confidence** (weight: 10%) — More matches = more reliable data
3. **Handicap Compatibility** (weight: 20%) — Balanced pairings (not two very high or two very low)
4. **Venue Affinity** (weight: 15%) — Performance at the specific course
5. **Recent Form** (weight: 15%) — Last 3-5 matches weighted more than older ones

For new/untested pairings, use a "exploration bonus" to encourage trying promising combinations.

---

## Implementation Order

Todos are numbered and grouped by phase. Dependencies are noted.

### Phase 1: Foundation
- `project-setup` — Initialize Next.js, install deps, configure Tailwind + shadcn
- `db-schema` — Create Drizzle schema + initial migration (depends on: project-setup)
- `player-crud` — Player management pages (depends on: db-schema)
- `club-course-crud` — Club & course management pages (depends on: db-schema)
- `fixture-crud` — Fixture management pages (depends on: db-schema, club-course-crud)
- `match-recording` — Match entry within fixtures (depends on: fixture-crud, player-crud)

### Phase 2: Dashboard & Stats
- `dashboard` — Main dashboard with overall stats (depends on: match-recording)
- `player-stats` — Individual player performance page (depends on: match-recording)

### Phase 3: Analytics
- `pairing-analytics` — Partner compatibility matrix (depends on: match-recording)
- `handicap-analysis` — Handicap matchup analysis (depends on: match-recording)
- `venue-analytics` — Venue performance page (depends on: match-recording)
- `pairing-engine` — Pairing suggestion engine + UI (depends on: pairing-analytics, handicap-analysis, venue-analytics)

---

## Implementation Status — COMPLETE ✅

All 12 tasks implemented and build passing. 32 squad players seeded.

### Running the App
```bash
npm run dev          # Start development server at http://localhost:3000
npm run build        # Production build
npm run db:seed      # Seed player data
npm run db:studio    # Open Drizzle Studio for DB inspection
```

### Routes
| Route | Description |
|-------|-------------|
| `/` | Dashboard — team record, recent fixtures, charts |
| `/players` | Squad management (32 players) |
| `/players/[id]` | Player detail — stats, partners, venues, form, match history |
| `/clubs` | Opponent clubs CRUD |
| `/courses` | Courses CRUD (par, slope, rating) |
| `/fixtures` | Fixture list |
| `/fixtures/new` | Create new fixture |
| `/fixtures/[id]` | Fixture detail + match recording |
| `/analytics` | Analytics hub |
| `/analytics/pairings` | Partner compatibility matrix |
| `/analytics/handicaps` | Handicap matchup analysis |
| `/analytics/venues` | Venue performance |
| `/analytics/suggest` | AI pairing suggestion engine |

---

## Notes & Decisions

- **Single-user app** — No auth needed. This is a convener's personal tool.
- **Opponents stored as names** within matches (not a full player entity) to keep things simple — we don't need to track opponent career stats.
- **Handicaps per match** — Stored on each match record since they change over time. The player's `default_handicap` is just a convenience for pre-filling forms.
- **SQLite** — Perfect for single-user, local-first. Can migrate to Postgres later if needed.
- **Mobile-friendly** — Tailwind ensures responsive design. The convener may enter results on-course from a phone.
- **Pairing engine** — Weighted algorithm: Historical Win Rate (40%), Handicap Compatibility (20%), Venue Affinity (15%), Recent Form (15%), Sample Size Confidence (10%).
