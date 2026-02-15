
import http from 'http';

const POST_DATA = JSON.stringify({
    eventName: "Test Event",
    brief: {
        bestSellers: ["red balloons", "party hats"],
        shotList: [
            { idea: "Standard shot", type: "Image", description: "A simple birthday setup" }
        ]
    }
});

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/generate-prompts',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(POST_DATA)
    }
};

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        if (res.statusCode !== 200) {
            console.error(`Status ${res.statusCode}`);
            console.error(data);
            process.exit(1);
        }
        try {
            const json = JSON.parse(data);
            const prompts = json.prompts;
            console.log(`Received ${prompts.length} prompts.`);

            const distinctScenes = new Set(prompts.map(p => p.scene.trim()));
            console.log(`Unique scenes: ${distinctScenes.size}`);

            if (distinctScenes.size === prompts.length) {
                console.log("SUCCESS: All prompts are unique.");
                process.exit(0);
            } else {
                console.error(`FAILURE: Only ${distinctScenes.size} unique scenes out of ${prompts.length}.`);
                process.exit(1);
            }
        } catch (e) {
            console.error("Error parsing JSON:", e);
            process.exit(1);
        }
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
    process.exit(1);
});

req.write(POST_DATA);
req.end();
