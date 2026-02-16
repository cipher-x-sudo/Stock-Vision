import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_DIR = path.join(__dirname, '../server/storage');
const BATCHES_DIR = path.join(STORAGE_DIR, 'batches');
const IMAGES_DIR = path.join(STORAGE_DIR, 'images');

// Ensure dirs exist
[BATCHES_DIR, IMAGES_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

async function runTest() {
    console.log("1. Creating dummy batch file...");
    const batchName = `batch-test-${Date.now()}.json`;
    fs.writeFileSync(path.join(BATCHES_DIR, batchName), JSON.stringify([{ scene: "test" }]));

    console.log("2. Fetching history from API...");
    try {
        const res = await fetch("http://localhost:3000/api/history/batches");
        const data = await res.json();
        const found = data.batches.find(b => b.filename === batchName);
        if (found) {
            console.log("✅ API listed the batch file.");
        } else {
            console.error("❌ API did NOT list the batch file.");
        }
    } catch (e) {
        console.error("❌ Failed to fetch history:", e.message);
    }

    console.log("3. Creating old file for cleanup test...");
    const oldFile = path.join(IMAGES_DIR, 'old-file.png');
    fs.writeFileSync(oldFile, "dummy content");

    // Set mtime to 8 days ago
    const eightDaysAgo = new Date();
    eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
    fs.utimesSync(oldFile, eightDaysAgo, eightDaysAgo);

    console.log(`   Created ${oldFile} with mtime ${eightDaysAgo.toISOString()}`);
    console.log("   Restart the server to verify cleanup!");
}

runTest();
