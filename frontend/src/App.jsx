import React, { useState, useEffect, useRef } from 'react';
import { Editor } from '@monaco-editor/react';
import Header from './components/Header';
import WikiViewer from './components/WikiViewer';
import BhashaChat from './components/BhashaChat';
import AuthModal from './components/AuthModal';
import GreenOpsPanel from './components/GreenOpsPanel';
import SipTracker from './components/SipTracker';
import OrchestrationPanel from './components/OrchestrationPanel';
import FlowDiagram from './components/FlowDiagram';
import { Code2, FileCode, Leaf, Sparkles, ScrollText, Bot, GitMerge } from 'lucide-react';
import { t } from './utils/translations';
import { getCurrentUser, signOut } from 'aws-amplify/auth';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Auto-detect coding language for pane label
const detectLanguage = (rawCode) => {
  const code = rawCode.toLowerCase();
  if (code.includes('pragma solidity') || code.includes('contract ')) return { ext: '.sol', lang: 'sol', color: '#a78bfa', label: 'Solidity' };
  if (code.includes('def ') && code.includes(':')) return { ext: '.py', lang: 'python', color: '#fbbf24', label: 'Python' };
  if (code.includes('public static void main') || code.includes('system.out') || code.includes('public class')) return { ext: '.java', lang: 'java', color: '#fb923c', label: 'Java' };
  if (code.includes('fn ') && code.includes('let ')) return { ext: '.rs', lang: 'rust', color: '#f87171', label: 'Rust' };
  if (code.includes('#include') || code.includes('int main')) return { ext: '.cpp', lang: 'cpp', color: '#60a5fa', label: 'C++' };
  if (code.includes('function ') || code.includes('const ') || code.includes('=>')) return { ext: '.js', lang: 'javascript', color: '#facc15', label: 'JavaScript' };
  return { ext: '.py', lang: 'python', color: '#fbbf24', label: 'Python' };
};

const PLACEHOLDER = `def greet_user(name, language="en"):
    """Returns a greeting in the specified language."""
    greetings = {
        "en": f"Hello, {name}!",
        "hi": f"Namaste, {name}!",
        "ta": f"Vanakkam, {name}!",
        "mr": f"Namaskar, {name}!",
    }
    return greetings.get(language, greetings["en"])

if __name__ == "__main__":
    print(greet_user("Bharat", "hi"))
`;

