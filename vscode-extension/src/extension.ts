import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';

// ─── Constants ───────────────────────────────────────────────────────────────

// Deployed Lambda endpoint — works without running local-runner.js
const BACKEND_URL = 'https://ihm3s4vc87.execute-api.us-east-1.amazonaws.com/dev';

/** Source file extensions to include in the scan */
const SUPPORTED_EXTENSIONS = new Set([
    '.js', '.ts', '.jsx', '.tsx',
    '.py', '.sol', '.go', '.rs',
    '.java', '.cs', '.cpp', '.c', '.h',
    '.rb', '.php', '.swift', '.kt'
]);

/** Folders/files to always skip */
const EXCLUDED_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', 'out',
    '.vscode', '.next', '__pycache__', 'venv', '.env',
    'coverage', '.cache', 'target'
]);

// ─── Entry Point ─────────────────────────────────────────────────────────────

// Module-level panel ref so auto-update can reuse it
let activeDocPanel: vscode.WebviewPanel | undefined;
let autoUpdateTimer: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
    // ── Status bar: shows auto-docs state ──
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.text = '$(sync~spin) Auto-Docs: OFF';
    statusBar.tooltip = 'Synthetix Auto-Documentation';
    statusBar.show();

    // ── Register the existing doc generator command ──
    const disposable = vscode.commands.registerCommand(
        'synthetixDocsMaker.generate',
        async (uri: vscode.Uri) => {
            const targetUri = uri ?? vscode.workspace.workspaceFolders?.[0]?.uri;
            if (!targetUri) {
                vscode.window.showErrorMessage('Please open a folder or workspace before generating docs.');
                return;
            }
            await generateDocumentation(targetUri, context);
        }
    );

    // ── Register the Bhasha-Chat sidebar view ──
    const chatProvider = new BhashaChatViewProvider(context.extensionUri);
    const chatView = vscode.window.registerWebviewViewProvider(
        'synthetixDocsMaker.bhashaChat',
        chatProvider,
        { webviewOptions: { retainContextWhenHidden: true } }
    );

    // ── Register clear chat command ──
    const clearChat = vscode.commands.registerCommand('synthetixDocsMaker.clearChat', () => {
        chatProvider.clearHistory();
    });

    // ── FR-8: Inline Hover Provider (symbol explanation) ──
    const HOVER_LANGS = ['javascript', 'typescript', 'python', 'rust', 'go', 'java', 'solidity', 'cpp', 'c'];
    const hoverProvider = vscode.languages.registerHoverProvider(HOVER_LANGS, {
        async provideHover(document, position) {
            const wordRange = document.getWordRangeAtPosition(position);
            if (!wordRange) return undefined;
            const word = document.getText(wordRange);
            if (word.length < 2) return undefined;

            const startLine = Math.max(0, position.line - 3);
            const endLine = Math.min(document.lineCount - 1, position.line + 3);
            const context = document.getText(new vscode.Range(startLine, 0, endLine, 999));

            let explanation: string;
            try {
                explanation = await callBackendForHover(word, context, document.languageId);
            } catch {
                return undefined;
            }

            const md = new vscode.MarkdownString();
            md.isTrusted = true;
            md.appendMarkdown(`**🇮🇳 Bhasha Explain:** \`${word}\`\n\n${explanation}`);
            return new vscode.Hover(md);
        }
    });

    // ── VS Code Command Palette Quick Search ──
    const quickSearch = vscode.commands.registerCommand('synthetixDocsMaker.quickSearch', async () => {
        const query = await vscode.window.showInputBox({
            placeHolder: 'Ask Bhasha-Chat anything… (e.g. "what is useEffect?")',
            prompt: '🇮🇳 Bhasha-Chat — AI Answer from Amazon Bedrock',
        });
        if (!query) return;

        const result = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Bhasha-Chat: Thinking…', cancellable: false },
            async () => {
                try { return await callBackendForHover(query, '', 'text'); }
                catch { return '⚠️ Cannot reach local backend. Run: node local-runner.js'; }
            }
        );

        const panel = vscode.window.createWebviewPanel('bhashaChatResult', `💬 ${query.slice(0, 40)}`, vscode.ViewColumn.Beside, { enableScripts: false });
        panel.webview.html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
            body { font-family: -apple-system,sans-serif; font-size:13px; padding:20px; background:#0d1117; color:#e6edf3; line-height:1.6; }
            h3 { color:#c084fc; margin-bottom:12px; }
            pre { background:#000; border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:12px; overflow-x:auto; font-size:12px; }
        </style></head><body>
            <h3>🇮🇳 ${query}</h3>
            <div><pre>${result.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></div>
        </body></html>`;
    });

    // ── AUTO-DOC: Re-generate docs on file change (debounced 2.5s) ──
    const autoDocListener = vscode.workspace.onDidChangeTextDocument(async (event) => {
        // Only react if a panel is open and we have a supported file
        if (!activeDocPanel) return;

        const doc = event.document;
        const ext = path.extname(doc.fileName).toLowerCase();
        if (!SUPPORTED_EXTENSIONS.has(ext)) return;

        // Debounce: reset timer on every keystroke
        if (autoUpdateTimer) clearTimeout(autoUpdateTimer);

        statusBar.text = '$(sync~spin) Auto-Docs: updating…';

        autoUpdateTimer = setTimeout(async () => {
            const code = doc.getText();
            if (!code.trim() || code.length < 50) return; // Skip trivial files

            try {
                const result = await callBackend(code);
                if (activeDocPanel) {
                    activeDocPanel.webview.html = buildWebviewHtml(
                        path.basename(doc.fileName),
                        result.wiki_md,
                        result.mermaid_code
                    );
                    statusBar.text = '$(check) Auto-Docs: updated';
                    setTimeout(() => { statusBar.text = '$(sync~spin) Auto-Docs: ON'; }, 2000);
                }
            } catch (e) {
                statusBar.text = '$(warning) Auto-Docs: error';
                setTimeout(() => { statusBar.text = '$(sync~spin) Auto-Docs: ON'; }, 3000);
            }
        }, 2500); // 2.5s debounce — fires after user stops typing
    });

    // ── VS Code Command: Audio Playback in Editor ──
    const playAudio = vscode.commands.registerCommand('synthetixDocsMaker.playAudio', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return vscode.window.showErrorMessage('No active editor.');

        const selection = editor.selection;
        const text = editor.document.getText(selection) || editor.document.getText();

        const langRes = await vscode.window.showQuickPick([
            { label: 'English', value: 'en' }, { label: 'Hindi', value: 'hi' },
            { label: 'Marathi', value: 'mr' }, { label: 'Tamil', value: 'ta' },
            { label: 'Telugu', value: 'te' }
        ], { placeHolder: 'Select Audio Language' });

        if (!langRes) return;

        vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: `Synthesizing ${langRes.label} Audio...`, cancellable: false },
            async () => {
                try {
                    const https = await import('https');
                    // Summarize a bit or pass a chunk that is safe for the audio payload
                    const body = JSON.stringify({ text: "Code selection: " + text.slice(0, 400), language: langRes.value });

                    const url = new URL(`${BACKEND_URL}/api/audio`);
                    return new Promise((resolve) => {
                        const req = https.request(
                            { hostname: url.hostname, path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
                            (res) => {
                                let data = '';
                                res.on('data', (c) => data += c);
                                res.on('end', () => {
                                    try {
                                        const resJson = JSON.parse(data);
                                        const audioUrl = resJson.audio_url || (resJson.audio_base64 ? `data:audio/mp3;base64,${resJson.audio_base64}` : null);
                                        if (audioUrl) {
                                            const panel = vscode.window.createWebviewPanel('bhashaAudio', `🔈 ${langRes.label} Audio`, vscode.ViewColumn.Beside, { enableScripts: true });
                                            panel.webview.html = `<!DOCTYPE html><html><body style="background:#0d1117;color:#e6edf3;font-family:sans-serif;padding:20px;text-align:center;">
                                                <h3 style="margin-bottom:20px;">Bhasha-Chat Audio Player</h3>
                                                <audio src="${audioUrl}" autoplay controls style="width:100%;max-width:400px;"></audio>
                                                <div style="margin-top:20px;opacity:0.7;font-size:12px;">Close this tab to stop playback.</div>
                                            </body></html>`;
                                        }
                                        resolve(null);
                                    } catch {
                                        resolve(null);
                                    }
                                });
                            }
                        );
                        req.on('error', resolve);
                        req.write(body);
                        req.end();
                    });
                } catch { }
            }
        );
    });

    // Clean up panel ref when user closes the doc panel
    const onPanelClose = () => {
        activeDocPanel = undefined;
        statusBar.text = '$(sync~spin) Auto-Docs: OFF';
    };

    context.subscriptions.push(
        disposable, chatView, clearChat, hoverProvider, quickSearch, playAudio,
        autoDocListener, statusBar
    );
    console.log('Synthetix Docs Maker Extension is now active.');
}

export function deactivate() {
    if (autoUpdateTimer) clearTimeout(autoUpdateTimer);
}

// ─── Hover / Quick-Search Backend Caller ─────────────────────────────────────

/**
 * Calls the local backend (/api/chat) to get a concise explanation for a
 * hovered symbol or a quick-search query.
 */
async function callBackendForHover(word: string, context: string, lang: string): Promise<string> {
    const prompt = context
        ? `In 1-2 sentences, explain what \`${word}\` does in this ${lang} code snippet:\n\`\`\`\n${context.slice(0, 800)}\n\`\`\``
        : word;
    const https = await import('https');
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ query: prompt, language: 'en', skill_level: 'junior', userId: 'vscode-hover', history: [] });
        const url = new URL(`${BACKEND_URL}/api/chat`);
        const req = https.request(
            { hostname: url.hostname, path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
            (res) => {
                let data = '';
                res.on('data', (c) => data += c);
                res.on('end', () => {
                    try { resolve((JSON.parse(data) as { response?: string }).response || 'No explanation available.'); }
                    catch { reject(new Error('Parse error')); }
                });
            }
        );
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// ─── Bhasha-Chat Sidebar View Provider ───────────────────────────────────────

class BhashaChatViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) { }

    public clearHistory() {
        this._view?.webview.postMessage({ type: 'clearChat' });
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this._buildChatHtml();

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (msg) => {
            if (msg.type === 'query') {
                const reply = await this._callBackend(msg.query, msg.language, msg.skillLevel);
                webviewView.webview.postMessage({ type: 'reply', text: reply });
            }
        });
    }

    private async _callBackend(query: string, language: string, skillLevel: string): Promise<string> {
        const https = await import('https');
        return new Promise((resolve) => {
            const body = JSON.stringify({ query, language, skill_level: skillLevel, userId: 'vscode-user', history: [] });
            const url = new URL(`${BACKEND_URL}/api/chat`);
            const req = https.request(
                { hostname: url.hostname, path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
                (res) => {
                    let data = '';
                    res.on('data', (c) => data += c);
                    res.on('end', () => {
                        try { resolve((JSON.parse(data) as { response?: string }).response || 'No response.'); }
                        catch { resolve('Error parsing response.'); }
                    });
                }
            );
            req.on('error', () => resolve('⚠️ Cannot reach backend. Check your internet connection.'));
            req.write(body);
            req.end();
        });
    }

    private _buildChatHtml(): string {
        return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bhasha-Chat</title>
<script src="https://cdn.jsdelivr.net/npm/marked@12/marked.min.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0d1117;
    color: #e6edf3;
    font-family: -apple-system, "Segoe UI", sans-serif;
    font-size: 12px;
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }
  .toolbar {
    padding: 8px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    background: rgba(255,255,255,0.02);
    flex-shrink: 0;
  }
  select, .skill-btn {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 6px;
    color: #e6edf3;
    padding: 4px 8px;
    font-size: 11px;
    cursor: pointer;
    outline: none;
    font-family: inherit;
  }
  .skill-btn.active { background: rgba(139,92,246,0.25); border-color: rgba(139,92,246,0.5); color: #c084fc; }
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 10px 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .msg {
    padding: 8px 10px;
    border-radius: 8px;
    max-width: 95%;
    line-height: 1.5;
    font-size: 12px;
  }
  .msg.user {
    background: rgba(59,130,246,0.15);
    border: 1px solid rgba(59,130,246,0.25);
    align-self: flex-end;
    color: #93c5fd;
  }
  .msg.bot {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    align-self: flex-start;
  }
  .msg.bot code { font-family: monospace; background: rgba(0,0,0,0.3); padding: 1px 4px; border-radius: 3px; }
  .msg.bot pre { background: #000; padding: 8px; border-radius: 6px; overflow-x: auto; margin: 4px 0; }
  .msg.bot pre code { background: none; padding: 0; }
  .msg.thinking { opacity: 0.5; font-style: italic; }
  .input-row {
    padding: 8px;
    border-top: 1px solid rgba(255,255,255,0.08);
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }
  textarea {
    flex: 1;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    color: #e6edf3;
    padding: 7px 10px;
    font-size: 12px;
    font-family: inherit;
    resize: none;
    outline: none;
    line-height: 1.4;
    min-height: 36px;
    max-height: 80px;
  }
  button#send {
    background: linear-gradient(135deg, #6d28d9, #4f46e5);
    border: none;
    border-radius: 8px;
    color: #fff;
    padding: 0 12px;
    cursor: pointer;
    font-size: 16px;
    flex-shrink: 0;
    transition: opacity 0.2s;
  }
  button#send:disabled { opacity: 0.4; cursor: default; }
  .welcome {
    text-align: center;
    color: rgba(255,255,255,0.25);
    font-size: 11px;
    margin: auto;
    padding: 20px;
    line-height: 1.6;
  }
  .welcome strong { color: rgba(192,132,252,0.7); display: block; font-size: 13px; margin-bottom: 6px; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
</style>
</head>
<body>
<div class="toolbar">
  <select id="langSel" title="Language">
    <option value="en">🌐 English</option>
    <option value="hi">🇮🇳 Hindi</option>
    <option value="mr">🇮🇳 Marathi</option>
    <option value="ta">🇮🇳 Tamil</option>
    <option value="te">🇮🇳 Telugu</option>
    <option value="kn">🇮🇳 Kannada</option>
    <option value="ml">🇮🇳 Malayalam</option>
    <option value="bn">🇮🇳 Bengali</option>
    <option value="gu">🇮🇳 Gujarati</option>
    <option value="pa">🇮🇳 Punjabi</option>
  </select>
  <button class="skill-btn active" id="btnJunior" onclick="setSkill('junior')">Junior</button>
  <button class="skill-btn" id="btnSenior" onclick="setSkill('senior')">Senior</button>
</div>
<div class="messages" id="msgs">
  <div class="welcome">
    <strong>🇮🇳 Bhasha-Chat</strong>
    Ask anything about your code in your native language.<br>
    Make sure <code>node local-runner.js</code> is running.
  </div>
</div>
<div class="input-row">
  <textarea id="inp" placeholder="Type your question..." rows="1"
    onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMsg();}"></textarea>
  <button id="send" onclick="sendMsg()">↑</button>
</div>
<script>
  const vscode = acquireVsCodeApi();
  let skill = 'junior';
  let busy = false;

  function setSkill(s) {
    skill = s;
    document.getElementById('btnJunior').classList.toggle('active', s === 'junior');
    document.getElementById('btnSenior').classList.toggle('active', s === 'senior');
  }

  function addMsg(text, role) {
    const msgs = document.getElementById('msgs');
    const welcome = msgs.querySelector('.welcome');
    if (welcome) welcome.remove();
    const div = document.createElement('div');
    div.className = 'msg ' + role;
    if (role === 'bot') {
      div.innerHTML = marked.parse(text);
    } else {
      div.textContent = text;
    }
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  function sendMsg() {
    if (busy) return;
    const inp = document.getElementById('inp');
    const query = inp.value.trim();
    if (!query) return;
    inp.value = '';
    addMsg(query, 'user');
    const thinking = addMsg('Thinking…', 'bot thinking');
    busy = true;
    document.getElementById('send').disabled = true;
    vscode.postMessage({
      type: 'query',
      query,
      language: document.getElementById('langSel').value,
      skillLevel: skill
    });
  }

  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (msg.type === 'reply') {
      const msgs = document.getElementById('msgs');
      const thinking = msgs.querySelector('.thinking');
      if (thinking) thinking.remove();
      addMsg(msg.text, 'bot');
      busy = false;
      document.getElementById('send').disabled = false;
    } else if (msg.type === 'clearChat') {
      document.getElementById('msgs').innerHTML =
        '<div class="welcome"><strong>🇮🇳 Bhasha-Chat</strong>Chat cleared.</div>';
    }
  });
</script>
</body>
</html>`;
    }
}



// ─── Folder Scanner ───────────────────────────────────────────────────────────

/**
 * Recursively reads all source files in a directory, skipping excluded folders.
 * Returns a concatenated code string with file-path markers for context.
 */
function scanFolder(folderPath: string): string {
    const chunks: string[] = [];
    let fileCount = 0;

    function walk(dir: string) {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return; // Skip unreadable directories
        }

        for (const entry of entries) {
            if (EXCLUDED_DIRS.has(entry.name)) continue;

            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                walk(fullPath);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (!SUPPORTED_EXTENSIONS.has(ext)) continue;

                // Skip very large files (>100KB) to avoid token overflow
                const stats = fs.statSync(fullPath);
                if (stats.size > 100_000) continue;

                const relativePath = path.relative(folderPath, fullPath);
                const content = fs.readFileSync(fullPath, 'utf-8');
                chunks.push(`\n\n// ---- FILE: ${relativePath} ----\n${content}`);
                fileCount++;

                // Limit to 50 files max to stay within Bedrock token limits
                if (fileCount >= 50) return;
            }
        }
    }

    walk(folderPath);
    return chunks.join('');
}

