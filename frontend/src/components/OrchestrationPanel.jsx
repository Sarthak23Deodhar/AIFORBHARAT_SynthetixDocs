import React, { useState } from 'react';
import { Bot, ShieldCheck, FlaskConical, FileText, Play, ChevronRight, AlertTriangle } from 'lucide-react';
import { t } from '../utils/translations';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const AGENTS = [
    {
        id: 'scanner',
        name: 'Scanner Agent',
        role: 'OWASP Vulnerability Detection',
        icon: ShieldCheck,
        color: '#f87171',
        accent: 'rgba(248,113,113,0.12)',
        border: 'rgba(248,113,113,0.25)',
    },
    {
        id: 'verifier',
        name: 'Verification Agent',
        role: 'False-Positive Elimination',
        icon: FlaskConical,
        color: '#34d399',
        accent: 'rgba(52,211,153,0.12)',
        border: 'rgba(52,211,153,0.25)',
    },
    {
        id: 'synthesizer',
        name: 'Synthesis Agent',
        role: 'Executive Report Generation',
        icon: FileText,
        color: '#818cf8',
        accent: 'rgba(129,140,248,0.12)',
        border: 'rgba(129,140,248,0.25)',
    },
];

const STAGE_ORDER = ['scanner', 'verifier', 'synthesizer'];

