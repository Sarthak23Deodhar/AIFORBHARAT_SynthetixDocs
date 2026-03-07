"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
let activeDocPanel;
let autoUpdateTimer;
function activate(context) {
    // ── Status bar: shows auto-docs state ──
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.text = '$(sync~spin) Auto-Docs: OFF';
    statusBar.tooltip = 'Synthetix Auto-Documentation';
    statusBar.show();
    // ── Register the existing doc generator command ──
    const disposable = vscode.commands.registerCommand('synthetixDocsMaker.generate', async (uri) => {
        const targetUri = uri ?? vscode.workspace.workspaceFolders?.[0]?.uri;
        if (!targetUri) {
            vscode.window.showErrorMessage('Please open a folder or workspace before generating docs.');
            return;
        }
        const langRes = await vscode.window.showQuickPick([
            { label: 'English', value: 'en' }, { label: 'Hindi', value: 'hi' },
            { label: 'Marathi', value: 'mr' }, { label: 'Tamil', value: 'ta' },
            { label: 'Telugu', value: 'te' }, { label: 'Kannada', value: 'kn' },
            { label: 'Malayalam', value: 'ml' }, { label: 'Bengali', value: 'bn' },
            { label: 'Gujarati', value: 'gu' }, { label: 'Punjabi', value: 'pa' }
        ], { placeHolder: 'Select Documentation Language' });
        if (!langRes)
            return; // User cancelled
        await generateDocumentation(targetUri, context, langRes.value);
    });
    // ── Register the Bhasha-Chat sidebar view ──
    const chatProvider = new BhashaChatViewProvider(context.extensionUri);
    const chatView = vscode.window.registerWebviewViewProvider('synthetixDocsMaker.bhashaChat', chatProvider, { webviewOptions: { retainContextWhenHidden: true } });
    // ── Register clear chat command ──
    const clearChat = vscode.commands.registerCommand('synthetixDocsMaker.clearChat', () => {
        chatProvider.clearHistory();
    });
    // ── FR-8: Inline Hover Provider (symbol explanation) ──
    const HOVER_LANGS = ['javascript', 'typescript', 'python', 'rust', 'go', 'java', 'solidity', 'cpp', 'c'];
    const hoverProvider = vscode.languages.registerHoverProvider(HOVER_LANGS, {
        async provideHover(document, position) {
            const wordRange = document.getWordRangeAtPosition(position);
            if (!wordRange)
                return undefined;
            const word = document.getText(wordRange);
            if (word.length < 2)
                return undefined;
            const startLine = Math.max(0, position.line - 3);
            const endLine = Math.min(document.lineCount - 1, position.line + 3);
            const context = document.getText(new vscode.Range(startLine, 0, endLine, 999));
            let explanation;
            try {
                explanation = await callBackendForHover(word, context, document.languageId);
            }
            catch {
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
        if (!query)
            return;
        const result = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Bhasha-Chat: Thinking…', cancellable: false }, async () => {
            try {
                return await callBackendForHover(query, '', 'text');
            }
            catch {
                return '⚠️ Cannot reach local backend. Run: node local-runner.js';
            }
        });
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
        if (!activeDocPanel)
            return;
        const doc = event.document;
        const ext = path.extname(doc.fileName).toLowerCase();
        if (!SUPPORTED_EXTENSIONS.has(ext))
            return;
        // Debounce: reset timer on every keystroke
        if (autoUpdateTimer)
            clearTimeout(autoUpdateTimer);
        statusBar.text = '$(sync~spin) Auto-Docs: updating…';
        autoUpdateTimer = setTimeout(async () => {
            const code = doc.getText();
            if (!code.trim() || code.length < 50)
                return; // Skip trivial files
            try {
                // Auto-docs default to English to prevent noisy prompts while typing
                const result = await callBackend(code, 'en');
                if (activeDocPanel) {
                    activeDocPanel.webview.html = buildWebviewHtml(path.basename(doc.fileName), result.wiki_md, result.mermaid_code);
                    statusBar.text = '$(check) Auto-Docs: updated';
                    setTimeout(() => { statusBar.text = '$(sync~spin) Auto-Docs: ON'; }, 2000);
                }
            }
            catch (e) {
                statusBar.text = '$(warning) Auto-Docs: error';
                setTimeout(() => { statusBar.text = '$(sync~spin) Auto-Docs: ON'; }, 3000);
            }
        }, 2500); // 2.5s debounce — fires after user stops typing
    });
    // ── VS Code Command: Audio Playback in Editor ──
    const playAudio = vscode.commands.registerCommand('synthetixDocsMaker.playAudio', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return vscode.window.showErrorMessage('No active editor.');
        const selection = editor.selection;
        const text = editor.document.getText(selection) || editor.document.getText();
        const langRes = await vscode.window.showQuickPick([
            { label: 'English', value: 'en' }, { label: 'Hindi', value: 'hi' },
            { label: 'Marathi', value: 'mr' }, { label: 'Tamil', value: 'ta' },
            { label: 'Telugu', value: 'te' }
        ], { placeHolder: 'Select Audio Language' });
        if (!langRes)
            return;
        vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `Synthesizing ${langRes.label} Audio...`, cancellable: false }, async () => {
            try {
                const https = await Promise.resolve().then(() => __importStar(require('https')));
                // Summarize a bit or pass a chunk that is safe for the audio payload
                const body = JSON.stringify({ text: "Code selection: " + text.slice(0, 400), language: langRes.value });
                const url = new URL(`${BACKEND_URL}/api/audio`);
                return new Promise((resolve) => {
                    const req = https.request({ hostname: url.hostname, path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (res) => {
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
                            }
                            catch {
                                resolve(null);
                            }
                        });
                    });
                    req.on('error', resolve);
                    req.write(body);
                    req.end();
                });
            }
            catch { }
        });
    });
    // Clean up panel ref when user closes the doc panel
    const onPanelClose = () => {
        activeDocPanel = undefined;
        statusBar.text = '$(sync~spin) Auto-Docs: OFF';
    };
    context.subscriptions.push(disposable, chatView, clearChat, hoverProvider, quickSearch, playAudio, autoDocListener, statusBar);
    console.log('Synthetix Docs Maker Extension is now active.');
}
function deactivate() {
    if (autoUpdateTimer)
        clearTimeout(autoUpdateTimer);
}
// ─── Hover / Quick-Search Backend Caller ─────────────────────────────────────
/**
 * Calls the local backend (/api/chat) to get a concise explanation for a
 * hovered symbol or a quick-search query.
 */