// ─── Backend API Client ───────────────────────────────────────────────────────

/**
 * POSTs the aggregated code to the local Lambda runner backend.
 * Returns parsed JSON with wiki_md and mermaid_code.
 */
function callBackend(code: string): Promise<{ wiki_md: string; mermaid_code: string }> {
    return new Promise((resolve, reject) => {
        const https = require('https') as typeof import('https');
        const body = JSON.stringify({ code_snippet: code, language: 'multi-file project' });
        const url = new URL(`${BACKEND_URL}/api/generate-wiki`);
        const req = https.request(
            {
                hostname: url.hostname, path: url.pathname, method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
            },
            (res) => {
                let data = '';
                res.on('data', (chunk: string) => data += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try { resolve(JSON.parse(data) as { wiki_md: string; mermaid_code: string }); }
                        catch { reject(new Error('Failed to parse backend response.')); }
                    } else {
                        reject(new Error(`Backend error: ${res.statusCode}`));
                    }
                });
            }
        );
        req.on('error', (e: Error) => reject(new Error(`Cannot reach backend: ${e.message}`)));
        req.write(body);
        req.end();
    });
}

// ─── Webview Panel ────────────────────────────────────────────────────────────

/**
 * Main orchestrator: scan → call API → render in a Webview panel.
 */
