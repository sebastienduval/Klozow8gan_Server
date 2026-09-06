const fileInputName='E:/Abenaki/Programmes/Lexique/Dict.csv'
const fileOutputName = 'E:/Abenaki/Klozow8gan_Web/Dict.json';

const fs = require('node:fs');
const csvToJson = require("csv-file-to-json");
const dataInJSON = csvToJson({ filePath: fileInputName, hasHeader:true});


const jsonString = "const dictionary = " + JSON.stringify(dataInJSON);

fs.writeFileSync(fileOutputName, jsonString, err => {
  if (err) {
    console.error(err);
  } else {
    // file written successfully
  }
});
