const cheerio = require("cheerio");
const axios = require("axios");
const sqlite3 = require("sqlite3").verbose();

// Initialize the database and create a table if it doesn't exist
function initDatabase(callback) {
    const db = new sqlite3.Database("data.sqlite");
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS certificates (
            company TEXT,
            certificate_number TEXT,
            valid_until TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        callback(db);
    });
}

// Insert a row into the database
function updateRow(db, company, certificateNumber, validUntil) {
    const statement = db.prepare("INSERT INTO certificates (company, certificate_number, valid_until) VALUES (?, ?, ?)");
    statement.run(company, certificateNumber, validUntil, (err) => {
        if (err) {
            console.error("Error inserting data:", err);
        }
        statement.finalize();
    });
}

// Read and log all rows from the database
function readRows(db) {
    db.each("SELECT rowid AS id, company, certificate_number, valid_until, timestamp FROM certificates ORDER BY timestamp DESC", (err, row) => {
        if (err) {
            console.error("Error reading data:", err);
        } else {
            console.log(`${row.id}: ${row.company}, ${row.certificate_number}, ${row.valid_until}, ${row.timestamp}`);
        }
    });
}

// Fetch a webpage and call the callback with the page body
async function fetchPage(url) {
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error("Error requesting page:", error.message);
        throw error;
    }
}

// Main function to run the scraper
async function run(db) {
    const url = "https://www.bsi.bund.de/DE/Themen/Unternehmen-und-Organisationen/Standards-und-Zertifizierung/Zertifizierung-und-Anerkennung/Zertifizierung-von-Managementsystemen/Zertifikatsnachweise-nach-Par-25-MsbG/zertifikatsnachweise-nach-par-25-msbg.html";
    try {
        const body = await fetchPage(url);
        const $ = cheerio.load(body);

        $("table tbody tr").each((index, element) => {
            const columns = $(element).find("td");
            const company = $(columns[0]).text().trim();
            const certificateNumber = $(columns[1]).text().trim();
            const validUntil = $(columns[2]).text().trim();

            if (company && certificateNumber && validUntil) {
                updateRow(db, company, certificateNumber, validUntil);
            }
        });

        readRows(db);
        db.close();
    } catch (error) {
        console.error("Error running scraper:", error.message);
    }
}

// Initialize the database and start the scraper
initDatabase(run);
