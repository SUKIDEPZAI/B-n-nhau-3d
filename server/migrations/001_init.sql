-- Run once against your PostgreSQL instance (from the server shell or psql), never from the browser.
CREATE TABLE IF NOT EXISTS profiles (
  user_id    text PRIMARY KEY,
  data       jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS match_results (
  id         bigserial PRIMARY KEY,
  user_id    text NOT NULL,
  kills      int  NOT NULL CHECK (kills >= 0 AND kills <= 200),
  deaths     int  NOT NULL CHECK (deaths >= 0 AND deaths <= 200),
  rank       int  NOT NULL,
  played_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS match_results_user_idx ON match_results (user_id, played_at DESC);
