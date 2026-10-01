const fs = require('node:fs');
const Database = require('better-sqlite3');
const {stringify} = require('csv-stringify/sync');
const csvToJson = require("csv-file-to-json");

function db_to_csv(db_path, csv_file_path)
{
  const db = new Database(db_path);
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

    fs.writeFileSync(csv_file_path, stringify(csv), err => {
    if (err) {
      console.error(err);
    } else {
      console.log("file written successfully");
    }
  });
}

function csv_to_json(input, output)
{
  const dataInJSON = csvToJson({ filePath: input, hasHeader:true});
  const jsonString = "const dictionary = " + JSON.stringify(dataInJSON);

  fs.writeFileSync(output, jsonString, err => {
    if (err) {
      console.error(err);
    } else {
      // file written successfully
    }
  });
}

module.exports = { db_to_csv, csv_to_json };