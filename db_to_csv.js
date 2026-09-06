const fs = require('node:fs');
const Database = require('better-sqlite3');
const path = require('path');
const {stringify} = require('csv-stringify/sync');

const DB_PATH = path.join(__dirname, 'dictionary.db');
const CSV_FILE_PATH = process.argv[2]; 

if (!CSV_FILE_PATH) {
    console.error("Usage: node db_to_csv.js <path/to/your/data.csv>");
    process.exit(1);
}


const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

const stmt = db.prepare('SELECT * FROM words ORDER BY abenaki ASC;');
const category_ids_stmt = db.prepare('SELECT category_id FROM word_categories WHERE word_id = ?;');
const categories_stmt = db.prepare('SELECT c.name FROM categories c JOIN word_categories wc ON c.id = wc.category_id where wc.word_id =?;');

const result = stmt.all();

let csv = [["French","Type","Abenaki","Meta","Source","AlternativeSource","Infinitive"]];

for ( const r of result )
{
    let categories = categories_stmt.all(r.id);

    let meta = "";    
    for ( const category of categories )
    {    
        if ( meta != "" )
        {
            meta += ";";
        }
        meta += category.name;
    }
    let line = [r.french, r.type, r.abenaki, meta, r.source, r.alternative_source, r.infinitive];
    csv.push(line);
}

const output = stringify(csv);

fs.writeFileSync(CSV_FILE_PATH, output, err => {
  if (err) {
    console.error(err);
  } else {
    console.log("file written successfully");
  }
});

console.log(CSV_FILE_PATH + " written successfully");
