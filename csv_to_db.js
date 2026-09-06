const setupDb = require('./setup-db.js');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { parse } =  require('csv-parse/sync');

// --- Configuration ---
const DB_PATH = path.join(__dirname, 'dictionary.db');
const CSV_FILE_PATH = process.argv[2]; // Expecting CSV path as the first argument

if (!CSV_FILE_PATH) {
    console.error("Usage: node csv_to_db.js <path/to/your/data.csv>");
    process.exit(1);
}

// Connect to the database
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

/**
 * Helper function to safely execute multiple SQL statements.
 * @param {string} sqlScript - The SQL script to execute.
 * @param {string} actionName - Name for logging (e.g., 'Categories').
 */
const executeSqlBatch = (sqlScript, actionName) => {
    try {
        db.exec(sqlScript);
        console.log(`✅ Successfully executed ${actionName} setup.`);
    } catch (error) {
        console.error(`❌ Error during ${actionName} setup:`, error.message);
        // We don't exit here because we want to attempt loading other parts.
    }
};

/**
 * 1. CLEANUP: Drops all tables to re-seed the database.
 */
const cleanupDatabase = () => {
    console.log("\n=====================================================");
    console.log("🚀 Starting Database Re-seeding Process (TRASHING DATA)...");
    console.log("=====================================================");

    // Drop tables in dependency order: junction table first, then main tables.
    const cleanupQuery = `
        DROP TABLE IF EXISTS word_categories;
        DROP TABLE IF EXISTS words;
        DROP TABLE IF EXISTS categories;
    `;
    executeSqlBatch(cleanupQuery, "Cleanup");
};

/**
 * 2. CATEGORY PROCESSING: Reads meta-data and ensures all necessary categories exist.
 * @param {Array<string>} metaList - A semi-colon separated list of category names.
 * @returns {Set<number>} A Set of existing or created category IDs.
 */
const processCategories = (uniqueCategories) => {
    if (uniqueCategories.length === 0) {
        return new Set();
    }
    
    console.log(`\n🔍 Processing ${uniqueCategories.length} unique categories...`);
    let categorySql = `INSERT OR IGNORE INTO categories (name) VALUES (?)`;
    let categoryStmt = db.prepare(categorySql);
    
    let categoryIds = [];

    // In a true migration, we would query by name first. For simplicity in a re-seed, 
    // we'll insert them and rely on the UNIQUE constraint if one were added, 
    // but since we are recreating, we'll insert them and assume simple naming for now.
    
    // More accurate approach: Find existing by name OR insert.
    // For a full re-seed, we will just insert them and assume the name is unique enough for this run.
    
    let finalSql = `
        INSERT OR IGNORE INTO categories (name) VALUES (?);
        SELECT id, name FROM categories WHERE name IN (${uniqueCategories.map(() => '?').join(',')});
    `;
    
    // Note: The SELECT part is complex to parameterize for dynamic length. 
    // We'll stick to a simpler INSERT/SELECT pattern for reliability.
    
    const categoryInsertSql = `INSERT OR IGNORE INTO categories (name) VALUES (?)`;
    const insertStmt = db.prepare(categoryInsertSql);
    
    const categoryNames = [];
    uniqueCategories.forEach(name => {
        categoryNames.push(name);
        insertStmt.run(name);
    });
    
    // After inserting, query all IDs to ensure we have fresh IDs for the word linking phase.
    const getCategoryIdsSql = `SELECT id, name FROM categories WHERE name IN (${uniqueCategories.map(() => '?').join(',')})`;
    
    let idResults = db.prepare(getCategoryIdsSql);
    let results = idResults.all(Array.from(uniqueCategories).map(name => name));

    const mappedIds = new Map();
    results.forEach(row => {
        mappedIds.set(row.name, row.id);
    });
    
    console.log(`   Found/Ensured ${mappedIds.size} unique categories.`);
    return mappedIds;
};


/**
 * 3. WORD & LINKING PROCESSING: Processes one CSV row.
 * @param {object} row - Parsed CSV row data.
 * @param {Map<string, number>} categoryIdMap - Map of category names to IDs.
 * @param {Database} db - The database connection.
 */
