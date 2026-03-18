import pg from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

// PostgreSQL connection configuration
const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const needsSsl = process.env.NODE_ENV === 'production' || (dbUrl && dbUrl.includes('neon.tech'));
const pool = new Pool({
  connectionString: dbUrl,
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
});

// Test connection on startup
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error:', err);
});

/**
 * Convert SQLite-style `?` placeholders to PostgreSQL `$1, $2, ...` format.
 * Handles quoted strings and avoids replacing `?` inside them.
 */
function convertPlaceholders(sql) {
  let index = 0;
  let result = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const prev = i > 0 ? sql[i - 1] : '';

    if (char === "'" && !inDoubleQuote && prev !== '\\') {
      inSingleQuote = !inSingleQuote;
      result += char;
    } else if (char === '"' && !inSingleQuote && prev !== '\\') {
      inDoubleQuote = !inDoubleQuote;
      result += char;
    } else if (char === '?' && !inSingleQuote && !inDoubleQuote) {
      index++;
      result += `$${index}`;
    } else {
      result += char;
    }
  }

  return { sql: result, paramCount: index };
}

/**
 * Convert SQLite `INSERT OR IGNORE` to PostgreSQL `INSERT ... ON CONFLICT DO NOTHING`.
 */
function convertInsertOrIgnore(sql) {
  return sql.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');
}

/**
 * Check if the SQL already has a RETURNING clause.
 */
function hasReturning(sql) {
  return /\bRETURNING\b/i.test(sql);
}

/**
 * Check if the SQL is an INSERT statement.
 */
function isInsert(sql) {
  return /^\s*INSERT\s+/i.test(sql);
}

/**
 * Check if the original SQL had OR IGNORE (meaning ON CONFLICT DO NOTHING should be added).
 */
function hadOrIgnore(originalSql) {
  return /INSERT\s+OR\s+IGNORE\s+INTO/i.test(originalSql);
}

/**
 * Add ON CONFLICT DO NOTHING for INSERT OR IGNORE conversions.
 * Must be added before RETURNING clause if present.
 */
function addOnConflictDoNothing(sql) {
  if (/ON\s+CONFLICT/i.test(sql)) return sql; // already has it
  // Insert before RETURNING if present
  if (hasReturning(sql)) {
    return sql.replace(/(\bRETURNING\b)/i, 'ON CONFLICT DO NOTHING $1');
  }
  return sql.trimEnd().replace(/;?\s*$/, '') + ' ON CONFLICT DO NOTHING';
}

// Helper to run queries (PostgreSQL-compatible wrapper)
const db = {
  prepare: (originalSql) => {
    const needsOnConflict = hadOrIgnore(originalSql);
    let sql = convertInsertOrIgnore(originalSql);
    const { sql: convertedSql } = convertPlaceholders(sql);
    sql = convertedSql;

    if (needsOnConflict) {
      sql = addOnConflictDoNothing(sql);
    }

    return {
      run: async (...params) => {
        // For INSERT, UPDATE, DELETE
        let execSql = sql;

        // For INSERTs, add RETURNING id if not already present, to get lastInsertRowid
        if (isInsert(execSql) && !hasReturning(execSql)) {
          execSql = execSql.trimEnd().replace(/;?\s*$/, '') + ' RETURNING id';
        }

        const res = await pool.query(execSql, params.length > 0 ? params : undefined);
        return {
          lastInsertRowid: res.rows && res.rows[0] ? res.rows[0].id : null,
          changes: res.rowCount,
        };
      },
      get: async (...params) => {
        // For SELECT single row
        const res = await pool.query(sql, params.length > 0 ? params : undefined);
        if (res.rows.length === 0) return null;
        return res.rows[0];
      },
      all: async (...params) => {
        // For SELECT multiple rows
        const res = await pool.query(sql, params.length > 0 ? params : undefined);
        return res.rows;
      }
    };
  },
  exec: (sql) => {
    // For multiple statements (like schema creation)
    return pool.query(sql);
  },
  // Direct access to pool for complex queries
  query: (sql, params) => pool.query(sql, params)
};

export default db;

