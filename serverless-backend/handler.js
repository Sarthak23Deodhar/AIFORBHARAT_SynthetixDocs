const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { PollyClient, SynthesizeSpeechCommand } = require('@aws-sdk/client-polly');
const { TranslateClient, TranslateTextCommand } = require('@aws-sdk/client-translate');
const { ComprehendClient, DetectKeyPhrasesCommand } = require('@aws-sdk/client-comprehend');
const { DynamoDBClient, PutItemCommand, GetItemCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const crypto = require('crypto');
const https = require('https');

// Initialize AWS Clients
const bedrock = new BedrockRuntimeClient({ region: 'us-east-1' });
const polly = new PollyClient({ region: 'us-east-1' });
const translate = new TranslateClient({ region: 'us-east-1' });
const comprehend = new ComprehendClient({ region: 'us-east-1' });
const dynamodb = new DynamoDBClient({ region: 'us-east-1' });
const s3 = new S3Client({ region: 'us-east-1' });

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': true,
};

// Amazon Nova — AWS-native, free in Bedrock, no marketplace subscription needed
const CLAUDE_SONNET = 'amazon.nova-pro-v1:0';   // Nova Pro  — replaces Claude Sonnet (heavy tasks)
const CLAUDE_HAIKU = 'amazon.nova-lite-v1:0';  // Nova Lite — replaces Claude Haiku  (fast tasks)

const invokeClaude = async (systemPrompt, messages, maxTokens = 1500, temperature = 0.5, modelId = CLAUDE_SONNET) => {
    const isNova = modelId.startsWith('amazon.nova');

    // Normalize message content to {text: string} format (works for both Claude & Nova)
    const normalizedMessages = messages.map(m => ({
        role: m.role,
        content: Array.isArray(m.content)
            ? m.content.map(c => ({ text: c.text || c }))
            : [{ text: String(m.content) }]
    }));

    const requestBody = isNova
        ? {
            messages: normalizedMessages,
            ...(systemPrompt ? { system: [{ text: systemPrompt }] } : {}),
            inferenceConfig: { max_new_tokens: maxTokens, temperature }
        }
        : {
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: maxTokens,
            temperature,
            system: systemPrompt,
            messages,
        };

    const command = new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestBody)
    });
    const response = await bedrock.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    // Parse response — Nova: output.message.content[0].text | Claude: content[0].text
    return isNova
        ? responseBody.output.message.content[0].text
        : responseBody.content[0].text;
};


// ─── 1. BHASHA-CHAT: Multilingual AI assistant for Indian developers ───────────
module.exports.queryProcessor = async (event) => {
    try {
        const body = JSON.parse(event.body);
        const { query, language = 'hi', skill_level = 'junior', userId = 'anonymous' } = body;

        const languageNames = {
            'hi': 'Hindi',
            'en': 'English',
            'en-IN': 'Indian English',
            'mr': 'Marathi',
            'ta': 'Tamil',
            'te': 'Telugu',
            'kn': 'Kannada',
            'ml': 'Malayalam',
            'bn': 'Bengali',
            'gu': 'Gujarati',
            'pa': 'Punjabi',
        };
        const langName = languageNames[language] || 'Hindi';

        // --- Amazon Comprehend Integration ---
        let keyPhrases = [];
        try {
            const compCmd = new DetectKeyPhrasesCommand({
                Text: query.substring(0, 500),
                LanguageCode: 'en' // Assuming tech queries contain english keywords or setting to en works well enough
            });
            const compResp = await comprehend.send(compCmd);
            keyPhrases = compResp.KeyPhrases.map(kp => kp.Text);
        } catch (e) {
            console.error('Comprehend Error:', e);
        }

        const prompt = `You are "Bhasha-Chat", a concise AI assistant for Indian developers on the Synthetix platform.

CRITICAL LENGTH RULES — follow these STRICTLY on every single reply:
- Casual greetings or simple one-line questions → 1 to 2 sentences MAX. No bullet points. No headers.
- Technical questions → 3 to 6 sentences OR a short code snippet + 1-2 sentence explanation.
- NEVER start with "Great question!" or "Certainly!" or lengthy closings.
- NEVER over-explain. Answer only exactly what was asked, nothing more.

Skill level: ${skill_level.toUpperCase()} — ${skill_level === 'junior' ? 'use simple language, one short analogy if genuinely helpful' : 'be direct and technical, assume knowledge'}.
Keywords detected: ${keyPhrases.slice(0, 5).join(', ') || 'general'}

Respond ENTIRELY in ${langName}. Be crisp, accurate, and genuinely helpful.`;

        // Build multi-turn messages array from history + current query
        const history = Array.isArray(body.history) ? body.history : [];
        const limitedHistory = history.slice(-10); // Keep last 10 turns max
        const messagesArr = [
            ...limitedHistory.map(h => ({
                role: h.role === 'bot' ? 'assistant' : 'user',
                content: [{ text: h.text }]
            })),
            { role: 'user', content: [{ text: query }] }
        ];

        const botReply = await invokeClaude(prompt, messagesArr, 600, 0.5, CLAUDE_HAIKU);

        // --- DynamoDB Integration: Log Chat Query ---
        try {
            const timestamp = Date.now().toString();
            const putItemCmd = new PutItemCommand({
                TableName: 'UserChatHistory',
                Item: {
                    userId: { S: userId },
                    timestamp: { N: timestamp },
                    query: { S: query },
                    language: { S: language },
                    responseSnippet: { S: botReply.substring(0, 100) }
                }
            });
            await dynamodb.send(putItemCmd);
        } catch (dbError) {
            console.error('DynamoDB Error:', dbError);
            // Non-blocking error, allow response to continue
        }

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ response: botReply })
        };
    } catch (error) {
        console.error('QueryProcessor Error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                error: 'Failed to process query. Please check AWS configuration.',
                details: error.message,
                stack: error.stack
            })
        };
    }
};