const processWord = (row, categoryIdMap, db) => {
    // --- Step 1: Process Categories (Meta field) ---
    const rawMeta = row.Meta;
    
    // Re-fetch categories to handle potential naming inconsistencies, although processCategories should handle it.
    const metaNames = rawMeta.split(';').map(s => s.trim()).filter(s => s.length > 0);
    let categoryIdsToLink = [];
    
    metaNames.forEach(name => {
        if (categoryIdMap.has(name)) {
            categoryIdsToLink.push(categoryIdMap.get(name));
        } else {
            console.warn(`   [WARN] Could not find category ID for name: "${name}". Skipping link.`);
        }
    });

    // --- Step 2: Insert/Update Word ---
    const wordInsertSql = `
        INSERT OR REPLACE INTO words (abenaki, french, type, source, alternative_source, infinitive) 
        VALUES (?, ?, ?, ?, ?, ?);
    `;
    const wordStmt = db.prepare(wordInsertSql);
    
    const wordIdResult = wordStmt.run(
        row.Abenaki, // Maps to abenaki
        row.French,  // Maps to french
        row.Type,    // Maps to type
        row.Source,   // Maps to source (assuming this is the source)
        row.AlternativeSource,
        row.Infinitive
    );

    console.log("Insert Word " + row.Abenaki + " " + wordIdResult.lastInsertRowid);
    
    const wordId = wordIdResult.lastInsertRowid;

    // --- Step 3: Link Word to Categories ---
    if (categoryIdsToLink.length > 0) {
        let linkSql = `INSERT OR IGNORE INTO word_categories (word_id, category_id) VALUES (?, ?);`;
        const linkStmt = db.prepare(linkSql);

        categoryIdsToLink.forEach(catId => {
            linkStmt.run(wordId, catId);
        });
        console.log(`   [INFO] Linked Word ID ${wordId} to ${categoryIdsToLink.length} categories.`);
    } else {
        console.log(`   [WARN] Word ID ${wordId} has no valid category links to establish.`);
    }
};


/**
 * Main execution function
 */
const runCsvToDb = () => {
    console.log("=====================================================");
    console.log("         CSV TO DATABASE SEEDER INITIATED         ");
    console.log("=====================================================");
    
    // 1. Cleanup
    cleanupDatabase();
    setupDb();

    // 2. Read CSV File (Assuming simple, non-quoted, comma-separated values for simplicity)
    try 
    {        
        const csvData = fs.readFileSync(CSV_FILE_PATH, 'utf8');

        const rows = parse(csvData, {
            columns: true,           // Uses the first line as object keys (headers)
            skip_empty_lines: true,  // Bypasses blank rows
            trim: true               // Trims whitespace around fields
            });


        console.log("\n=====================================================");
        console.log("🏗️ PHASE 1: BUILDING CATEGORY STRUCTURE FROM CSV METADATA");
        console.log("=====================================================");

        let categoriesSet = new Set();
        rows.forEach(
            row => 
            {
                if ( row.Meta != '' )
                {
                    let splittedCategories = row.Meta.split(";");
                    splittedCategories.forEach(
                        category=>
                        {
                            if ( category )
                            {
                                categoriesSet.add(category);
                            }
                        })
                }
            }
        );

        let categories = Array.from(categoriesSet);
        
        // Build Category Map
        const categoryIdMap = processCategories(categories);
        
        // --- PASS 2: Process Words and Links ---
        console.log("\n=====================================================");
        console.log("📖 PHASE 2: LOADING WORDS AND LINKING CATEGORIES");
        console.log("=====================================================");
        
        console.log("Rows: " + rows.length);
        for (const row of rows) 
        {
            processWord(row, categoryIdMap, db);
        }

    } catch (error) {
        console.error("\n\n🚨 FATAL ERROR during CSV processing:", error.message);
    } finally {
        console.log("\n=====================================================");
        console.log("✅ Database Seeding Complete.");
        db.close();
    }
};

runCsvToDb();
// ... existing code ...


// Handle empty category