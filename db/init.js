import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "..", "db.sqlite");

export function initializeDatabase() {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      username TEXT UNIQUE,
      phone TEXT UNIQUE,
      password_hash TEXT,
      full_name TEXT,
      profile_picture_url TEXT,
      oauth_provider TEXT,
      oauth_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Add username column if the table already existed without it
  const userColumns = db.prepare("PRAGMA table_info(users)").all().map((column) => column.name);
  if (!userColumns.includes("username")) {
    db.exec("ALTER TABLE users ADD COLUMN username TEXT;");
  }

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
    CREATE INDEX IF NOT EXISTS idx_users_oauth_id ON users(oauth_id);
  `);

  // Create auth_tokens table for logout tracking (optional, but useful)
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_id ON auth_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_auth_tokens_expires_at ON auth_tokens(expires_at);
  `);

  return db;
}