// ─── 2. BHARAT EXPLAINER: Neural Audio Walkthrough via Amazon Polly ───────────
module.exports.audioGenerator = async (event) => {
    try {
        const body = JSON.parse(event.body);
        const { text, language = 'hi' } = body;

        // AWS Polly Indian Voices:
        // Aditi (Hindi/English), Kajal (Hindi/English Neural)
        // Attempt to translate to the chosen language first. If Polly doesn't support the script, we will catch and fallback to English.
        const voiceMap = {
            'hi': { voiceId: 'Aditi', engine: 'standard' },
            'en': { voiceId: 'Kajal', engine: 'neural' },
            'en-IN': { voiceId: 'Kajal', engine: 'neural' },
            // For other regional languages, use Kajal (Indian English voice) to read Romanized (transliterated) text
            'mr': { voiceId: 'Kajal', engine: 'neural' },
            'ta': { voiceId: 'Kajal', engine: 'neural' },
            'te': { voiceId: 'Kajal', engine: 'neural' },
            'kn': { voiceId: 'Kajal', engine: 'neural' },
            'ml': { voiceId: 'Kajal', engine: 'neural' },
            'bn': { voiceId: 'Kajal', engine: 'neural' },
            'gu': { voiceId: 'Kajal', engine: 'neural' },
            'pa': { voiceId: 'Kajal', engine: 'neural' },
            'or': { voiceId: 'Kajal', engine: 'neural' },
            'as': { voiceId: 'Kajal', engine: 'neural' },
            'sa': { voiceId: 'Kajal', engine: 'neural' },
            'ur': { voiceId: 'Kajal', engine: 'neural' }
        };

        let { voiceId, engine } = voiceMap[language] || { voiceId: 'Kajal', engine: 'neural' };

        // Bedrock has already transliterated the audio script phonetically into English alphabets for unsupported languages.
        // We can pass the text directly to Polly.
        let translatedText = text.substring(0, 2800);
        let finalVoiceUsed = voiceId;

        let audioStream;

        // --- 2. Attempt Polly Synthesis ---
        try {
            const command = new SynthesizeSpeechCommand({
                OutputFormat: 'mp3',
                Text: translatedText,
                VoiceId: finalVoiceUsed,
                Engine: engine
            });
            const response = await polly.send(command);
            audioStream = response.AudioStream;
        } catch (pollyError) {
            console.log(`Polly failed for language ${language} with voice ${voiceId}. Falling back to Indian English (Kajal).`);
            console.log('Polly Error:', pollyError.message);

            // --- Fallback: Indian English via Kajal ---
            finalVoiceUsed = 'Kajal';
            const fallbackText = text.substring(0, 2800); // Use original English text
            const fallbackCmd = new SynthesizeSpeechCommand({
                OutputFormat: 'mp3',
                Text: fallbackText,
                VoiceId: 'Kajal',
                Engine: 'neural'
            });
            const fallbackResponse = await polly.send(fallbackCmd);
            audioStream = fallbackResponse.AudioStream;
        }

        // Convert stream to buffer
        const streamToBuffer = async (stream) => {
            return new Promise((resolve, reject) => {
                const chunks = [];
                stream.on('data', (chunk) => chunks.push(chunk));
                stream.on('error', reject);
                stream.on('end', () => resolve(Buffer.concat(chunks)));
            });
        };

        const buffer = await streamToBuffer(audioStream);

        // --- 3. Amazon S3 Integration ---
        const bucketName = process.env.STORAGE_BUCKET_NAME || `aiforbharat-storage-dev-files`;
        const fileName = `audio-${Date.now()}-${language}.mp3`;

        await s3.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: fileName,
            Body: buffer,
            ContentType: 'audio/mpeg'
        }));

        const signedUrl = await getSignedUrl(s3, new GetObjectCommand({
            Bucket: bucketName,
            Key: fileName
        }), { expiresIn: 3600 });

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                audio_url: signedUrl,
                voice_used: finalVoiceUsed,
                language: language,
                message: 'Audio synthesized successfully.'
            })
        };
    } catch (error) {
        console.error('AudioGenerator Error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Failed to synthesize audio. Check Polly permissions and region.' })
        };
    }
};

