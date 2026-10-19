const fs = require('fs');
const path = require('path');

/**
 * Reads a single JSON file and parses its content.
 * @param {string} filePath - The full path to the JSON file.
 * @returns {object} The parsed JSON content.
 * @throws {Error} If the file cannot be read or parsed.
 */
function loadJsonFile(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        throw new Error(`Failed to read or parse JSON file ${path.basename(filePath)}: ${e.message}`);
    }
}


/**
 * Scans a directory for JSON files, loads their metadata, and regenerates the user_quiz_index.html file.
 *
 * @param {string} jsonDirectoryPath - The path to the folder containing the JSON files.
 * @param {string} outputFilePath - The path where the regenerated HTML file should be saved.
 * @param {string} inputHtmlPath - The path to the original template HTML file.
 */
function generateQuizIndex(jsonDirectoryPath, outputFilePath, inputHtmlPath) {
    console.log(`🔍 Starting regeneration process...`);
    console.log(`   - Scanning directory: ${jsonDirectoryPath}`);

    if (!fs.existsSync(jsonDirectoryPath)) {
        console.error(`🚨 Error: Directory not found at ${jsonDirectoryPath}`);
        return;
    }
    if (!fs.existsSync(inputHtmlPath)) {
        console.error(`🚨 Error: Input HTML template not found at ${inputHtmlPath}`);
        return;
    }

    try {
        // 1. Read all files in the directory
        const files = fs.readdirSync(jsonDirectoryPath);

        // 2. Filter for JSON files
        const jsonFiles = files.filter(file => path.extname(file).toLowerCase() === '.json');
        console.log(`✅ Found ${jsonFiles.length} JSON files.`);

        // Array to store the HTML list items
        const listItems = [];

        // 3. Process each JSON file
        for (const filename of jsonFiles) {
            const fullPath = path.join(jsonDirectoryPath, filename);
            
            try {
                // Load and parse the JSON data
                const data = loadJsonFile(fullPath);

                // Extract title and author
                const title = data.title || 'Untitled Quiz';
                const author = data.author || 'Unknown Author';
                
                // Generate the descriptive link text (e.g., "Nadodemow8ganal (Sébastien Duval)")
                const linkText = `${title} - by ${author}`;
                
                // Construct the HTML list item
                const listHtml = `  <li class="quiz-item">
    <a href="quiz.html/?quiz_json=${filename}">${linkText}</a>
  </li>`;
                
                listItems.push(listHtml);

            } catch (error) {
                console.warn(`⚠️ Skipping file ${filename} due to error: ${error.message}`);
            }
        }

        // Join all generated list items
        const listItemsHtml = listItems.join('\n');

        // 4. Read the original HTML content
        const originalHtml = fs.readFileSync(inputHtmlPath, 'utf8');
        
        // 5. Use regex to find and replace the content inside the <ol> tag
        // This safely targets everything between the start and end <ol> tags.
        const regex = /(<ol>)([\s\S]*?)(<\/ol>)/;
        
        // The replacement maintains the original <ol> and </ol> tags but inserts the new content
        const replacement = `$1\n${listItemsHtml}\n$3`;
        
        const finalHtml = originalHtml.replace(regex, replacement);
        
        // 6. Write the new content to the output file
        fs.writeFileSync(outputFilePath, finalHtml, 'utf8');
        
        console.log(`\n✨ Success! The file has been regenerated and saved to ${outputFilePath}`);

    } catch (error) {
        console.error(`\n❌ A critical error occurred during file processing:`, error.message);
    }
}

// --- Execution Block ---

// Define paths
const JSON_DIR = '../Klozow8gan_Web/quiz/'; 
const OUTPUT_FILE = '../Klozow8gan_Web/quiz/user_quiz_index.html'; 
const INPUT_FILE = '../Klozow8gan_Web/quiz/user_quiz_index.html.template';

// Run the generator
// generateQuizIndex(JSON_DIR, OUTPUT_FILE, INPUT_FILE);

module.exports = { generateQuizIndex };