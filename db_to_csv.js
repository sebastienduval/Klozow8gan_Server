const path = require('path');
const { db_to_csv } = require('./db_tools');
const DB_PATH = path.join(__dirname, 'dictionary.db');
const CSV_FILE_PATH = process.argv[2]; 

if (!CSV_FILE_PATH) {
    console.error("Usage: node db_to_csv.js <path/to/your/data.csv>");
    process.exit(1);
}

db_to_csv(DB_PATH, CSV_FILE_PATH);

console.log(CSV_FILE_PATH + " written successfully");