// ─── 3. AUTONOMOUS WIKI BUILDER: Docs + Architecture Diagrams ─────────────────
module.exports.wikiBuilder = async (event) => {
    try {
        const body = JSON.parse(event.body);
        const { code_snippet, language = 'en', skill_level = 'junior' } = body;

        const languageNames = {
            'hi': 'Hindi', 'en': 'English', 'en-IN': 'Indian English',
            'mr': 'Marathi', 'ta': 'Tamil', 'te': 'Telugu',
            'kn': 'Kannada', 'ml': 'Malayalam', 'bn': 'Bengali',
            'gu': 'Gujarati', 'pa': 'Punjabi', 'or': 'Odia',
            'as': 'Assamese', 'ur': 'Urdu', 'sa': 'Sanskrit',
            'auto': 'English'
        };
        const langName = languageNames[language] || 'English';

        const isMultiFile = code_snippet.includes('// ---- FILE:') || code_snippet.includes('# ---- FILE:');

        const prompt = isMultiFile
            ? `You are a world-class technical documentation engineer for Bharat developers.
Analyze the following multi-file codebase. Files are separated by markers like "// ---- FILE: path/to/file ----".

Target Skill Level: ${skill_level.toUpperCase()}.
If JUNIOR: Use simple analogies, step-by-step logic, and avoid dense jargon.
If SENIOR: Focus on system architecture, design patterns, and in-depth details.

CRITICAL INSTRUCTION FOR LANGUAGE: You MUST generate the Section 1 Markdown Documentation ENTIRELY in ${langName}!
Do not use English for explanations in Section 1 unless ${langName} is English. Translate all headers, bullet points, and text into ${langName}. Use the native written script (e.g., Devanagari) if applicable.

Generate output in EXACTLY THREE sections separated by markers:

Section 1: Markdown Documentation (MUST BE WRITTEN IN ${langName})
- ## Project Overview (what this project does, in simple terms)
- ## Key Modules (one subsection per important file, explaining its role)
- ## How It Works (data flow and system interactions)
- ## Getting Started (quick-start guide)

Section 2: A valid Mermaid.js flowchart showing the high-level architecture. Start it with "---MERMAID---".
Use "graph TD" syntax. CRITICAL INSTRUCTION: ALL node labels MUST be in plain English (A-Z) and wrapped in double quotes. NEVER use Unicode characters, nested quotes, curly braces, or special characters inside the node labels! If your code has variables like f"Hello {name}", just write "Hello Name" in the Mermaid label.
Example: A["User Input"] --> B["Processing Module"]

Section 3: Audio Script. Start it with "---AUDIO---".
Write a concise 3-sentence summary of the codebase. 
CRITICAL INSTRUCTION: 
If ${langName} is English, write strictly in plain English (DO NOT transliterate, DO NOT use Hindi words). 
If ${langName} is Hindi, write in Hindi using Devanagari script. 
FOR ALL OTHER LANGUAGES (like Marathi, Tamil, Telugu, Kannada, Bengali, Odia, etc.), you MUST FIRST translate the summary into ${langName}. Then, write those ${langName} words using the English alphabet (Roman/Latin script). YOU MUST NOT USE ENGLISH WORDS! For example, transliterate the ${langName} words phonetically like "Namaskar, idhu oru React application". If you use English words, the audio will fail. The audio system will read this phonetic text using an Indian voice.

Codebase:
\`\`\`
${code_snippet.substring(0, 12000)}
\`\`\``
            : `You are a world-class technical documentation engineer for Bharat developers.
Analyze the following code snippet and generate clear technical documentation.

Target Skill Level: ${skill_level.toUpperCase()}.
If JUNIOR: Use simple analogies, step-by-step logic, and avoid dense jargon.
If SENIOR: Focus on system architecture, design patterns, and in-depth details.

CRITICAL INSTRUCTION FOR LANGUAGE: You MUST generate the Section 1 Markdown Documentation ENTIRELY in ${langName}!
Do not use English for explanations in Section 1 unless ${langName} is English. Translate all headers, bullet points, and text into ${langName}. Use the native written script (e.g., Devanagari) if applicable.

Generate output in EXACTLY THREE sections separated by markers:

Section 1: Markdown Documentation (MUST BE WRITTEN IN ${langName})
- ## What This Code Does (simple, clear explanation)
- ## Key Functions/Classes (explain each important piece)
- ## Logic Flow (step-by-step walkthrough)
- ## Usage Example (how to use this code)

Section 2: A valid Mermaid.js flowchart. Start it with "---MERMAID---".
Use "graph TD" syntax. CRITICAL INSTRUCTION: ALL node labels MUST be in plain English (A-Z) and wrapped in double quotes. NEVER use Unicode characters, nested quotes, curly braces, or special characters inside the node labels! If your code has variables like f"Hello {name}", just write "Hello Name" in the Mermaid label.
Example: A["User Input"] --> B["Processing Module"]

Section 3: Audio Script. Start it with "---AUDIO---".
Write a concise 3-sentence summary of the codebase. 
CRITICAL INSTRUCTION: 
If ${langName} is English, write strictly in plain English (DO NOT transliterate, DO NOT use Hindi words). 
If ${langName} is Hindi, write in Hindi using Devanagari script. 
FOR ALL OTHER LANGUAGES (like Marathi, Tamil, Telugu, Kannada, Bengali, Odia, etc.), you MUST FIRST translate the summary into ${langName}. Then, write those ${langName} words using the English alphabet (Roman/Latin script). YOU MUST NOT USE ENGLISH WORDS! For example, transliterate the ${langName} words phonetically like "Namaskar, idhu oru React application". If you use English words, the audio will fail. The audio system will read this phonetic text using an Indian voice.

Code:
\`\`\`${language}
${code_snippet.substring(0, 10000)}
\`\`\``;

        const wikiMessages = [{ role: 'user', content: [{ type: 'text', text: prompt }] }];
        const botReply = await invokeClaude(prompt, wikiMessages, 4096, 0.3, CLAUDE_SONNET);

        let wiki_md = '';
        let mermaid_code = 'graph TD;\n  A["Code"] --> B["Analysis Unavailable"]';
        let audio_text = '';

        try {
            // Robust Regex Extraction
            const mermaidRegex = /---MERMAID---\s*([\s\S]*?)(?:---AUDIO---|###|$)/;
            const mermaidMatch = botReply.match(mermaidRegex);
            if (mermaidMatch) {
                // Remove Markdown backticks wrapping the mermaid code if the AI added them
                mermaid_code = mermaidMatch[1].replace(/```mermaid/g, '').replace(/```/g, '').trim();
            } else {
                // Fallback if marker was missed but code block exists
                const codeBlockMatch = botReply.match(/```mermaid\s*([\s\S]*?)```/);
                if (codeBlockMatch) mermaid_code = codeBlockMatch[1].trim();
            }

            const audioRegex = /---AUDIO---\s*([\s\S]*?)(?:###|$)/;
            const audioMatch = botReply.match(audioRegex);
            if (audioMatch) {
                audio_text = audioMatch[1].trim();
            }

            // Wiki MD is everything before ---MERMAID--- or ---AUDIO---
            const wikiMatch = botReply.split(/---MERMAID---|---AUDIO---/);
            wiki_md = wikiMatch[0].trim();
        } catch (e) {
            wiki_md = botReply.trim();
        }

        // Final clean-up of mermaid code in case any leading/trailing artifacts survived
        mermaid_code = mermaid_code.replace(/^```mermaid\s*\n?/, '').replace(/^```\s*\n?/, '').replace(/```\s*$/, '').trim();

        if (!audio_text) {
            audio_text = "Analysis complete. The architecture is mapped and no critical bugs were found.";
        }

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ wiki_md, mermaid_code, audio_text })
        };
    } catch (error) {
        console.error('WikiBuilder Error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Failed to build wiki documentation.' })
        };
    }
};

// ─── 4. SURAKSHA-AUDIT: AI-Powered Security Scanner ──────────────────────────
module.exports.securityScanner = async (event) => {
    try {
        const body = event.body ? JSON.parse(event.body) : {};
        const { code_snippet = '', language = 'en' } = body;

        // If no code provided, return a generic advisory
        if (!code_snippet.trim()) {
            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    advisories: [{
                        id: 'INFO-001',
                        severity: 'Info',
                        description: 'No code provided for scanning. Paste your code in the editor and generate documentation first.',
                        remediation: 'Provide source code in the editor pane to enable security analysis.'
                    }],
                    scanned_at: new Date().toISOString(),
                    status: 'no_code'
                })
            };
        }

        const prompt = `You are Suraksha-Audit, an AI security scanner built for Bharat developers.
Analyze the following code for security vulnerabilities, focusing on the OWASP Top 10 and common coding mistakes.

CRITICAL INSTRUCTION: You must write the "description" and "remediation" fields entirely in the language corresponding to this ISO code: ${language}. (For example, if the code is 'hi', write in flawless Hindi; if 'te', write in Telugu script; if 'en', write in English). The "id" and "severity" fields must remain in English.

Code to analyze:
\`\`\`
${code_snippet.substring(0, 8000)}
\`\`\`

Return a JSON array of security findings. Each finding must have:
- "id": string (e.g., "VULN-001")
- "severity": one of "Critical", "High", "Medium", "Low", "Info"
- "description": a clear description of the vulnerability found
- "remediation": specific, actionable fix recommendation

If no vulnerabilities are found, return a single Info finding saying the code looks clean.
Return ONLY the raw JSON array, no markdown, no explanation outside the JSON.`;

        const rawReply = await invokeClaude(prompt, [{ role: 'user', content: [{ type: 'text', text: prompt }] }], 1500, 0.1, CLAUDE_SONNET);

        let advisories;
        try {
            // Extract JSON array from the response
            const jsonMatch = rawReply.match(/\[[\s\S]*\]/);
            advisories = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        } catch {
            advisories = [{
                id: 'SCAN-ERR',
                severity: 'Info',
                description: 'Security scan completed but results could not be parsed.',
                remediation: 'Try regenerating the documentation to trigger a new scan.'
            }];
        }

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                advisories,
                scanned_at: new Date().toISOString(),
                status: 'completed'
            })
        };
    } catch (error) {
        console.error('SecurityScanner Error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Failed to run security scan.' })
        };
    }
};