export default function OrchestrationPanel({ language, skillLevel, sourceCode, user }) {
    const [status, setStatus] = useState('idle'); // idle | running | done | error
    const [activeStage, setActiveStage] = useState(null); // 0,1,2
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);

    const run = async () => {
        if (!sourceCode?.trim()) {
            setError('Please paste some code in the editor first.');
            return;
        }
        setStatus('running');
        setResults(null);
        setError(null);
        setActiveStage(0);

        try {
            // Optimistic step progression for UX while the single request processes
            const stepTimers = [
                setTimeout(() => setActiveStage(1), 4000),
                setTimeout(() => setActiveStage(2), 9000),
            ];

            const res = await fetch(`${API_BASE}/api/orchestrate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code_snippet: sourceCode.slice(0, 8000),
                    language,
                    skill_level: skillLevel,
                    userId: user?.username || 'anonymous',
                })
            });

            stepTimers.forEach(t => clearTimeout(t));

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setResults(data);
            setActiveStage(3); // all done
            setStatus('done');
        } catch (e) {
            setError('Backend not reachable. Deploy the serverless backend and try again.\n\n' + e.message);
            setStatus('error');
            setActiveStage(null);
        }
    };

    const reset = () => {
        setStatus('idle');
        setActiveStage(null);
        setResults(null);
        setError(null);
    };

    const getSeverityColor = (sev) => {
        const m = { Critical: '#f87171', High: '#fb923c', Medium: '#fbbf24', Low: '#34d399', Info: '#60a5fa' };
        return m[sev] || '#60a5fa';
    };

    return (
        <div style={styles.root}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.headerLeft}>
                    <div style={styles.headerIcon}>
                        <Bot size={14} color="#818cf8" />
                    </div>
                    <div>
                        <div style={styles.headerTitle}>Multi-Agent Orchestration</div>
                        <div style={styles.headerSub}>Scanner → Verifier → Synthesizer · Powered by Amazon Bedrock Nova</div>
                    </div>
                </div>
                {status === 'done' && (
                    <button onClick={reset} style={styles.resetBtn}>Reset</button>
                )}
            </div>

            {/* Pipeline diagram */}
            <div style={styles.pipelineRow}>
                {AGENTS.map((agent, i) => {
                    const Icon = agent.icon;
                    const isActive = activeStage === i;
                    const isDone = activeStage > i;
                    const isPending = activeStage === null || activeStage < i;

                    return (
                        <React.Fragment key={agent.id}>
                            <div style={{
                                ...styles.agentCard,
                                background: isDone ? agent.accent : isActive ? agent.accent : 'rgba(255,255,255,0.02)',
                                border: `1px solid ${isDone || isActive ? agent.border : 'rgba(255,255,255,0.07)'}`,
                                opacity: isPending && status === 'idle' ? 0.6 : 1,
                                transition: 'all 0.4s ease',
                            }}>
                                <div style={{
                                    ...styles.agentIconWrap,
                                    background: isDone || isActive ? agent.accent : 'rgba(255,255,255,0.04)',
                                    border: `1px solid ${isDone || isActive ? agent.border : 'rgba(255,255,255,0.07)'}`,
                                }}>
                                    {isActive
                                        ? <div style={{ ...styles.spinner, borderTopColor: agent.color }} />
                                        : isDone
                                            ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={agent.color} strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                                            : <Icon size={12} color={agent.color} />
                                    }
                                </div>
                                <div style={{ ...styles.agentName, color: isDone || isActive ? agent.color : 'rgba(255,255,255,0.4)' }}>
                                    {agent.name}
                                </div>
                                <div style={styles.agentRole}>{agent.role}</div>
                                <div style={{
                                    ...styles.agentStatus,
                                    color: isActive ? agent.color : isDone ? agent.color : 'rgba(255,255,255,0.2)',
                                }}>
                                    {isActive ? '● Running' : isDone ? '✓ Done' : '○ Waiting'}
                                </div>
                            </div>
                            {i < AGENTS.length - 1 && (
                                <ChevronRight size={16} color={isDone ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            {/* Run button */}
            {status === 'idle' && (
                <div style={styles.runWrap}>
                    <button onClick={run} style={styles.runBtn} id="orchestrate-run-btn">
                        <Play size={13} />
                        {t(language, 'orchRunBtn')}
                    </button>
                    <div style={styles.runHint}>
                        {t(language, 'analyzeHint')}
                    </div>
                </div>
            )}

            {/* Running state */}
            {status === 'running' && (
                <div style={styles.runningBanner}>
                    <div style={styles.spinner2} />
                    <span>
                        {activeStage === 0 && t(language, 'stage0')}
                        {activeStage === 1 && t(language, 'stage1')}
                        {activeStage === 2 && t(language, 'stage2')}
                    </span>
                </div>
            )}

            {/* Error */}
            {status === 'error' && (
                <div style={styles.errorBox}>
                    <AlertTriangle size={13} color="#f87171" />
                    <pre style={styles.errorPre}>{error}</pre>
                </div>
            )}

            {/* Results */}
            {status === 'done' && results && (
                <div style={styles.resultsWrap}>
                    {/* Scanner summary */}
                    <div style={styles.resultSection}>
                        <div style={styles.sectionTitle}>
                            <ShieldCheck size={12} color="#f87171" />
                            <span style={{ color: '#f87171' }}>{t(language, 'scanSummary')}</span>
                            <span style={styles.badge}>{results.scanner?.count ?? 0} {t(language, 'findingsCnt')}</span>
                        </div>
                        <div style={styles.findingsList}>
                            {(results.scanner?.findings || []).slice(0, 5).map((f, i) => (
                                <div key={i} style={styles.findingRow}>
                                    <span style={{ ...styles.severityDot, background: getSeverityColor(f.severity) }} />
                                    <span style={{ ...styles.severityTag, color: getSeverityColor(f.severity) }}>{f.severity}</span>
                                    <span style={styles.findingTitle}>{f.title || f.description?.slice(0, 60) || f.id}</span>
                                </div>
                            ))}
                            {(results.scanner?.findings || []).length === 0 && (
                                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{t(language, 'noScanner')}</div>
                            )}
                        </div>
                    </div>

                    {/* Verifier summary */}
                    <div style={styles.resultSection}>
                        <div style={styles.sectionTitle}>
                            <FlaskConical size={12} color="#34d399" />
                            <span style={{ color: '#34d399' }}>{t(language, 'vResults')}</span>
                            <span style={{ ...styles.badge, background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>
                                {results.verifier?.confirmed ?? 0} {t(language, 'confirmed')}
                            </span>
                        </div>
                        <div style={styles.verifyList}>
                            {(results.verifier?.verifiedFindings || []).slice(0, 5).map((f, i) => (
                                <div key={i} style={styles.verifyRow}>
                                    <span style={{ color: f.verified !== false ? '#34d399' : '#f87171', fontSize: 10 }}>
                                        {f.verified !== false ? '✓' : '✗'}
                                    </span>
                                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                                        {f.id || `Finding ${i + 1}`}
                                    </span>
                                    {f.confidence != null && (
                                        <span style={styles.confidencePill}>{f.confidence}{t(language, 'confLvl')}</span>
                                    )}
                                    {f.verifierNote && (
                                        <span style={styles.verifierNote}>{f.verifierNote.slice(0, 60)}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Synthesis report */}
                    <div style={{ ...styles.resultSection, flex: 1 }}>
                        <div style={styles.sectionTitle}>
                            <FileText size={12} color="#818cf8" />
                            <span style={{ color: '#818cf8' }}>{t(language, 'sReport')}</span>
                            <span style={{ ...styles.badge, background: 'rgba(129,140,248,0.1)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.2)' }}>
                                Executive Summary
                            </span>
                        </div>
                        <div style={styles.reportBox}>
                            <pre style={styles.reportPre}>{results.synthesizer?.report || t(language, 'noReport')}</pre>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
        @keyframes spinAgent { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes spinAgent2 { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
        </div>
    );
}

const styles = {
    root: {
        display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
        background: 'var(--bg-layer1)', fontFamily: "'Inter', sans-serif",
    },
    header: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
    },
    headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
    headerIcon: {
        width: 32, height: 32, borderRadius: 8,
        background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 13, fontWeight: 700, color: '#e2e8f0' },
    headerSub: { fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 },
    resetBtn: {
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 6, padding: '4px 12px', color: 'rgba(255,255,255,0.5)',
        fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
    },

    pipelineRow: {
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0,
    },
    agentCard: {
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        padding: '12px 14px', borderRadius: 10, minWidth: 110,
        transition: 'all 0.4s ease',
    },
    agentIconWrap: {
        width: 34, height: 34, borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    agentName: { fontSize: 11, fontWeight: 700, textAlign: 'center', transition: 'color 0.4s' },
    agentRole: { fontSize: 9, color: 'rgba(255,255,255,0.3)', textAlign: 'center', letterSpacing: '0.02em' },
    agentStatus: { fontSize: 9, fontWeight: 600, letterSpacing: '0.04em', marginTop: 2 },

    spinner: {
        width: 14, height: 14, borderRadius: '50%',
        border: '2px solid rgba(255,255,255,0.1)',
        animation: 'spinAgent 0.7s linear infinite',
    },

    runWrap: {
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '28px 16px', gap: 10,
    },
    runBtn: {
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: '10px 28px', borderRadius: 10,
        background: 'linear-gradient(135deg, rgba(129,140,248,0.2), rgba(99,102,241,0.3))',
        border: '1px solid rgba(129,140,248,0.35)', color: '#c7d2fe',
        fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
        transition: 'all 0.15s', letterSpacing: '0.01em',
    },
    runHint: { fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'center' },

    runningBanner: {
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', background: 'rgba(129,140,248,0.06)',
        borderBottom: '1px solid rgba(129,140,248,0.12)',
        fontSize: 12, color: '#a5b4fc', flexShrink: 0,
    },
    spinner2: {
        width: 14, height: 14, borderRadius: '50%',
        border: '2px solid rgba(165,180,252,0.2)',
        borderTopColor: '#a5b4fc',
        animation: 'spinAgent2 0.7s linear infinite',
        flexShrink: 0,
    },

    errorBox: {
        display: 'flex', gap: 8, padding: '12px 16px',
        background: 'rgba(248,113,113,0.06)', borderBottom: '1px solid rgba(248,113,113,0.15)',
        alignItems: 'flex-start',
    },
    errorPre: {
        margin: 0, fontSize: 11, color: '#fca5a5',
        whiteSpace: 'pre-wrap', fontFamily: "'JetBrains Mono', monospace",
    },

    resultsWrap: {
        flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0,
    },
    resultSection: {
        borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '12px 16px', flexShrink: 0,
    },
    sectionTitle: {
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 11, fontWeight: 700, marginBottom: 8,
    },
    badge: {
        fontSize: 9, padding: '2px 7px', borderRadius: 4,
        background: 'rgba(248,113,113,0.1)', color: '#f87171',
        border: '1px solid rgba(248,113,113,0.2)', fontWeight: 700,
    },

    findingsList: { display: 'flex', flexDirection: 'column', gap: 4 },
    findingRow: { display: 'flex', alignItems: 'center', gap: 6 },
    severityDot: { width: 6, height: 6, borderRadius: '50%', flexShrink: 0 },
    severityTag: { fontSize: 9, fontWeight: 800, minWidth: 50, letterSpacing: '0.05em' },
    findingTitle: { fontSize: 11, color: 'rgba(255,255,255,0.55)' },

    verifyList: { display: 'flex', flexDirection: 'column', gap: 4 },
    verifyRow: { display: 'flex', alignItems: 'center', gap: 6 },
    confidencePill: {
        fontSize: 9, padding: '1px 5px', borderRadius: 3,
        background: 'rgba(52,211,153,0.08)', color: '#34d399',
        border: '1px solid rgba(52,211,153,0.15)', fontWeight: 700,
    },
    verifierNote: { fontSize: 10, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' },

    reportBox: { flex: 1, overflowY: 'auto', marginTop: 4 },
    reportPre: {
        margin: 0, fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11, lineHeight: 1.7, color: 'rgba(255,255,255,0.7)',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    },
};