// Create tables if they don't exist (PostgreSQL syntax)
const createTables = async () => {
  try {
    // Create users table first (others depend on it)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        matric_no TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE DEFAULT NULL,
        password TEXT NOT NULL,
        display_name TEXT DEFAULT '',
        bio TEXT DEFAULT '',
        profile_pic_url TEXT DEFAULT '',
        role TEXT DEFAULT 'student' CHECK (role IN ('student', 'admin')),
        is_first_login INTEGER DEFAULT 1,
        dob TEXT DEFAULT NULL,
        birthday_pic_url TEXT DEFAULT '',
        shoutout_url TEXT DEFAULT '',
        instagram TEXT DEFAULT '',
        twitter TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create allowed_matrics table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS allowed_matrics (
        id SERIAL PRIMARY KEY,
        matric_no TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE DEFAULT NULL,
        added_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create courses table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        course_code TEXT NOT NULL,
        course_name TEXT NOT NULL,
        description TEXT DEFAULT '',
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create quizzes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS quizzes (
        id SERIAL PRIMARY KEY,
        course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        tags TEXT DEFAULT '[]',
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        times_taken INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create questions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        question_text TEXT NOT NULL,
        option_a TEXT NOT NULL,
        option_b TEXT NOT NULL,
        option_c TEXT NOT NULL,
        option_d TEXT NOT NULL,
        correct_option TEXT NOT NULL CHECK (correct_option IN ('a', 'b', 'c', 'd')),
        explanation TEXT DEFAULT ''
      );
    `);

    // Create attempts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS attempts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        score INTEGER NOT NULL,
        total_questions INTEGER NOT NULL,
        time_spent INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create comments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create suggestions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS suggestions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        text TEXT NOT NULL,
        parent_id INTEGER REFERENCES suggestions(id) ON DELETE CASCADE,
        status TEXT DEFAULT 'open' CHECK (status IN ('open', 'reviewed')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create bookmarks table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, quiz_id)
      );
    `);

    // Create achievements table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS achievements (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        badge_type TEXT NOT NULL,
        earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, badge_type)
      );
    `);

    // Create streaks table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS streaks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        current_streak INTEGER DEFAULT 0,
        longest_streak INTEGER DEFAULT 0,
        last_activity_date TEXT DEFAULT ''
      );
    `);

    // Create notifications table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        reference_id INTEGER DEFAULT NULL,
        is_read INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create pending_role_changes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pending_role_changes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        new_role TEXT NOT NULL,
        requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create live_sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS live_sessions (
        id SERIAL PRIMARY KEY,
        quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        host_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_code TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'finished')),
        current_question INTEGER DEFAULT 0,
        question_duration INTEGER DEFAULT 20,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create live_participants table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS live_participants (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        total_score INTEGER DEFAULT 0,
        total_time INTEGER DEFAULT 0,
        streak INTEGER DEFAULT 0,
        UNIQUE(session_id, user_id)
      );
    `);

    // Create live_answers table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS live_answers (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
        answer TEXT,
        time_ms INTEGER DEFAULT 0,
        is_correct INTEGER DEFAULT 0,
        points INTEGER DEFAULT 0
      );
    `);

    // Create marketplace_items_table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS marketplace_items (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        price NUMERIC NOT NULL,
        contact_info TEXT NOT NULL,
        image_url_1 TEXT,
        image_url_2 TEXT,
        image_url_3 TEXT,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create flashcards table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS flashcards (
        id SERIAL PRIMARY KEY,
        course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        cards_json TEXT NOT NULL,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL,
        device TEXT DEFAULT 'Unknown',
        ip_address TEXT DEFAULT 'Unknown',
        is_active INTEGER DEFAULT 1,
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create polls table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS polls (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        is_public INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create poll_options table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS poll_options (
        id SERIAL PRIMARY KEY,
        poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
        option_text TEXT NOT NULL
      );
    `);

    // Create poll_votes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS poll_votes (
        id SERIAL PRIMARY KEY,
        poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
        option_id INTEGER NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(poll_id, user_id)
      );
    `);

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id);
      CREATE INDEX IF NOT EXISTS idx_attempts_quiz ON attempts(quiz_id);
      CREATE INDEX IF NOT EXISTS idx_questions_quiz ON questions(quiz_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
      CREATE INDEX IF NOT EXISTS idx_comments_quiz ON comments(quiz_id);
      CREATE INDEX IF NOT EXISTS idx_live_participants_session ON live_participants(session_id);
      CREATE INDEX IF NOT EXISTS idx_live_answers_session ON live_answers(session_id, question_id);
      CREATE INDEX IF NOT EXISTS idx_pending_role_user ON pending_role_changes(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_marketplace_status ON marketplace_items(status);
      CREATE INDEX IF NOT EXISTS idx_flashcards_status ON flashcards(status);
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, is_active);
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON poll_votes(poll_id);
      CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON poll_options(poll_id);
    `);
  } catch (err) {
    console.error('Error creating tables:', err);
  }
};

// Initialize database
createTables();

export { pool, db };