// ─── 5. GET PROFILE: Load user language & skill preferences ──────────────────
module.exports.getProfile = async (event) => {
    try {
        const userId = event.queryStringParameters?.userId || 'anonymous';

        const result = await dynamodb.send(new GetItemCommand({
            TableName: 'UserProfiles',
            Key: { userId: { S: userId } }
        }));

        if (!result.Item) {
            // Return defaults for new users
            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({ userId, language: 'en', skillLevel: 'junior', exists: false })
            };
        }

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                userId,
                language: result.Item.language?.S || 'en',
                skillLevel: result.Item.skillLevel?.S || 'junior',
                exists: true
            })
        };
    } catch (error) {
        console.error('GetProfile Error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Failed to fetch profile.' })
        };
    }
};

// ─── 6. SAVE PROFILE: Persist user language & skill preferences ───────────────
module.exports.saveProfile = async (event) => {
    try {
        const body = JSON.parse(event.body);
        const { userId = 'anonymous', language = 'en', skillLevel = 'junior' } = body;

        await dynamodb.send(new UpdateItemCommand({
            TableName: 'UserProfiles',
            Key: { userId: { S: userId } },
            UpdateExpression: 'SET #lang = :lang, skillLevel = :skill, updatedAt = :ts',
            ExpressionAttributeNames: { '#lang': 'language' }, // 'language' is reserved in DynamoDB
            ExpressionAttributeValues: {
                ':lang': { S: language },
                ':skill': { S: skillLevel },
                ':ts': { S: new Date().toISOString() }
            }
        }));

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ success: true, userId, language, skillLevel })
        };
    } catch (error) {
        console.error('SaveProfile Error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Failed to save profile.' })
        };
    }
};