async function generateDocumentation(uri: vscode.Uri, context: vscode.ExtensionContext) {
    vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Synthetix Docs Maker',
            cancellable: false,
        },
        async (progress) => {
            // Step 1: Scan folder
            progress.report({ increment: 10, message: 'Scanning project files...' });
            const folderPath = uri.fsPath;
            const aggregatedCode = scanFolder(folderPath);

            if (!aggregatedCode.trim()) {
                vscode.window.showWarningMessage('No supported source files found in the selected folder.');
                return;
            }

            const scannedLineCount = aggregatedCode.split('\n').length;
            progress.report({ increment: 30, message: `Scanned ${scannedLineCount} lines of code. Calling Bedrock AI...` });

            // Step 2: Call backend
            let wikiMd: string;
            let mermaidCode: string;

            try {
                const result = await callBackend(aggregatedCode);
                wikiMd = result.wiki_md;
                mermaidCode = result.mermaid_code;
            } catch (err: any) {
                vscode.window.showErrorMessage(`Docs Maker Error: ${err.message}`);
                return;
            }

            progress.report({ increment: 60, message: 'Rendering documentation...' });

            // Step 3: Open or reuse Webview Panel
            if (!activeDocPanel || activeDocPanel.visible === false) {
                activeDocPanel = vscode.window.createWebviewPanel(
                    'synthetixDocsMaker',
                    `📄 Docs: ${path.basename(folderPath)}`,
                    vscode.ViewColumn.Two,
                    { enableScripts: true, retainContextWhenHidden: true }
                );
                // Clean up ref when user closes the panel
                activeDocPanel.onDidDispose(() => {
                    activeDocPanel = undefined;
                });
            }

            activeDocPanel.webview.html = buildWebviewHtml(path.basename(folderPath), wikiMd, mermaidCode);
            activeDocPanel.reveal(vscode.ViewColumn.Two, true);
            progress.report({ increment: 100, message: 'Done!' });
        }
    );
}

