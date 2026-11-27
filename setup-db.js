const { DatabaseSync } = require('node:sqlite');
const path = require('path');

function setupDb() {
  // Connect to SQLite database (creates 'dictionary.db' if it doesn't exist)
  const db = new DatabaseSync(path.join(__dirname, 'dictionary.db'));

  // Ensure Foreign Key constraints are active
  db.exec('PRAGMA foreign_keys = ON;');

  console.log('Setting up SQLite database schema...');

  const setupQuery = `
    -- Categories Table (Hierarchy)
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
    );

    -- Words Table (Dictionary)
    CREATE TABLE IF NOT EXISTS words (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        abenaki TEXT NOT NULL,
        french TEXT NOT NULL,
        type TEXT NOT NULL,
        source TEXT,
        alternative_source TEXT,
        infinitive TEXT
    );

    -- Junction Table (Word-to-Category Many-to-Many Link)
    CREATE TABLE IF NOT EXISTS word_categories (
        word_id INTEGER,
        category_id INTEGER,
        PRIMARY KEY (word_id, category_id),
        FOREIGN KEY (word_id) REFERENCES words (id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
    );

    -- Quiz Table (Each quiz has an id and a name)
    CREATE TABLE IF NOT EXISTS quiz (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        author TEXT NOT NULL
    );

    -- Junction Table (Word-to-Quiz Many-to-Many Link)
    -- A word can belong to many quizzes, and a quiz can have many words.
    CREATE TABLE IF NOT EXISTS word_quiz (
        word_id INTEGER,
        quiz_id INTEGER,
        PRIMARY KEY (word_id, quiz_id),
        FOREIGN KEY (word_id) REFERENCES words (id) ON DELETE CASCADE,
        FOREIGN KEY (quiz_id) REFERENCES quiz (id) ON DELETE CASCADE
    );

    -- Morphemes Table
    CREATE TABLE IF NOT EXISTS morphemes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        morpheme TEXT NOT NULL,
        description TEXT NOT NULL,
        type TEXT NOT NULL
    );

    -- Indices for Fast Searching
    CREATE INDEX IF NOT EXISTS idx_abenaki_search ON words(abenaki);
    CREATE INDEX IF NOT EXISTS idx_french_search ON words(french);

    -- Indices for Quiz lookups
    CREATE INDEX IF NOT EXISTS idx_quiz_name ON quiz(name);
    CREATE INDEX IF NOT EXISTS idx_word_quiz_word ON word_quiz(word_id);
    CREATE INDEX IF NOT EXISTS idx_word_quiz_quiz ON word_quiz(quiz_id);

    -- Indices for Morpheme lookups
    CREATE INDEX IF NOT EXISTS idx_morphemes_morpheme ON morphemes(morpheme);
    CREATE INDEX IF NOT EXISTS idx_morphemes_type ON morphemes(type);
  `;

  try {
    db.exec(setupQuery);
    console.log('✅ Database setup complete: Tables and indices created (if missing).');
  } catch (error) {
    console.error('❌ Error setting up database:', error);
  } finally {
    db.close();
  }
}

if (require.main === module) {
  setupDb();
}

module.exports = setupDb;