-- Conditional column reconciliation and nullable-match table rebuilding are
-- performed by migration-helper.ts to support both legacy and current databases.
CREATE TABLE IF NOT EXISTS opponent_lineups (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  name TEXT NOT NULL,
  fixture_id INTEGER REFERENCES fixtures(id),
  club_id INTEGER REFERENCES opponent_clubs(id),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS opponent_lineup_pairs (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  lineup_id INTEGER NOT NULL REFERENCES opponent_lineups(id) ON DELETE CASCADE,
  match_order INTEGER NOT NULL,
  opp1_name TEXT NOT NULL,
  opp1_handicap REAL NOT NULL,
  opp2_name TEXT NOT NULL,
  opp2_handicap REAL NOT NULL,
  is_red_match INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS result_imports (
  id TEXT PRIMARY KEY NOT NULL,
  status TEXT NOT NULL,
  data TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  commit_result TEXT
);