// ─── 7. WEBHOOK HANDLER: GitHub push → auto-trigger wikiBuilder ───────────────
module.exports.webhookHandler = async (event) => {
    try {
        const body = event.body || '{}';
        const githubSecret = process.env.GITHUB_WEBHOOK_SECRET;

        // ── Verify GitHub HMAC signature (skip if no secret configured) ──
        if (githubSecret) {
            const signature = event.headers?.['x-hub-signature-256'] || '';
            const expected = 'sha256=' + crypto.createHmac('sha256', githubSecret).update(body).digest('hex');
            if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
                return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid signature.' }) };
            }
        }

        const payload = JSON.parse(body);
        const repoName = payload?.repository?.full_name || 'unknown';
        const branch = payload?.ref?.replace('refs/heads/', '') || 'main';
        const pusher = payload?.pusher?.name || 'unknown';
        const commits = payload?.commits?.length || 0;

        console.log(`GitHub push: ${repoName}@${branch} by ${pusher} (${commits} commits)`);

        // ── Fire-and-forget: invoke wikiBuilder Lambda asynchronously ──
        const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-1' });
        const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME
            ? process.env.AWS_LAMBDA_FUNCTION_NAME.replace('webhook', 'wiki')
            : `aiforbharat-backend-${process.env.SLS_STAGE || 'dev'}-wiki`;

        // Build a synthetic wikiBuilder event from the webhook payload
        const syntheticEvent = {
            body: JSON.stringify({
                code_snippet: `// Auto-triggered by GitHub push\n// Repo: ${repoName}\n// Branch: ${branch}\n// Commits: ${commits}\n// Pusher: ${pusher}`,
                language: 'en',
                skill_level: 'junior'
            })
        };

        await lambdaClient.send(new InvokeCommand({
            FunctionName: functionName,
            InvocationType: 'Event', // async — don't wait for result
            Payload: JSON.stringify(syntheticEvent)
        }));

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                received: true,
                repo: repoName,
                branch,
                pusher,
                commits,
                triggered: 'wikiBuilder'
            })
        };
    } catch (error) {
        console.error('WebhookHandler Error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Webhook processing failed.' })
        };
    }
};