// ─── Webview HTML Builder ──────────────────────────────────────────────────────

function buildWebviewHtml(projectName: string, markdown: string, mermaidCode: string): string {
    // Use JSON.stringify to safely embed markdown — handles backticks, quotes, etc.
    const safeMarkdown = JSON.stringify(markdown || '');

    // Parse mermaid graph text into simple node names for a CSS card diagram
    const nodeLines = (mermaidCode || '').split('\n');
    const nodeMap: Record<string, string> = {};
    // Capture node definitions like: A[Label] or A(Label)
    const nodeDef = /^\s*([A-Za-z0-9_]+)\s*[\[(]([^\])\n]+)[\])]/;
    for (const line of nodeLines) {
        const m = line.match(nodeDef);
        if (m) { nodeMap[m[1]] = m[2].trim(); }
    }
    // Capture arrows to build edges: A --> B or A --> B : label
    const edgeRe = /([A-Za-z0-9_]+)\s*--?>+\s*([A-Za-z0-9_]+)/g;
    const edges: Array<[string, string]> = [];
    let em: RegExpExecArray | null;
    while ((em = edgeRe.exec(mermaidCode || '')) !== null) {
        edges.push([em[1], em[2]]);
    }

    // Build simple HTML architecture cards
    const nodes = Object.entries(nodeMap).length > 0 ? Object.entries(nodeMap) : [];
    const nodeCards = nodes.length > 0
        ? nodes.map(([id, label]: [string, string]) => `
            <div style="background:#1a1a2e;border:1px solid #333;border-radius:8px;padding:12px 16px;min-width:120px;text-align:center;">
                <div style="font-size:10px;color:#888;font-family:monospace;margin-bottom:4px;">${id}</div>
                <div style="font-size:13px;color:#ededed;font-weight:600;">${label}</div>
            </div>`).join('<div style="color:#555;font-size:18px;align-self:center;">→</div>')
        : '<div style="color:#666;font-size:13px;font-style:italic;">Architecture diagram generated — open the Documentation section for details.</div>';

    return /* html */`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Synthetix Docs Maker</title>
    <script src="https://cdn.jsdelivr.net/npm/marked@12/marked.min.js"><\/script>
    <style>
        :root {
            --bg: #0a0a0a; --surface: #111; --border: rgba(255,255,255,0.1);
            --text: #EDEDED; --muted: #888; --accent: #0070F3;
            --font: -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;
            --mono: "JetBrains Mono","Fira Code",Consolas,monospace;
        }
        * { margin:0; padding:0; box-sizing:border-box; }
        body { background:var(--bg); color:var(--text); font-family:var(--font); font-size:14px; line-height:1.6; padding:32px; max-width:900px; }
        header { display:flex; align-items:center; gap:12px; margin-bottom:32px; padding-bottom:20px; border-bottom:1px solid var(--border); }
        header .badge { background:var(--accent); color:#fff; font-size:10px; font-weight:700; padding:3px 8px; border-radius:4px; text-transform:uppercase; letter-spacing:0.05em; }
        header h1 { font-size:22px; }
        header span { color:var(--muted); font-size:13px; margin-left:auto; font-family:var(--mono); }
        section { background:var(--surface); border:1px solid var(--border); border-radius:8px; margin-bottom:24px; overflow:hidden; }
        .section-header { padding:12px 20px; border-bottom:1px solid var(--border); font-size:12px; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:0.07em; }
        .section-body { padding:24px; }
        h1,h2,h3 { color:#fff; margin-top:1.4em; margin-bottom:0.4em; font-weight:600; }
        h1 { font-size:1.6em; border-bottom:1px solid var(--border); padding-bottom:0.3em; }
        h2 { font-size:1.3em; border-bottom:1px solid var(--border); padding-bottom:0.3em; }
        h3 { font-size:1.1em; }
        p { margin-bottom:1em; }
        ul,ol { padding-left:1.5em; margin-bottom:1em; }
        li { margin-bottom:0.3em; }
        code { font-family:var(--mono); background:rgba(255,255,255,0.07); border:1px solid var(--border); padding:0.15em 0.4em; border-radius:4px; font-size:0.85em; }
        pre { background:#000; border:1px solid var(--border); border-radius:6px; padding:16px; overflow-x:auto; margin-bottom:1em; }
        pre code { background:none; border:none; padding:0; }
        blockquote { border-left:3px solid var(--accent); padding:10px 16px; background:rgba(0,112,243,0.06); border-radius:0 6px 6px 0; margin:1em 0; color:var(--muted); }
        .arch-grid { display:flex; flex-wrap:wrap; gap:10px; align-items:center; }
    </style>
</head>
<body>
    <header>
        <div class="badge">AI Generated</div>
        <h1>${projectName}</h1>
        <span>Synthetix Docs Maker · Amazon Bedrock Nova</span>
    </header>

    <section>
        <div class="section-header">📄 Auto-Generated Documentation</div>
        <div class="section-body" id="markdown-content"></div>
    </section>

    <section>
        <div class="section-header">🔗 Architecture Overview</div>
        <div class="section-body">
            <div class="arch-grid">${nodeCards}</div>
        </div>
    </section>


    <script>
        // Safe markdown embedding — JSON.stringify handles backticks and special chars
        const md = JSON.parse(${safeMarkdown});
        document.getElementById('markdown-content').innerHTML = marked.parse(md);
    <\/script>
</body>
</html>`;
}
