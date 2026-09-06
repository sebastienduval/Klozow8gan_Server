const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware to parse incoming JSON payloads
app.use(express.json());

// Connect to the database and enforce foreign keys
const db = new Database(path.join(__dirname, 'dictionary.db'));
db.pragma('foreign_keys = ON');

// ---------------------------------------------------------
// CREATE: Add a new word
// ---------------------------------------------------------
app.post('/api/words', (req, res) => {
    const { 
        abenaki_word, 
        french_translation, 
        part_of_speech, 
        example_sentence, 
        difficulty_level 
    } = req.body;

    // Basic validation
    if (!abenaki_word || !french_translation || !part_of_speech) {
        return res.status(400).json({ error: 'Missing required fields.' });
    }

    try {
        const stmt = db.prepare(`
            INSERT INTO words 
            (abenaki_word, french_translation, part_of_speech, example_sentence, difficulty_level) 
            VALUES (?, ?, ?, ?, ?)
        `);
        
        const info = stmt.run(
            abenaki_word, 
            french_translation, 
            part_of_speech, 
            example_sentence || null, 
            difficulty_level || 1
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
// UPDATE: Modify an existing word
// ---------------------------------------------------------
app.put('/api/words/:id', (req, res) => {
    const { id } = req.params;
    const { 
        abenaki_word, 
        french_translation, 
        part_of_speech, 
        example_sentence, 
        difficulty_level 
    } = req.body;

    try {
        const stmt = db.prepare(`
            UPDATE words 
            SET abenaki_word = COALESCE(?, abenaki_word),
                french_translation = COALESCE(?, french_translation),
                part_of_speech = COALESCE(?, part_of_speech),
                example_sentence = COALESCE(?, example_sentence),
                difficulty_level = COALESCE(?, difficulty_level)
            WHERE id = ?
        `);

        // COALESCE allows partial updates (if a field is undefined, it keeps the old value)
        const info = stmt.run(
            abenaki_word, 
            french_translation, 
            part_of_speech, 
            example_sentence, 
            difficulty_level, 
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

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 API running on http://localhost:${PORT}`);
});