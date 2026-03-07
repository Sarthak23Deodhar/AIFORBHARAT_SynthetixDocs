const fetch = require('node-fetch');

async function test() {
    try {
        console.log("Testing API...");
        const res = await fetch('https://ihm3s4vc87.execute-api.us-east-1.amazonaws.com/dev/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: 'Hello testing API', language: 'en' })
        });
        const text = await res.text();
        console.log("Status:", res.status);
        console.log("Response:", text);
    } catch (err) {
        console.error("Error:", err);
    }
}
test();