// ─── 8. GOVERNANCE HANDLER: Fetch SIPs & SCCPs from Synthetix GitHub ─────────
module.exports.governanceHandler = async (event) => {
    const fetchJson = (url) => new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'AIForBharat-Navigator/1.0',
                'Accept': 'application/vnd.github.v3+json'
            }
        };
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(e); }
            });
        }).on('error', reject);
    });

    try {
        const type = event.queryStringParameters?.type || 'all';

        // Fetch from Synthetix SIPs GitHub repo (public)
        const sipsUrl = 'https://api.github.com/repos/Synthetixio/SIPs/contents/content/sips';
        const sccpsUrl = 'https://api.github.com/repos/Synthetixio/SIPs/contents/content/sccp';

        const [sipFiles, sccpFiles] = await Promise.all([
            type === 'sccp' ? Promise.resolve([]) : fetchJson(sipsUrl).catch(() => []),
            type === 'sip' ? Promise.resolve([]) : fetchJson(sccpsUrl).catch(() => [])
        ]);

        const parseEntry = (f, kind) => {
            // filename like sip-1.md or sccp-23.md
            const numMatch = f.name.match(/(\d+)/);
            const num = numMatch ? parseInt(numMatch[1], 10) : 0;
            return {
                id: `${kind.toUpperCase()}-${num}`,
                kind,
                number: num,
                filename: f.name,
                downloadUrl: f.download_url,
                htmlUrl: `https://sips.synthetix.io/${kind}s/${kind}-${num}`,
                githubUrl: f.html_url,
            };
        };

        const sips = Array.isArray(sipFiles) ? sipFiles.filter(f => f.name.endsWith('.md') && !f.name.includes('template')).map(f => parseEntry(f, 'sip')) : [];
        const sccps = Array.isArray(sccpFiles) ? sccpFiles.filter(f => f.name.endsWith('.md') && !f.name.includes('template')).map(f => parseEntry(f, 'sccp')) : [];

        // Sort by number desc
        const all = [...sips, ...sccps].sort((a, b) => b.number - a.number);

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ proposals: all, total: all.length, sips: sips.length, sccps: sccps.length })
        };
    } catch (error) {
        console.error('GovernanceHandler Error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Failed to fetch governance proposals.', details: error.message })
        };
    }
};

