// History Quest - Database Layer
// ==============================
// SQLite via Node's built-in node:sqlite module (no extra dependencies).

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const DB_PATH = process.env.HISTORY_QUEST_DB || path.join(__dirname, "data", "history-quest.db");

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS countries (
    key         TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    icon        TEXT NOT NULL,
    color       TEXT NOT NULL,
    description TEXT NOT NULL,
    sort_order  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS lessons (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    country_key TEXT NOT NULL REFERENCES countries(key) ON DELETE CASCADE,
    level       INTEGER NOT NULL,
    title       TEXT NOT NULL,
    difficulty  TEXT NOT NULL,
    icon        TEXT NOT NULL,
    points      INTEGER NOT NULL,
    reading_md  TEXT NOT NULL,
    UNIQUE (country_key, level)
  );

  CREATE TABLE IF NOT EXISTS questions (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    position  INTEGER NOT NULL,
    question  TEXT NOT NULL,
    choices   TEXT NOT NULL, -- JSON array of strings
    answer    TEXT NOT NULL,
    UNIQUE (lesson_id, position)
  );

  CREATE TABLE IF NOT EXISTS players (
    id         TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS quizzes (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id     TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    lesson_id     INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    started_at    INTEGER NOT NULL,
    finished_at   INTEGER,
    score         INTEGER,
    total         INTEGER NOT NULL,
    percentage    INTEGER,
    points_earned INTEGER
  );

  CREATE TABLE IF NOT EXISTS quiz_questions (
    quiz_id     INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    position    INTEGER NOT NULL,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    chosen      TEXT,
    correct     INTEGER,
    PRIMARY KEY (quiz_id, position)
  );

  CREATE TABLE IF NOT EXISTS player_badges (
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    badge_key TEXT NOT NULL,
    earned_at INTEGER NOT NULL,
    PRIMARY KEY (player_id, badge_key)
  );

  CREATE INDEX IF NOT EXISTS idx_quizzes_player ON quizzes(player_id, finished_at);
`;

function openDatabase(dbPath = DB_PATH) {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  return db;
}

// Run fn inside a transaction, rolling back on any error.
function transaction(db, fn) {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

module.exports = { openDatabase, transaction, DB_PATH };
