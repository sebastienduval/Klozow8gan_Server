const Database = require('better-sqlite3');
const path = require('path');

function setupDb()
{
  // Connect to SQLite database (creates 'dictionary.db' if it doesn't exist)
  const db = new Database(path.join(__dirname, 'dictionary.db'));

  // Ensure Foreign Key constraints are active (SQLite turns them off by default)
  db.pragma('foreign_keys = ON');

  console.log('Setting up SQLite database schema...');

  // Execute table creation inside a single SQL script string
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
    --    A word can belong to many quizzes, and a quiz can have many words.
    CREATE TABLE IF NOT EXISTS word_quiz (
        word_id INTEGER,
        quiz_id INTEGER,
        PRIMARY KEY (word_id, quiz_id),
        FOREIGN KEY (word_id) REFERENCES words (id) ON DELETE CASCADE,
        FOREIGN KEY (quiz_id) REFERENCES quiz (id) ON DELETE CASCADE
    );    

    -- Indices for Fast Searching
    CREATE INDEX IF NOT EXISTS idx_abenaki_search ON words(abenaki);
    CREATE INDEX IF NOT EXISTS idx_french_search ON words(french);

    -- Indices for Quiz lookups
    CREATE INDEX IF NOT EXISTS idx_quiz_name ON quiz(name);
    CREATE INDEX IF NOT EXISTS idx_word_quiz_word ON word_quiz(word_id);
    CREATE INDEX IF NOT EXISTS idx_word_quiz_quiz ON word_quiz(quiz_id);    
  `;

  try {
    // db.exec runs multi-statement DDL queries
    db.exec(setupQuery);
    console.log('✅ Database setup complete: Tables and indices created (if missing).');
  } catch (error) {
    console.error('❌ Error setting up database:', error);
  } finally {
    // Cleanly close the database connection
    db.close();
  }  
}

setupDb();

module.exports = setupDb;