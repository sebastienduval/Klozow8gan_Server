const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const cors = require('cors');
const { db_to_csv, csv_to_json } = require('./db_tools');
const fs = require('node:fs');
const { v4: uuidv4} = require('uuid');
const { execSync } = require('child_process');


const app = express();
const PORT = 3000;

// Middleware to parse incoming JSON payloads
app.use(express.json());
app.use(cors()); 


// Connect to the database and enforce foreign keys
const db = new Database(path.join(__dirname, 'dictionary.db'));
db.pragma('foreign_keys = ON');

// Escape LIKE metacharacters so user input is treated literally.
function escapeLike(str) {
    return String(str).replace(/[\\%_]/g, '\\$&');
}

// ---------------------------------------------------------
// CREATE: Add a new word
// ---------------------------------------------------------
app.post('/api/words', (req, res) => {
    const 
    { 
        abenaki, 
        french, 
        type, 
        source, 
        alternative_source,
        infinitive
    } = req.body;

    console.log(req.body);
    console.log(abenaki + " " + french + " " + type);

    // Basic validation
    if (!abenaki || !french || !type) 
    {
        return res.status(400).json({ error: 'Missing required fields.' });
    }

    try {
        const stmt = db.prepare(`
            INSERT INTO words 
            (abenaki, french, type, source, alternative_source, infinitive) 
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        const info = stmt.run(
            abenaki, 
            french, 
            type, 
            source || null,
            alternative_source || null, 
            infinitive || null
        );

        res.status(201).json({ 
            message: 'Word added successfully', 
            word_id: info.lastInsertRowid 
        });
    } catch (error) {
        res.status(500).json({ error: 'Database error', details: error.message });
    }
});

// ---------------------------------------------------------
// READ: Fetch a single word by id
// ---------------------------------------------------------
app.get('/api/words/:id', (req, res) => {
    const { id } = req.params;

    try {
        const stmt = db.prepare('SELECT * FROM words WHERE id = ?');
        const row = stmt.get(id);

        if (!row) {
            return res.status(404).json({ error: 'Word not found' });
        }

        res.json(row);
    } catch (error) {
        res.status(500).json({ error: 'Database error', details: error.message });
    }
});

// ---------------------------------------------------------
// SEARCH: List words matching a query
//          Supports basic "starts with" and "ends with"
//          GET /api/words/search?starts=...&ends=...
//          (also accepts ?q={starts, ends} style params)
// ---------------------------------------------------------
app.get('/api/search/', (req, res) => {

    // Express parses complex query strings into objects, so support both
    // ?starts=foo&ends=bar and ?q={starts, ends} styles.
    let startsWith = null;
    let endsWith = null;
    let language = "abenaki";

    const raw = req.query;
    if (raw && typeof raw === 'object') {
        startsWith = raw.starts || null;
        endsWith = raw.ends || null;
        if ( raw.language == "abenaki" || raw.language == "french")
        {
            language = raw.language;
        }
        else
        {
            return res.status(404).json({ error: 'Invalid language.' });
        }
    } else if (typeof raw === 'string') {
        startsWith = raw || null;
    }

    // No filter provided -> return every word.
    if (!startsWith && !endsWith) 
    {
        let sql = 'SELECT * FROM words';
        sql += ' ORDER BY ' + language + ' COLLATE NOCASE ASC';
        let query = db.prepare(sql);

        try {
            const rows = query.all();
            res.json(rows);
        } catch (error) {
            res.status(500).json({ error: 'Database error', details: error.message });
        }
        return;
    }

    let sql = 'SELECT * FROM words WHERE 1 = 1';
    const params = [];

    if (startsWith) {
        sql += ' AND ' + language + ' LIKE ?';
        params.push(escapeLike(startsWith) + '%');
    }
    if (endsWith) {
        sql += ' AND ' + language + ' LIKE ?';
        params.push('%' + escapeLike(endsWith));      // ends with "bar"
    }

    sql += ' ORDER BY ' + language + ' COLLATE NOCASE ASC';

    let query = db.prepare(sql);

    try {
        const rows = query.all(...params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error', details: error.message });
    }
});

// ---------------------------------------------------------
// UPDATE: Modify an existing word
// ---------------------------------------------------------
app.put('/api/words/:id', (req, res) => {
    const { id } = req.params;
    const 
    { 
        abenaki, 
        french, 
        type, 
        source, 
        alternative_source,
        infinitive
    } = req.body;

    try {
        const stmt = db.prepare(`
            UPDATE words 
            SET abenaki = COALESCE(?, abenaki),
                french = COALESCE(?, french),
                type = COALESCE(?, type),
                source = COALESCE(?, source),
                alternative_source = COALESCE(?, alternative_source),
                infinitive = COALESCE(?, infinitive)
            WHERE id = ?
        `);

        // COALESCE allows partial updates (if a field is undefined, it keeps the old value)
        const info = stmt.run(
            abenaki, 
            french, 
            type, 
            source,
            alternative_source, 
            infinitive,
            id
        );

        if (info.changes === 0) {
            return res.status(404).json({ error: 'Word not found' });
        }

        res.json({ message: 'Word updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Database error', details: error.message });
    }
});

// ---------------------------------------------------------
// DELETE: Remove a word
// ---------------------------------------------------------
app.delete('/api/words/:id', (req, res) => {
    const { id } = req.params;

    try {
        console.log(id);

        const stmt = db.prepare('DELETE FROM words WHERE id = ?');
        const info = stmt.run(id);

        if (info.changes === 0) {
            return res.status(404).json({ error: 'Word not found' });
        }

        // Note: Because we used 'ON DELETE CASCADE' in our schema, 
        // this will also automatically delete any links in the word_categories table.
        res.json({ message: 'Word deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Database error', details: error.message });
    }
});


async function commitAndPushDict(repo_path, file, branch) 
{
  const message = 'Update ' + file + ' to ' + branch;

  try {

    let env = {cwd: repo_path, enencoding: 'utf-8'};
    // 1. Stage the file
    execSync(`git add ${file}`,env);

    // 2. Check if there are actually changes to commit
    // execSync returns a Buffer, so we must call .toString()
    const status = execSync('git status --porcelain', env).toString();
    if (!status.includes(file)) {
      console.log(`No changes detected in ${file}. Skipping commit.`);
      return;
    }

    // 3. Commit the file
    execSync(`git commit -m "${message}"`, env);
    
    // 4. Push to remote
    // Passing { stdio: 'pipe' } captures the output to be printed or logged
    const pushOutput = execSync(`git push origin ${branch}`, {cwd: repo_path, enencoding: 'utf-8', stdio: 'pipe' }).toString();
    console.log('Push complete:\n', pushOutput);
    
  } catch (error) {
    // If a command fails (non-zero exit code), execSync throws an error
    console.error('Git operation failed:', error.message);
    
    // Print the specific git error output if available
    if (error.stderr) {
      console.error('Git error details:\n', error.stderr.toString());
    }
    throw error;
  }
}

// ---------------------------------------------------------
// PUT: Export the dictionary.
// ---------------------------------------------------------
app.put('/api/export', (req, res) => 
{
    try 
    {
        const export_folder = "../Klozow8gan_Web/";
        const csv_filepath = export_folder + uuidv4() + ".csv";
        const json_filepath = export_folder + "Dict.json";        

        console.log("Export");
        db_to_csv('dictionary.db', csv_filepath);
        csv_to_json(csv_filepath, json_filepath);

        fs.unlink( csv_filepath, (err) => {
            if (err) {
                res.json({ message: 'Error while deleting ' + csv_filepath + '.' });
                throw err;
            }
            console.log(csv_filepath + ' was deleted');
        });

        commitAndPushDict("../Klozow8gan_Web/", "Dict.json", 'main');

        res.json({ message: 'Words exported successfully' });
    } 
    catch (error) 
    {
        res.status(500).json({ error: 'Database error', details: error.message });
    }
});

// ---------------------------------------------------------
// QUIZZES
// ---------------------------------------------------------
// ---------------------------------------------------------
// Helper: Fetch a full quiz with its list of words.
//   GET /api/quizzes/:id  (and internally)
// A quiz references words via the word_quiz junction table.
// ---------------------------------------------------------
function fetchQuiz(quizId) {
    const quiz = db.prepare('SELECT * FROM quiz WHERE id = ?').get(quizId);
    if (!quiz) return null;

    const words = db.prepare(`
        SELECT w.* FROM words w
        JOIN word_quiz wq ON wq.word_id = w.id
        WHERE wq.quiz_id = ?
        ORDER BY w.id ASC
    `).all(quizId);

    return { ...quiz, words };
}

// ---------------------------------------------------------
// Helper: Normalize a word entry into { word_id, quiz_id }.
// Accepts either a word id ({ id: 5 } or "5") or a full
// word object. Deduplicates against the word_quiz PK.
// ---------------------------------------------------------
function normalizeWords(words, quizId) {
    const normalized = [];
    const seen = new Set();

    for (const item of words) {
        if (!item || item === null) continue;

        let wordId;
        if (typeof item === 'string') {
            wordId = parseInt(item, 10);
        } else {
            wordId = item.id;
        }

        if (!wordId) continue;

        const key = `${wordId}:${quizId}`;
        if (seen.has(key)) continue;
        seen.add(key);

        normalized.push({ word_id: wordId, quiz_id: quizId });
    }

    return normalized;
}

// ---------------------------------------------------------
// CREATE: Add a new quiz with a list of words
// POST /api/quizzes
// Body: { name, author, words: [{ id: 1 }] }
// ---------------------------------------------------------
app.post('/api/quizzes', (req, res) => {
    const { name, author, words } = req.body;

    // Basic validation
    if (!name || !author) {
        return res.status(400).json({ error: 'Missing required fields: name, author.' });
    }
    if (!Array.isArray(words) || words.length === 0) {
        return res.status(400).json({ error: 'A quiz must contain at least one word.' });
    }

    // Validate that every referenced word exists
    const badWords = [];
    for (const item of words) {
        const wordId = typeof item === 'string' ? parseInt(item, 10) : item.id;
        if (!wordId) continue;
        const exists = db.prepare('SELECT 1 FROM words WHERE id = ?').get(wordId);
        if (!exists) badWords.push(wordId);
    }
    if (badWords.length) {
        return res.status(400).json({ error: 'Unknown word ids:', words: badWords });
    }

    // Insert quiz + words atomically
    db.transaction(() => {
        const quiz_id = db.prepare('INSERT INTO quiz (name, author) VALUES (?, ?)')
            .run(name, author).lastInsertRowid;

        for (const { word_id } of normalizeWords(words, quiz_id)) {
            db.prepare('INSERT INTO word_quiz (word_id, quiz_id) VALUES (?, ?)')
                .run(word_id, quiz_id);
        }
    })();

    res.status(201).json(fetchQuiz(quiz_id));
});

// ---------------------------------------------------------
// READ: List all quizzes (optional ?author= filter)
// GET /api/quizzes
// ---------------------------------------------------------
app.get('/api/quizzes', (req, res) => {
    const { author } = req.query;

    let where = 'WHERE 1 = 1';
    const params = [];
    if (author) {
        where += ' AND author = ?';
        params.push(author);
    }

    const sql = `SELECT * FROM quiz ${where} ORDER BY name COLLATE NOCASE ASC`;
    try {
        const quizzes = db.prepare(sql).all(...params);
        res.json(quizzes.map(q => fetchQuiz(q.id)));
    } catch (error) {
        res.status(500).json({ error: 'Database error', details: error.message });
    }
});

// ---------------------------------------------------------
// READ: Fetch a single quiz with its words
// GET /api/quizzes/:id
// ---------------------------------------------------------
app.get('/api/quizzes/:id', (req, res) => {
    const { id } = req.params;

    try {
        const quiz = fetchQuiz(id);
        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }
        res.json(quiz);
    } catch (error) {
        res.status(500).json({ error: 'Database error', details: error.message });
    }
});

// ---------------------------------------------------------
// MODIFY: Update a quiz's name/author and/or its word list
// PUT /api/quizzes/:id
// Body examples:
//   { name: "New name", author: "Alice" }                 // rename
//   { words: [1, 2, 3] }                                  // replace whole list
//   { wordsToAdd: [1], wordsToRemove: [2] }               // partial changes
// ---------------------------------------------------------
app.put('/api/quizzes/:id', (req, res) => {
    const { id } = req.params;
    const { name, author, words, wordsToAdd, wordsToRemove } = req.body;

    try {
        // 1. Update quiz metadata (COALESCE keeps existing value if field omitted)
        const info = db.prepare(`
            UPDATE quiz
            SET name = COALESCE(?, name),
                author = COALESCE(?, author)
            WHERE id = ?
        `).run(name, author, id);

        if (info.changes === 0) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        // 2. Remove words (if requested)
        if (Array.isArray(wordsToRemove)) {
            for (const wordId of wordsToRemove) {
                if (wordId === undefined || wordId === null) continue;
                db.prepare('DELETE FROM word_quiz WHERE quiz_id = ? AND word_id = ?')
                    .run(id, wordId);
            }
        }

        // 3. Add words (if requested)
        if (Array.isArray(wordsToAdd)) {
            for (const { word_id } of normalizeWords(wordsToAdd, id)) {
                db.prepare('INSERT INTO word_quiz (word_id, quiz_id) VALUES (?, ?)')
                    .run(word_id, id);
            }
        }

        // 4. Replace entire word list (if requested)
        if (Array.isArray(words)) {
            db.prepare('DELETE FROM word_quiz WHERE quiz_id = ?').run(id);
            for (const { word_id } of normalizeWords(words, id)) {
                db.prepare('INSERT INTO word_quiz (word_id, quiz_id) VALUES (?, ?)')
                    .run(word_id, id);
            }
        }

        res.json(fetchQuiz(id));
    } catch (error) {
        res.status(500).json({ error: 'Database error', details: error.message });
    }
});

// ---------------------------------------------------------
// DELETE: Remove a quiz (cascade-deletes its words)
// DELETE /api/quizzes/:id
// ---------------------------------------------------------
app.delete('/api/quizzes/:id', (req, res) => {
    const { id } = req.params;

    try {
        const info = db.prepare('DELETE FROM quiz WHERE id = ?').run(id);

        if (info.changes === 0) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        // ON DELETE CASCADE removes word_quiz links automatically
        res.json({ message: 'Quiz deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Database error', details: error.message });
    }
});

// ---------------------------------------------------------
// ADD WORD: Add a single word to a quiz
// POST /api/quizzes/:id/words
// Body: { word: 5 }  or  { word: { id: 5, ... } }
// ---------------------------------------------------------
app.post('/api/quizzes/:id/words', (req, res) => {
    const { id } = req.params;
    const { word } = req.body;

    if (!word) {
        return res.status(400).json({ error: 'Missing "word" field.' });
    }

    const wordId = typeof word === 'string' ? parseInt(word, 10) : word.id;
    if (!wordId) {
        return res.status(400).json({ error: 'Word must have an "id".' });
    }

    const existing = db.prepare('SELECT 1 FROM word_quiz WHERE word_id = ? AND quiz_id = ?')
        .get(wordId, id);
    if (existing) {
        return res.status(409).json({ error: 'Word already in quiz' });
    }

    try {
        const info = db.prepare('INSERT INTO word_quiz (word_id, quiz_id) VALUES (?, ?)')
            .run(wordId, id);

        if (info.changes === 0) {
            return res.status(409).json({ error: 'Word already in quiz' });
        }

        res.json({ message: 'Word added to quiz', word_id: wordId, quiz_id: id });
    } catch (error) {
        res.status(500).json({ error: 'Database error', details: error.message });
    }
});

// ---------------------------------------------------------
// REMOVE WORD: Remove a single word from a quiz
// DELETE /api/quizzes/:id/words/:wordId
// ---------------------------------------------------------
app.delete('/api/quizzes/:id/words/:wordId', (req, res) => {
    const { id } = req.params;
    const { wordId } = req.params;

    try {
        const info = db.prepare('DELETE FROM word_quiz WHERE quiz_id = ? AND word_id = ?')
            .run(id, wordId);

        if (info.changes === 0) {
            return res.status(404).json({ error: 'Word not in quiz' });
        }

        res.json({ message: 'Word removed from quiz' });
    } catch (error) {
        res.status(500).json({ error: 'Database error', details: error.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 API running on http://localhost:${PORT}`);
});