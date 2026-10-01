const fileInputName='E:/Abenaki/Programmes/Lexique/Dict.csv'
const fileOutputName = 'E:/Abenaki/Klozow8gan_Web/Dict.json';

const fs = require('node:fs');
const { csv_to_json } = require('./db_tools');

const INPUT_CSV_FILENAME = process.argv[2];
const OUTPUT_JSON_FILENAME = process.argv[3];

if (!INPUT_CSV_FILENAME || !OUTPUT_JSON_FILENAME) {
    console.error("Usage: node csv_to_json.js <path/to/your/data.csv> <path/to/your/data.json>");
    process.exit(1);
}

csv_to_json(INPUT_CSV_FILENAME, OUTPUT_JSON_FILENAME);

module.exports = { csv_to_json };