
import http from 'http';

const POST_DATA = JSON.stringify({
    eventName: "Birthday Party",
    brief: {
        bestSellers: ["balloons", "cake", "candles"],
        shotList: [
            { idea: "Cake cutting", type: "Image", description: "Close up of cutting cake" }
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
        console.log("Received chunk:", chunk.length, "bytes");
        data += chunk;
    });
    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        try {
            const json = JSON.parse(data);
            if (json.prompts && json.prompts.length > 0) {
                console.log("Success! Prompts received.");
                console.log("First prompt scene:", json.prompts[0].scene.substring(0, 50) + "...");
            } else {
                console.log("No prompts or empty array.");
            }
        } catch (e) {
            console.log("Response not JSON:", data.slice(0, 100));
        }
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

req.write(POST_DATA);
req.end();
