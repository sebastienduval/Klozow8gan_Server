const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const cors = require('cors');

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

function getAllWords(language)
{
  
}

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

// ---------------------------------------------------------
// PUT: Export the dictionary.
// ---------------------------------------------------------
app.put('/api/export', (req, res) => 
{
    try 
    {
        console.log("Export");
        res.json({ message: 'Words exported successfully' });
    } 
    catch (error) 
    {
        res.status(500).json({ error: 'Database error', details: error.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 API running on http://localhost:${PORT}`);
});