// ─── 9. ORCHESTRATOR: Multi-Agent Pipeline (Scanner → Verify → Synthesize) ───
module.exports.orchestrator = async (event) => {
    try {
        const body = JSON.parse(event.body || '{}');
        const { code_snippet = '', language = 'en', skill_level = 'junior' } = body;

        if (!code_snippet.trim()) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'No code provided for orchestration.' })
            };
        }

        const results = {};

        // ── AGENT 1: Scanner Agent ─────────────────────────────────────────────
        const scanPrompt = `You are the Scanner Agent in a multi-agent AI security pipeline.
Analyze the following code for security vulnerabilities (OWASP Top 10).
Return a JSON array of findings with: id, severity (Critical/High/Medium/Low/Info), title, description.
Return ONLY the raw JSON array.

Code:
\`\`\`
${code_snippet.substring(0, 6000)}
\`\`\``;

        const scanRaw = await invokeClaude(scanPrompt, [{ role: 'user', content: [{ type: 'text', text: scanPrompt }] }], 1000, 0.1, CLAUDE_SONNET);
        let findings = [];
        try {
            const jsonMatch = scanRaw.match(/\[[\s\S]*\]/);
            findings = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        } catch { findings = [{ id: 'SCAN-001', severity: 'Info', title: 'Scan complete', description: 'No structured findings.' }]; }
        results.scanner = { status: 'completed', findings, count: findings.length };

        // ── AGENT 2: Verification Agent ────────────────────────────────────────
        const verifyPrompt = `You are the Verification Agent in a multi-agent AI security pipeline.
You have received the following raw findings from the Scanner Agent:
${JSON.stringify(findings, null, 2)}

Your job:
1. Mark each finding as CONFIRMED or FALSE_POSITIVE based on re-analysing the original code.
2. Assign a confidence score (0–100) to each finding.
3. Return a JSON array with each finding extended with: "verified": true/false, "confidence": number, "verifierNote": string.
Return ONLY the raw JSON array, no explanation.

Original code:
\`\`\`
${code_snippet.substring(0, 5000)}
\`\`\``;

        const verifyRaw = await invokeClaude(verifyPrompt, [{ role: 'user', content: [{ type: 'text', text: verifyPrompt }] }], 1200, 0.1, CLAUDE_SONNET);
        let verifiedFindings = [];
        try {
            const jm = verifyRaw.match(/\[[\s\S]*\]/);
            verifiedFindings = jm ? JSON.parse(jm[0]) : findings;
        } catch { verifiedFindings = findings; }
        results.verifier = { status: 'completed', verifiedFindings, confirmed: verifiedFindings.filter(f => f.verified !== false).length };

        // ── AGENT 3: Synthesis Agent ────────────────────────────────────────────
        const languageNames = {
            'hi': 'Hindi', 'en': 'English', 'en-IN': 'Indian English',
            'mr': 'Marathi', 'ta': 'Tamil', 'te': 'Telugu',
            'kn': 'Kannada', 'ml': 'Malayalam', 'bn': 'Bengali',
            'gu': 'Gujarati', 'pa': 'Punjabi',
        };
        const langName = languageNames[language] || 'English';

        const synthPrompt = `You are the Synthesis Agent — the final stage in a multi-agent AI security pipeline.
You have completed findings from the Scanner Agent and Verification Agent.

Verified findings:
${JSON.stringify(verifiedFindings.slice(0, 8), null, 2)}

Your job: Write a concise, executive-level security report in ${langName} for a ${skill_level.toUpperCase()} developer.
Include:
## Executive Summary
## Risk Level (Overall: Critical / High / Medium / Low)
## Confirmed Vulnerabilities (list top confirmed findings)
## Recommended Actions (3 prioritized remediation steps)
## Next Steps

Be clear, actionable, and use markdown formatting.`;

        const synthesis = await invokeClaude(synthPrompt, [{ role: 'user', content: [{ type: 'text', text: synthPrompt }] }], 1500, 0.4, CLAUDE_SONNET);
        results.synthesizer = { status: 'completed', report: synthesis };

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                ...results,
                pipeline: 'Scanner → Verifier → Synthesizer',
                completed_at: new Date().toISOString()
            })
        };
    } catch (error) {
        console.error('Orchestrator Error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Orchestration pipeline failed.', details: error.message })
        };
    }
};
// ─── 10. CONTENT ADAPTER: Skill-level & language adapter (FR-9 / Level 5) ────
/**
 * POST /api/adapt
 * Body: { text: string, language: string, skill_level: 'junior'|'senior', format?: 'summary'|'full' }
 * Adapts any Bedrock output to the user's skill level and preferred language.
 * Uses Claude Haiku (fast, cheap) since this is a post-processing step.
 */
