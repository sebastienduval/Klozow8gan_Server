const fs = require('node:fs');
const sqlite = require('node:sqlite');
const { stringify } = require('csv-stringify/sync');
const csvToJson = require('csv-file-to-json');

const Database = sqlite.Database || sqlite.DatabaseSync;

function db_to_csv(db_path, csv_file_path) {
  const db = new Database(db_path, {
    enableForeignKeyConstraints: true,
  });
  db.exec('PRAGMA foreign_keys = ON;');

  try {
    const stmt = db.prepare('SELECT * FROM words ORDER BY abenaki ASC;');
    const categories_stmt = db.prepare(
      'SELECT c.name FROM categories c JOIN word_categories wc ON c.id = wc.category_id WHERE wc.word_id = ?;'
    );

    const result = stmt.all();

    const csv = [['French', 'Type', 'Abenaki', 'Meta', 'Source', 'AlternativeSource', 'Infinitive']];

    for (const r of result) {
      const categories = categories_stmt.all(r.id);

      let meta = '';
      for (const category of categories) {
        if (meta !== '') {
          meta += ';';
        }
        meta += category.name;
      }

      const line = [
        r.french,
        r.type,
        r.abenaki,
        meta,
        r.source,
        r.alternative_source,
        r.infinitive,
      ];
      csv.push(line);
    }

    fs.writeFileSync(csv_file_path, stringify(csv));
  } finally {
    db.close();
  }
}

function csv_to_json(input, output) {
  const dataInJSON = csvToJson({ filePath: input, hasHeader: true });
  const jsonString = 'const dictionary = ' + JSON.stringify(dataInJSON);

  fs.writeFileSync(output, jsonString);
}

module.exports = { db_to_csv, csv_to_json };