async function callBackendForHover(word, context, lang) {
    const prompt = context
        ? `In 1-2 sentences, explain what \`${word}\` does in this ${lang} code snippet:\n\`\`\`\n${context.slice(0, 800)}\n\`\`\``
        : word;
    const https = await Promise.resolve().then(() => __importStar(require('https')));
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ query: prompt, language: 'en', skill_level: 'junior', userId: 'vscode-hover', history: [] });
        const url = new URL(`${BACKEND_URL}/api/chat`);
        const req = https.request({ hostname: url.hostname, path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (res) => {
            let data = '';
            res.on('data', (c) => data += c);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data).response || 'No explanation available.');
                }
                catch {
                    reject(new Error('Parse error'));
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}
// ─── Bhasha-Chat Sidebar View Provider ───────────────────────────────────────
class BhashaChatViewProvider {
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
    }
    clearHistory() {
        this._view?.webview.postMessage({ type: 'clearChat' });
    }
    resolveWebviewView(webviewView, _context, _token) {
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
    async _callBackend(query, language, skillLevel) {
        const https = await Promise.resolve().then(() => __importStar(require('https')));
        return new Promise((resolve) => {
            const body = JSON.stringify({ query, language, skill_level: skillLevel, userId: 'vscode-user', history: [] });
            const url = new URL(`${BACKEND_URL}/api/chat`);
            const req = https.request({ hostname: url.hostname, path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (res) => {
                let data = '';
                res.on('data', (c) => data += c);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data).response || 'No response.');
                    }
                    catch {
                        resolve('Error parsing response.');
                    }
                });
            });
            req.on('error', () => resolve('⚠️ Cannot reach backend. Check your internet connection.'));
            req.write(body);
            req.end();
        });
    }
    _buildChatHtml() {
        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bhasha-Chat</title>
<script src="https://cdn.jsdelivr.net/npm/marked@12/marked.min.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    font-family: var(--vscode-font-family), -apple-system, sans-serif;
    font-size: var(--vscode-font-size, 12px);
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }
  .toolbar {
    padding: 8px;
    border-bottom: 1px solid var(--vscode-panel-border);
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    background: var(--vscode-editor-background);
    flex-shrink: 0;
  }
  select, .skill-btn {
    background: var(--vscode-dropdown-background);
    border: 1px solid var(--vscode-dropdown-border);
    color: var(--vscode-dropdown-foreground);
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 11px;
    cursor: pointer;
    outline: none;
    font-family: inherit;
  }
  .skill-btn {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border-color: transparent;
  }
  .skill-btn.active {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
  }
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
    background: var(--vscode-textBlockQuote-background);
    border: 1px solid var(--vscode-textBlockQuote-border);
    align-self: flex-end;
  }
  .msg.bot {
    background: var(--vscode-editorWidget-background);
    border: 1px solid var(--vscode-widget-border);
    align-self: flex-start;
  }
  .msg.bot code { font-family: var(--vscode-editor-font-family); background: var(--vscode-textCodeBlock-background); padding: 1px 4px; border-radius: 3px; }
  .msg.bot pre { background: var(--vscode-textCodeBlock-background); padding: 8px; border-radius: 6px; overflow-x: auto; margin: 4px 0; }
  .msg.bot pre code { background: none; padding: 0; }
  .msg.thinking { opacity: 0.5; font-style: italic; }
  .input-row {
    padding: 8px;
    border-top: 1px solid var(--vscode-panel-border);
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }
  textarea {
    flex: 1;
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border);
    color: var(--vscode-input-foreground);
    border-radius: 4px;
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
    background: var(--vscode-button-background);
    border: none;
    border-radius: 4px;
    color: var(--vscode-button-foreground);
    padding: 0 12px;
    cursor: pointer;
    font-size: 16px;
    flex-shrink: 0;
  }
  button#send:disabled { opacity: 0.4; cursor: default; }
  .welcome {
    text-align: center;
    color: var(--vscode-descriptionForeground);
    font-size: 11px;
    margin: auto;
    padding: 20px;
    line-height: 1.6;
  }
  .welcome strong { color: var(--vscode-textLink-foreground); display: block; font-size: 13px; margin-bottom: 6px; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-thumb { background: var(--vscode-scrollbarSlider-background); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--vscode-scrollbarSlider-hoverBackground); }
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
function scanFolder(folderPath) {
    const chunks = [];
    let fileCount = 0;
    function walk(dir) {
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        }
        catch {
            return; // Skip unreadable directories
        }
        for (const entry of entries) {
            if (EXCLUDED_DIRS.has(entry.name))
                continue;
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
            }
            else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (!SUPPORTED_EXTENSIONS.has(ext))
                    continue;
                // Skip very large files (>100KB) to avoid token overflow
                const stats = fs.statSync(fullPath);
                if (stats.size > 100000)
                    continue;
                const relativePath = path.relative(folderPath, fullPath);
                const content = fs.readFileSync(fullPath, 'utf-8');
                chunks.push(`\n\n// ---- FILE: ${relativePath} ----\n${content}`);
                fileCount++;
                // Limit to 50 files max to stay within Bedrock token limits
                if (fileCount >= 50)
                    return;
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
function callBackend(code, language) {
    return new Promise((resolve, reject) => {
        const https = require('https');
        const body = JSON.stringify({ code_snippet: code, language });
        const url = new URL(`${BACKEND_URL}/api/generate-wiki`);
        const req = https.request({
            hostname: url.hostname, path: url.pathname, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        resolve(JSON.parse(data));
                    }
                    catch {
                        reject(new Error('Failed to parse backend response.'));
                    }
                }
                else {
                    reject(new Error(`Backend error: ${res.statusCode}`));
                }
            });
        });
        req.on('error', (e) => reject(new Error(`Cannot reach backend: ${e.message}`)));
        req.write(body);
        req.end();
    });
}
// ─── Webview Panel ────────────────────────────────────────────────────────────
/**
 * Main orchestrator: scan → call API → render in a Webview panel.
 */