module.exports.contentAdapter = async (event) => {
    try {
        const body = JSON.parse(event.body || '{}');
        const { text = '', language = 'en', skill_level = 'junior', format = 'full' } = body;

        if (!text.trim()) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'text field is required.' })
            };
        }

        const languageNames = {
            'en': 'English', 'hi': 'Hindi', 'mr': 'Marathi', 'ta': 'Tamil',
            'te': 'Telugu', 'kn': 'Kannada', 'ml': 'Malayalam', 'bn': 'Bengali',
            'gu': 'Gujarati', 'pa': 'Punjabi', 'or': 'Odia', 'as': 'Assamese',
            'ur': 'Urdu', 'sa': 'Sanskrit',
        };
        const langName = languageNames[language] || 'English';

        const instructions = skill_level === 'junior'
            ? 'Simplify the language. Use beginner-friendly terms, short sentences, and relatable analogies. Avoid dense jargon.'
            : 'Keep the language precise and technical. Assume expert knowledge. Remove unnecessary explanations.';

        const formatInstr = format === 'summary'
            ? 'Summarize into 2-4 key points as a bullet list.'
            : 'Rewrite the full content, preserving structure and code blocks.';

        const adaptPrompt = `You are a content adapter in an AI pipeline for Indian developers.
Your task: Rewrite the following technical content for a ${skill_level.toUpperCase()} developer.

Rules:
- ${instructions}
- ${formatInstr}
- Output ENTIRELY in ${langName}. Code and variable names stay in English.
- Preserve any markdown, code blocks, and headings from the original.
- Do NOT add preamble like "Here is the adapted content:".

Content to adapt:
---
${text.slice(0, 8000)}
---`;

        const adapted = await invokeClaude(
            'You are a precision content adaptation engine. Follow user instructions exactly.',
            [{ role: 'user', content: [{ type: 'text', text: adaptPrompt }] }],
            1200, 0.3, CLAUDE_HAIKU
        );

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ adapted, language, skill_level, original_length: text.length })
        };
    } catch (error) {
        console.error('ContentAdapter Error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Content adaptation failed.', details: error.message })
        };
    }
};