function App() {
  const [language, setLanguage] = useState('en');
  const [skillLevel, setSkillLevel] = useState('junior');
  const [sourceCode, setSourceCode] = useState(PLACEHOLDER);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [rightTab, setRightTab] = useState('docs');
  const [explainText, setExplainText] = useState(null);
  const editorRef = useRef(null);

  // Check existing Cognito session on mount
  useEffect(() => {
    getCurrentUser()
      .then(u => setUser(u))
      .catch(() => setUser(undefined))  // undefined = confirmed not logged in
      .finally(() => setAuthChecked(true));
  }, []);

  // Sync rightTab with URL hash to support browser back/forward buttons
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (['docs', 'greenops', 'governance', 'flow'].includes(hash)) {
        setRightTab(hash);
      } else if (!hash) {
        window.location.hash = 'docs';
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleTabChange = (tab) => {
    window.location.hash = tab;
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    if (isDarkMode) {
      document.body.classList.remove('light-mode');
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
      document.body.classList.add('light-mode');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(prev => !prev);
  const lang = detectLanguage(sourceCode);

  const saveTimerRef = useRef(null);

  // Load profile from DynamoDB after login
  const loadProfile = async (loggedInUser) => {
    if (!loggedInUser) return;
    const uid = loggedInUser.username || loggedInUser.signInDetails?.loginId || 'anonymous';
    try {
      const res = await fetch(`${API_BASE}/api/profile?userId=${encodeURIComponent(uid)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.exists) {
          setLanguage(data.language || 'en');
          setSkillLevel(data.skillLevel || 'junior');
        }
      }
    } catch (e) {
      // Backend not deployed yet — silently ignore
      console.warn('Profile load skipped (backend not reachable):', e.message);
    }
  };

  // Debounced save profile to DynamoDB when language or skill changes
  const saveProfile = (uid, lang, skill) => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await fetch(`${API_BASE}/api/profile`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: uid, language: lang, skillLevel: skill })
        });
      } catch (e) {
        console.warn('Profile save skipped:', e.message);
      }
    }, 800); // 800ms debounce
  };

  const handleSignOut = async () => {
    await signOut();
    setUser(undefined);
  };

  // FR-8: Send selected code (or full source) to Bedrock for line-by-line explanation
  const handleExplainSelection = async () => {
    const editor = editorRef.current;
    const selection = editor?.getSelection?.();
    const model = editor?.getModel?.();
    const selected = model && selection ? model.getValueInRange(selection) : '';
    const code = (selected.trim() || sourceCode).slice(0, 3000);
    if (!code) return;
    setExplainText('loading');
    const langLabel = {
      en: 'English', hi: 'Hindi', mr: 'Marathi', ta: 'Tamil', te: 'Telugu',
      kn: 'Kannada', ml: 'Malayalam', bn: 'Bengali', gu: 'Gujarati', pa: 'Punjabi',
    }[language] || 'English';
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `Explain this ${lang.label} code line-by-line in ${langLabel}. For each meaningful line or block, describe what it does in simple terms. Use ${skillLevel === 'junior' ? 'beginner-friendly analogies' : 'technical precision'}:\n\n\`\`\`${lang.lang}\n${code}\n\`\`\``,
          language, skill_level: skillLevel,
          userId: user?.username || 'anonymous',
          history: []
        })
      });
      const data = await res.json();
      setExplainText(data.response || '⚠️ No response from AI.');
    } catch (e) {
      setExplainText('⚠️ Backend not reachable. Deploy the serverless backend first.');
    }
  };


  // Load profile from backend whenever user changes (i.e. on first login)
  useEffect(() => {
    if (user) loadProfile(user);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save preferences to DynamoDB whenever language or skill level changes
  useEffect(() => {
    if (!user) return;
    const uid = user.username || user.signInDetails?.loginId || 'anonymous';
    saveProfile(uid, language, skillLevel);
  }, [language, skillLevel]); // eslint-disable-line react-hooks/exhaustive-deps

  // While session check is in-progress, show nothing
  if (!authChecked) return null;

  // Show auth screen if no user
  if (!user) {
    return (
      <AuthModal
        onAuthSuccess={(devUser) => {
          // If a mock/dev user is passed directly (bypass), use it immediately.
          // Otherwise fetch the real Cognito session.
          if (devUser) {
            setUser(devUser);
            loadProfile(devUser);
          } else {
            getCurrentUser().then(u => { setUser(u); loadProfile(u); }).catch(() => setUser({ username: 'guest' }));
          }
        }}
      />
    );
  }

  return (
    <div style={styles.appRoot}>
      <Header
        language={language}
        setLanguage={setLanguage}
        skillLevel={skillLevel}
        setSkillLevel={setSkillLevel}
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
        user={user}
        onSignOut={handleSignOut}
      />

      <main style={styles.mainLayout}>
        {/* ── Left: Code Editor Pane ── */}
        <div style={styles.editorPane}>
          {/* Pane header */}
          <div style={styles.paneHeader}>
            <div style={styles.macDots}>
              <span style={{ ...styles.dot, background: '#FF5F57' }} />
              <span style={{ ...styles.dot, background: '#FEBC2E' }} />
              <span style={{ ...styles.dot, background: '#28CA41' }} />
            </div>
            <div style={styles.fileTab}>
              <span style={{ ...styles.fileDot, background: lang.color }} />
              <span style={styles.fileName}>source_code{lang.ext}</span>
            </div>
            <div style={styles.langBadge}>
              <FileCode size={11} />
              {lang.label}
            </div>
            <div style={styles.lineCount}>
              {sourceCode.split('\n').length} {t(language, 'linesLabel')}
            </div>
            <button
              onClick={handleExplainSelection}
              disabled={explainText === 'loading'}
              style={styles.explainBtn}
              title="Explain selected code (or full file) with AI"
            >
              <Sparkles size={11} />
              {explainText === 'loading' ? t(language, 'headerExplaining') : t(language, 'headerExplain')}
            </button>
          </div>

          {/* Monaco Editor */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <Editor
              height="100%"
              language={lang.lang}
              theme={isDarkMode ? 'vs-dark' : 'light'}
              value={sourceCode}
              onMount={(editor) => { editorRef.current = editor; }}
              onChange={(value) => setSourceCode(value || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 13.5,
                fontFamily: "'JetBrains Mono', Menlo, Consolas, monospace",
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                padding: { top: 16, bottom: 16 },
                lineNumbers: 'on',
                renderLineHighlight: 'line',
                smoothScrolling: true,
                cursorBlinking: 'smooth',
                bracketPairColorization: { enabled: true },
              }}
            />
          </div>

          {/* FR-8: AI Explanation Panel */}
          {explainText && (
            <div style={styles.explainPanel}>
              <div style={styles.explainHeader}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Sparkles size={12} color="#a78bfa" />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{t(language, 'headerAiExplanation')}</span>
                </span>
                <button onClick={() => setExplainText(null)} style={styles.explainClose}>✕</button>
              </div>
              <div style={styles.explainBody}>
                {explainText === 'loading'
                  ? <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontStyle: 'italic' }}>{t(language, 'explainAnalyzing')}</span>
                  : <pre style={styles.explainPre}>{explainText}</pre>
                }
              </div>
            </div>
          )}

          {/* Footer hint */}
          <div style={styles.editorFooter}>
            <span style={styles.footerHint}>{t(language, 'editorFooter')}</span>
            <span style={{ ...styles.footerLang, color: lang.color }}>{lang.label}</span>
          </div>
        </div>

        {/* ── Right: Tabbed Output Pane ── */}
        <div style={styles.outputPane}>
          {/* Tab bar */}
          <div style={styles.tabBar}>
            <button
              style={{ ...styles.tabBtn, ...(rightTab === 'docs' ? styles.tabActive : {}) }}
              onClick={() => handleTabChange('docs')}
            >
              <Code2 size={12} />
              {t(language, 'tabDocs').replace('📄 ', '')}
            </button>
            <button
              style={{ ...styles.tabBtn, ...(rightTab === 'greenops' ? styles.tabActiveGreen : {}) }}
              onClick={() => handleTabChange('greenops')}
            >
              <Leaf size={12} />
              {t(language, 'tabGreenops').replace('🌱 ', '')}
              <span style={styles.greenDot} />
            </button>
            <button
              style={{ ...styles.tabBtn, ...(rightTab === 'governance' ? styles.tabActiveGov : {}) }}
              onClick={() => handleTabChange('governance')}
            >
              <ScrollText size={12} />
              {t(language, 'tabGovernance').replace('⚖️ ', '')}
            </button>
            <button
              style={{ ...styles.tabBtn, ...(rightTab === 'flow' ? styles.tabActiveOrchestrator : {}) }}
              onClick={() => handleTabChange('flow')}
            >
              <GitMerge size={12} />
              {t(language, 'tabOrchestrator').replace('⚙️ ', '')}
            </button>
          </div>

          {/* Panel content */}
          <div style={{ flex: 1, minHeight: 0, overflowY: rightTab === 'flow' ? 'hidden' : 'auto' }}>
            {rightTab === 'docs' && <WikiViewer language={language} skillLevel={skillLevel} sourceCode={sourceCode} />}
            {rightTab === 'greenops' && <GreenOpsPanel language={language} />}
            {rightTab === 'governance' && <SipTracker language={language} skillLevel={skillLevel} user={user} />}
            {rightTab === 'flow' && <OrchestrationPanel sourceCode={sourceCode} language={language} skillLevel={skillLevel} user={user} />}
          </div>
        </div>
      </main>

      <BhashaChat language={language} skillLevel={skillLevel} user={user} />
    </div>
  );
}

const styles = {
  appRoot: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
    background: 'var(--bg-base)',
  },
  mainLayout: {
    display: 'grid',
    gridTemplateColumns: '38% 1fr',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },

  /* Editor */
  editorPane: {
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid var(--border-soft)',
    background: 'var(--bg-layer2)',
    minHeight: 0,
    overflow: 'hidden',
  },
  paneHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    background: 'var(--bg-layer1)',
    boxShadow: 'var(--clay-drop), var(--clay-inset-light), var(--clay-inset-dark)',
    flexShrink: 0,
    zIndex: 2,
  },
  macDots: {
    display: 'flex',
    gap: '5px',
    alignItems: 'center',
  },
  dot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  fileTab: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '3px 10px',
    background: 'var(--bg-layer2)',
    boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.05), inset -2px -2px 4px rgba(255,255,255,0.6)',
    borderRadius: '6px',
    border: 'none',
  },
  fileDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
  },
  fileName: {
    fontSize: '12px',
    fontFamily: "'JetBrains Mono', monospace",
    color: 'var(--text-secondary)',
    fontWeight: '500',
  },
  langBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '10px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    background: 'var(--bg-layer2)',
    boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.05), inset -2px -2px 4px rgba(255,255,255,0.6)',
    padding: '2px 8px',
    borderRadius: '999px',
    letterSpacing: '0.04em',
  },
  lineCount: {
    marginLeft: 'auto',
    fontSize: '11px',
    fontFamily: "'JetBrains Mono', monospace",
    color: 'var(--text-muted)',
  },
  editorFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '7px 14px',
    background: 'var(--bg-layer1)',
    borderTop: '1px solid var(--border-soft)',
    flexShrink: 0,
  },
  footerHint: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontFamily: "'JetBrains Mono', monospace",
  },
  footerLang: {
    fontSize: '11px',
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: '700',
    letterSpacing: '0.08em',
  },

  /* Output pane  */
  outputPane: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
    background: 'var(--bg-layer1)',
  },

  /* Tab bar */
  tabBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '12px 16px',
    background: 'var(--bg-layer1)',
    boxShadow: 'var(--clay-drop), var(--clay-inset-light), var(--clay-inset-dark)',
    flexShrink: 0,
    zIndex: 2,
  },
  tabBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '6px 14px',
    borderRadius: '8px',
    border: 'none',
    background: 'var(--bg-layer1)',
    boxShadow: 'var(--clay-drop), var(--clay-inset-light), var(--clay-inset-dark)',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    fontWeight: 600,
    fontFamily: "'Inter', sans-serif",
    cursor: 'pointer',
    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  tabActive: {
    background: 'var(--bg-layer2)',
    boxShadow: 'inset 3px 3px 6px rgba(0,0,0,0.05), inset -3px -3px 6px rgba(255,255,255,0.6)',
    color: 'var(--text-primary)',
  },
  tabActiveGreen: {
    background: 'var(--bg-layer2)',
    boxShadow: 'inset 3px 3px 6px rgba(0,0,0,0.05), inset -3px -3px 6px rgba(255,255,255,0.6)',
    color: 'var(--teal)',
  },
  tabActiveGov: {
    background: 'var(--bg-layer2)',
    boxShadow: 'inset 3px 3px 6px rgba(0,0,0,0.05), inset -3px -3px 6px rgba(255,255,255,0.6)',
    color: 'var(--violet)',
  },
  tabActiveAgents: {
    background: 'var(--bg-layer2)',
    boxShadow: 'inset 3px 3px 6px rgba(0,0,0,0.05), inset -3px -3px 6px rgba(255,255,255,0.6)',
    color: '#f472b6',
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#34D399',
    boxShadow: '0 0 6px #34D399',
    display: 'inline-block',
    animation: 'pulse 2s infinite',
  },

  /* Explain button in editor header */
  explainBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '5px 12px', borderRadius: '8px',
    border: 'none',
    background: 'var(--bg-layer1)', color: 'var(--violet)',
    boxShadow: 'var(--clay-drop), var(--clay-inset-light), var(--clay-inset-dark)',
    fontSize: '11px', fontWeight: 600, fontFamily: 'inherit',
    cursor: 'pointer', transition: 'all 0.15s', marginLeft: 'auto',
  },

  /* Explain result panel */
  explainPanel: {
    maxHeight: '220px', flexShrink: 0,
    borderTop: 'none',
    background: 'var(--bg-layer2)',
    boxShadow: 'inset 4px 4px 8px rgba(0,0,0,0.05), inset -4px -4px 8px rgba(255,255,255,0.6)',
    display: 'flex', flexDirection: 'column',
  },
  explainHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 16px', borderBottom: '1px solid rgba(0,0,0,0.05)',
    flexShrink: 0,
  },
  explainClose: {
    background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
    cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '2px 4px',
  },
  explainBody: {
    overflowY: 'auto', padding: '10px 12px', flex: 1,
  },
  explainPre: {
    margin: 0, fontFamily: "'JetBrains Mono', monospace",
    fontSize: '11px', lineHeight: 1.6, color: 'rgba(255,255,255,0.75)',
    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  },
};

export default App;
