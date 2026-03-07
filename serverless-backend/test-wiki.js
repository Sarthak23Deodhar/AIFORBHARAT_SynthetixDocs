const fetch = require('node-fetch');

async function test() {
    try {
        console.log("Testing Wiki API...");
        const res = await fetch('https://ihm3s4vc87.execute-api.us-east-1.amazonaws.com/dev/api/generate-wiki', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code_snippet: 'int main() { return 0; }',
                language: 'mr',
                skill_level: 'senior'
            })
        });
        const json = await res.json();
        console.log("Status:", res.status);
        console.log("wiki_md:", JSON.stringify(json.wiki_md));
        console.log("mermaid_code:", JSON.stringify(json.mermaid_code));
        console.log("audio_text:", JSON.stringify(json.audio_text));
    } catch (err) {
        console.error("Error:", err);
    }
}
test();
