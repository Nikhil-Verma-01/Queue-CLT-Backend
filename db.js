// db.js — sqlite initialization
const Database = require('better-sqlite3');
const cfg = require('./config.json');
const db = new Database(cfg.db_path || './queue.db');

db.exec(`
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  command TEXT NOT NULL,
  state TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  timeout_seconds INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  worker_id TEXT,
  locked_at TEXT,
  run_at TEXT,
  output_log TEXT
);

CREATE TABLE IF NOT EXISTS dead_jobs (
  id TEXT PRIMARY KEY,
  command TEXT NOT NULL,
  last_error TEXT,
  attempts INTEGER,
  max_retries INTEGER,
  priority INTEGER,
  created_at TEXT,
  moved_at TEXT,
  output_log TEXT
);

CREATE TABLE IF NOT EXISTS workers (
  id TEXT PRIMARY KEY,
  pid INTEGER,
  started_at TEXT
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

module.exports = db;