async function generateDocumentation(uri, context, language = 'en') {
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Synthetix Docs Maker',
        cancellable: false,
    }, async (progress) => {
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
        let wikiMd;
        let mermaidCode;
        try {
            const result = await callBackend(aggregatedCode, language);
            wikiMd = result.wiki_md;
            mermaidCode = result.mermaid_code;
        }
        catch (err) {
            vscode.window.showErrorMessage(`Docs Maker Error: ${err.message}`);
            return;
        }
        progress.report({ increment: 60, message: 'Rendering documentation...' });
        // Step 3: Open or reuse Webview Panel
        if (!activeDocPanel || activeDocPanel.visible === false) {
            activeDocPanel = vscode.window.createWebviewPanel('synthetixDocsMaker', `📄 Docs: ${path.basename(folderPath)}`, vscode.ViewColumn.Two, { enableScripts: true, retainContextWhenHidden: true });
            // Clean up ref when user closes the panel
            activeDocPanel.onDidDispose(() => {
                activeDocPanel = undefined;
            });
        }
        activeDocPanel.webview.html = buildWebviewHtml(path.basename(folderPath), wikiMd, mermaidCode);
        activeDocPanel.reveal(vscode.ViewColumn.Two, true);
        progress.report({ increment: 100, message: 'Done!' });
    });
}
// ─── Webview HTML Builder ──────────────────────────────────────────────────────
function buildWebviewHtml(projectName, markdown, mermaidCode) {
    // Safe markdown embedding — base64 encodes the string so we avoid all quote/newline escaping issues in JS templates
    const base64Markdown = Buffer.from(markdown || '').toString('base64');
    // Pass the raw mermaid code if present
    const cleanMermaid = (mermaidCode || '').trim();
    const mermaidHtml = cleanMermaid
        ? `<div class="mermaid-container"><pre class="mermaid">\n${cleanMermaid}\n</pre></div>`
        : '<div style="color:var(--vscode-descriptionForeground);font-size:13px;font-style:italic;">Architecture diagram not generated.</div>';
    return /* html */ `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Synthetix Docs Maker</title>
    <script src="https://cdn.jsdelivr.net/npm/marked@12/marked.min.js"></script>
    <script type="module">
        import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
        mermaid.initialize({ startOnLoad: true, theme: 'dark' });
    </script>
    <style>
        :root {
            --bg: var(--vscode-editor-background); 
            --surface: var(--vscode-editorWidget-background); 
            --border: var(--vscode-panel-border);
            --text: var(--vscode-editor-foreground); 
            --muted: var(--vscode-descriptionForeground); 
            --accent: var(--vscode-button-background);
            --font: var(--vscode-font-family), -apple-system, sans-serif;
            --mono: var(--vscode-editor-font-family), monospace;
        }
        * { margin:0; padding:0; box-sizing:border-box; }
        body { background:var(--bg); color:var(--text); font-family:var(--font); font-size:var(--vscode-font-size, 14px); line-height:1.6; padding:32px; max-width:900px; margin:0 auto; }
        header { display:flex; align-items:center; gap:12px; margin-bottom:32px; padding-bottom:20px; border-bottom:1px solid var(--border); }
        header .badge { background:var(--accent); color:var(--vscode-button-foreground); font-size:10px; font-weight:700; padding:3px 8px; border-radius:4px; text-transform:uppercase; letter-spacing:0.05em; }
        header h1 { font-size:22px; margin:0; }
        header span { color:var(--muted); font-size:13px; margin-left:auto; font-family:var(--mono); }
        .toolbar { display:flex; justify-content:flex-end; margin-bottom:16px; }
        .download-btn { background:var(--vscode-button-background); color:var(--vscode-button-foreground); border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:12px; display:inline-flex; align-items:center; gap:6px; }
        .download-btn:hover { background:var(--vscode-button-hoverBackground); }
        section { background:var(--surface); border:1px solid var(--border); border-radius:8px; margin-bottom:24px; overflow:hidden; }
        .section-header { padding:12px 20px; border-bottom:1px solid var(--border); font-size:12px; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:0.07em; background:var(--vscode-sideBar-background); }
        .section-body { padding:24px; overflow-x:auto; }
        h1,h2,h3 { color:var(--vscode-editor-foreground); margin-top:1.4em; margin-bottom:0.4em; font-weight:600; }
        h1 { font-size:1.6em; border-bottom:1px solid var(--border); padding-bottom:0.3em; }
        h2 { font-size:1.3em; border-bottom:1px solid var(--border); padding-bottom:0.3em; }
        h3 { font-size:1.1em; }
        p { margin-bottom:1em; }
        ul,ol { padding-left:1.5em; margin-bottom:1em; }
        li { margin-bottom:0.3em; }
        code { font-family:var(--mono); background:var(--vscode-textCodeBlock-background); padding:0.15em 0.4em; border-radius:4px; font-size:0.85em; }
        pre { background:var(--vscode-textCodeBlock-background); border:1px solid var(--border); border-radius:6px; padding:16px; overflow-x:auto; margin-bottom:1em; }
        pre code { background:none; border:none; padding:0; }
        blockquote { border-left:3px solid var(--accent); padding:10px 16px; background:var(--vscode-textBlockQuote-background); border-radius:0 6px 6px 0; margin:1em 0; color:var(--muted); }
        .mermaid-container { background: var(--vscode-editor-background); padding: 16px; border-radius: 6px; border: 1px solid var(--border); text-align: center; overflow-x: auto; }
        svg { max-width: 100%; height: auto; }
    </style>
</head>
<body>
    <header>
        <div class="badge">AI Generated</div>
        <h1>${projectName}</h1>
        <span>Synthetix Docs Maker · Amazon Bedrock Nova</span>
    </header>

    <div class="toolbar">
        <button class="download-btn" id="btnDownload">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Download Docs
        </button>
    </div>

    <section>
        <div class="section-header">📄 Auto-Generated Documentation</div>
        <div class="section-body" id="markdown-content"></div>
    </section>

    <section>
        <div class="section-header">🔗 Architecture Diagram</div>
        <div class="section-body">
            ${mermaidHtml}
        </div>
    </section>

    <script>
        // Use base64 string to avoid all JSON parsing / quote escaping issues
        const base64Md = "${base64Markdown}";
        const rawMd = decodeURIComponent(escape(window.atob(base64Md)));
        document.getElementById('markdown-content').innerHTML = marked.parse(rawMd);

        // Download functionality
        document.getElementById('btnDownload').addEventListener('click', () => {
            const blob = new Blob([rawMd], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = '${projectName}-docs.md';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    </script>
</body>
</html>`;
}
//# sourceMappingURL=extension.js.map