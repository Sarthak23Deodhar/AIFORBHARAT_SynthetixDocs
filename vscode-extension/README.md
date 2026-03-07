# Synthetix Docs Maker — VS Code Extension

Generate AI-powered documentation for entire project folders, directly inside VS Code. Powered by Amazon Bedrock (Claude 3.5 Sonnet).

---

## 🚀 How to Install & Run

### Prerequisites
- VS Code 1.85+
- The `serverless-backend/local-runner.js` must be running locally.
- AWS credentials must be configured in `serverless-backend/.env`.

### Step 1: Open the Extension in VS Code
```powershell
# In a terminal, navigate to the extension folder
cd vscode-extension

# Install dependencies (if not already done)
npm install

# Compile TypeScript
npm run compile
```

### Step 2: Launch the Extension Dev Host
1. Open `vscode-extension/` folder in VS Code.
2. Press **F5** to launch the **Extension Development Host** (a new VS Code window).
3. In the new window, open any project folder.

### Step 3: Generate Documentation
**Option A:** Right-click any folder in the **Explorer sidebar** → **"Generate Docs with AI (Synthetix)"**

**Option B:** Open the Command Palette (Ctrl+Shift+P) → type `Generate Docs with AI`

A progress notification will appear, and after ~10-20 seconds (depending on Bedrock response time), a **split panel** will open with:
- 📄 Auto-generated Markdown documentation for the entire project
- 🔗 A live architecture diagram showing module interactions

---

## ⚙️ Configuration

The extension always calls:
```
POST http://localhost:8000/api/generate-wiki
```

Make sure your backend is running before using the extension.

---

## 🗂️ What Gets Scanned

**Included Extensions:** `.js` `.ts` `.jsx` `.tsx` `.py` `.sol` `.go` `.rs` `.java` `.cs` `.cpp` `.c` `.rb` `.php` `.swift` `.kt`

**Excluded Directories:** `node_modules`, `.git`, `dist`, `build`, `out`, `.next`, `__pycache__`, `venv`, `coverage`

**File Limits:** Max 50 files, max 100KB per file (to stay within Bedrock context window).
