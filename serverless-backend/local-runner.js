require('dotenv').config();
const http = require('http');
const handlers = require('./handler');

const PORT = process.env.PORT || 8000;

// Helper to convert Node.js req to API Gateway Event
const createApiGatewayEvent = async (req) => {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            resolve({
                httpMethod: req.method,
                path: req.url,
                headers: req.headers,
                queryStringParameters: {}, // Simplified
                body: body || null
            });
        });
    });
};

const server = http.createServer(async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        });
        res.end();
        return;
    }

    try {
        const event = await createApiGatewayEvent(req);
        let lambdaResult;

        console.log(`[ROUTE] ${event.httpMethod} ${event.path}`);

        // Simple Router
        if (event.path === '/api/chat' && event.httpMethod === 'POST') {
            lambdaResult = await handlers.queryProcessor(event);
        } else if (event.path === '/api/audio' && event.httpMethod === 'POST') {
            lambdaResult = await handlers.audioGenerator(event);
        } else if (event.path === '/api/generate-wiki' && event.httpMethod === 'POST') {
            lambdaResult = await handlers.wikiBuilder(event);
        } else if (event.path === '/api/scan' && event.httpMethod === 'POST') {
            lambdaResult = await handlers.securityScanner(event);
        } else {
            lambdaResult = {
                statusCode: 404,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: "Not Found" })
            };
        }

        // Send Response
        res.writeHead(lambdaResult.statusCode, lambdaResult.headers);
        res.end(lambdaResult.body);

    } catch (error) {
        console.error("Local Runner Error:", error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "Internal Server Error" }));
    }
});

server.listen(PORT, () => {
    console.log(`Serverless Local Runner started on http://localhost:${PORT}`);
    console.log("Mocking API Gateway locally for Lambda handlers.");
    console.log("Available Endpoints:");
    console.log(" - POST /api/chat");
    console.log(" - POST /api/audio");
    console.log(" - POST /api/generate-wiki");
    console.log(" - GET  /api/scan");
});
