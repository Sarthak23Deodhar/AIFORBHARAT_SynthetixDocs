import React, { useEffect, useRef, useState } from 'react';
import FlowDiagram from './FlowDiagram';
import { Play, Pause, Activity, ShieldCheck, Cpu, Zap, AlertTriangle, Volume2, Download } from 'lucide-react';
import { fetchWithFallback } from '../mockData';
import { t } from '../utils/translations';

const API_BASE = 'https://ihm3s4vc87.execute-api.us-east-1.amazonaws.com/dev/api';

// ─── Proper Markdown Renderer ───────────────────────────────────────────────
// CRITICAL FIX: We must NOT escape HTML first and then inject HTML tags.
// Instead we process markdown properly: escape only inside code blocks,
// then apply markdown transformations to the rest.
const renderMarkdown = (text) => {
    if (!text) return null;

    // Step 1: Extract code blocks FIRST so we don't process them as markdown
    const codeBlocks = [];
    let processed = text.replace(/```([\s\S]*?)```/g, (_, code) => {
        // Escape HTML inside code blocks only
        const safeCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const idx = codeBlocks.length;
        codeBlocks.push(`<pre style="background:rgba(0,0,0,0.6);padding:16px;border-radius:10px;overflow-x:auto;margin:1em 0;border:1px solid rgba(255,255,255,0.1);"><code style="color:#E2E8F0;font-family:'JetBrains Mono',monospace;font-size:13px;line-height:1.6;">${safeCode}</code></pre>`);
        return `%%CODEBLOCK_${idx}%%`;
    });

    // Step 2: Process inline code
    const inlineCodes = [];
    processed = processed.replace(/`([^`]+)`/g, (_, code) => {
        const safeCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const idx = inlineCodes.length;
        inlineCodes.push(`<code style="color:#60A5FA;background:rgba(96,165,250,0.1);padding:2px 6px;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:0.875em;">${safeCode}</code>`);
        return `%%INLINE_${idx}%%`;
    });

    // Step 3: Apply markdown formatting (no HTML escaping needed here because code is extracted)
    processed = processed
        // Headings
        .replace(/^#### (.*$)/gim, '<h4 style="color:#CBD5E1;margin-top:1.2em;margin-bottom:0.4em;font-size:1em;font-weight:700;">$1</h4>')
        .replace(/^### (.*$)/gim, '<h3 style="color:#F1F5F9;margin-top:1.5em;margin-bottom:0.5em;font-size:1.05em;font-weight:700;padding-bottom:0.3em;border-bottom:1px solid rgba(255,255,255,0.05);">$1</h3>')
        .replace(/^## (.*$)/gim, '<h2 style="color:#FFFFFF;margin-top:1.8em;margin-bottom:0.6em;font-size:1.2em;font-weight:800;padding-bottom:0.4em;border-bottom:1px solid rgba(59,130,246,0.3);">$1</h2>')
        .replace(/^# (.*$)/gim, '<h1 style="color:#FFFFFF;margin-top:2em;margin-bottom:0.8em;font-size:1.5em;font-weight:800;background:linear-gradient(90deg,#60A5FA,#A78BFA);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">$1</h1>')
        // Bold and italic
        .replace(/\*\*\*(.*?)\*\*\*/g, '<strong style="color:#F8FAFC;font-weight:700;"><em>$1</em></strong>')
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#F8FAFC;font-weight:600;">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em style="color:#CBD5E1;">$1</em>')
        // Blockquote
        .replace(/^> (.*$)/gim, '<blockquote style="border-left:3px solid #3B82F6;padding:8px 16px;margin:1em 0;background:rgba(59,130,246,0.05);border-radius:0 8px 8px 0;color:#94A3B8;">$1</blockquote>')
        // Horizontal rule
        .replace(/^(-{3,}|_{3,}|\*{3,})$/gim, '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:1.5em 0;"/>')
        // Unordered list items
        .replace(/^[\s]*[-*+] (.*$)/gim, '<li style="margin-left:20px;margin-bottom:6px;line-height:1.7;color:#94A3B8;list-style-type:disc;">$1</li>')
        // Ordered list items
        .replace(/^[\s]*\d+\. (.*$)/gim, '<li style="margin-left:20px;margin-bottom:6px;line-height:1.7;color:#94A3B8;list-style-type:decimal;">$1</li>')
        // Double newlines to paragraphs
        .replace(/\n\n+/g, '</p><p style="margin-bottom:0.8em;color:#94A3B8;line-height:1.75;">')
        // Single newlines to line breaks (only if not already html)
        .replace(/\n/g, '<br/>');

    // Wrap in paragraph
    processed = `<p style="margin-bottom:0.8em;color:#94A3B8;line-height:1.75;">${processed}</p>`;

    // Step 4: Restore code blocks
    codeBlocks.forEach((block, i) => {
        processed = processed.replace(`%%CODEBLOCK_${i}%%`, block);
    });
    inlineCodes.forEach((code, i) => {
        processed = processed.replace(`%%INLINE_${i}%%`, code);
    });

    return <div dangerouslySetInnerHTML={{ __html: processed }} style={{ fontSize: '14px', lineHeight: '1.75' }} />;
};

// ─── Severity config ────────────────────────────────────────────────────────
const severityConfig = {
    Critical: { color: '#F87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)' },
    High: { color: '#FB923C', bg: 'rgba(251,146,60,0.08)', border: 'rgba(251,146,60,0.2)' },
    Medium: { color: '#FBBF24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)' },
    Low: { color: '#A3E635', bg: 'rgba(163,230,53,0.08)', border: 'rgba(163,230,53,0.2)' },
    Info: { color: '#60A5FA', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.2)' },
};

// ─── WikiViewer Component ────────────────────────────────────────────────────
const WikiViewer = ({ language, skillLevel, sourceCode }) => {
    const [content, setContent] = useState('');
    const [mermaidCode, setMermaidCode] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [advisory, setAdvisory] = useState(null);
    const [isSynthesizing, setIsSynthesizing] = useState(false);
    const [audioScript, setAudioScript] = useState('');
    const [activeTab, setActiveTab] = useState('docs'); // 'docs' | 'diagram' | 'security'
    const [audioPlaying, setAudioPlaying] = useState(false);
    const debounceRef = useRef(null);
    const mermaidRef = useRef(null);
    const audioRef = useRef(null);

    // Auto-generate docs when sourceCode changes (debounced 2s)
    useEffect(() => {
        if (!sourceCode || sourceCode.trim().length < 30) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            generateDocs();
        }, 2000);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [sourceCode]); // eslint-disable-line react-hooks/exhaustive-deps

    // Re-trigger documentation generation immediately when language changes
    const prevLangRef = useRef(language);
    useEffect(() => {
        if (prevLangRef.current !== language) {
            prevLangRef.current = language;
            // Only re-generate if we already generated something for the current code
            if (content && sourceCode && sourceCode.trim().length >= 30) {
                // Stop any playing audio since it's for the old language
                if (audioPlaying && audioRef.current) {
                    audioRef.current.pause();
                    setAudioPlaying(false);
                }
                generateDocs();
            }
        }
    }, [language, content, sourceCode, audioPlaying]); // eslint-disable-line react-hooks/exhaustive-deps


    const generateDocs = async () => {
        if (!sourceCode.trim()) return;
        setIsGenerating(true);
        setContent('');
        setMermaidCode('');
        setAdvisory(null);
        setActiveTab('docs');

        try {
            const wikiData = await fetchWithFallback(`${API_BASE}/generate-wiki`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code_snippet: sourceCode, language, skill_level: skillLevel })
            });

            setContent(wikiData.wiki_md || 'No documentation generated.');
            setMermaidCode(wikiData.mermaid_code || '');
            setAudioScript(wikiData.audio_text || '');

            // Security scan in parallel
            const scanData = await fetchWithFallback(`${API_BASE}/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code_snippet: sourceCode })
            });
            if (scanData.advisories?.length > 0) setAdvisory(scanData.advisories[0]);
        } catch (err) {
            console.error(err);
            setContent('⚠️ Error connecting to the AI engine. Make sure AWS credentials are configured.');
        } finally {
            setIsGenerating(false);
        }
    };

    const synthesizeAudio = async () => {
        setIsSynthesizing(true);
        try {
            const textToSpeak = audioScript || 'Documentation is ready.';
            const data = await fetchWithFallback(`${API_BASE}/audio`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: textToSpeak, language })
            });
            if (data.audio_url) {
                if (audioRef.current) {
                    audioRef.current.src = data.audio_url;
                    audioRef.current.play();
                    setAudioPlaying(true);
                }
            } else if (data.audio_base64) {
                const bytes = atob(data.audio_base64);
                const arr = new Uint8Array(bytes.length);
                for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
                const blob = new Blob([arr], { type: 'audio/mpeg' });
                const url = URL.createObjectURL(blob);
                if (audioRef.current) {
                    audioRef.current.src = url;
                    audioRef.current.play();
                    setAudioPlaying(true);
                    audioRef.current.onended = () => URL.revokeObjectURL(url);
                }
            }
        } catch (err) {
            console.error(err);
            alert('Audio synthesis failed. Check backend and AWS credentials.');
        } finally {
            setIsSynthesizing(false);
        }
    };

    const sev = advisory ? (severityConfig[advisory.severity] || severityConfig.Info) : null;

    const tabs = [
        { id: 'docs', label: t(language, 'tabDocs'), show: true },
        { id: 'diagram', label: t(language, 'tabDiagram'), show: true },
        { id: 'security', label: t(language, 'tabSecurity'), show: true },
    ];

    return (
        <div style={styles.container}>
            <audio
                ref={audioRef}
                onEnded={() => setAudioPlaying(false)}
                onPause={() => setAudioPlaying(false)}
                style={{ display: 'none' }}
            />

            {/* ── Top Toolbar ── */}
            <div style={styles.toolbar}>
                <div style={styles.statusArea}>
                    <div style={{
                        ...styles.statusDot,
                        background: isGenerating ? '#10b981' : content ? '#10b981' : '#475569',
                        boxShadow: isGenerating ? '0 0 10px #10b981' : content ? '0 0 8px #10b981' : 'none',
                        animation: isGenerating ? 'pulse-glow 1.5s infinite' : 'none',
                    }} />
                    <span style={styles.statusText}>
                        {isGenerating
                            ? <><Activity size={11} style={{ animation: 'spin 1s linear infinite', display: 'inline', marginRight: 5 }} />{t(language, 'statusGenerating')}</>
                            : content
                                ? t(language, 'statusReady')
                                : sourceCode?.trim().length >= 30
                                    ? 'Waiting to generate…'
                                    : 'Paste code to auto-generate docs'
                        }
                    </span>
                </div>

                <div style={styles.toolbarActions}>
                    {/* Download button — always show when docs exist */}
                    {content && !isGenerating && (
                        <button
                            style={styles.audioBtn}
                            onClick={() => {
                                const blob = new Blob([content], { type: 'text/markdown' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `docs-${Date.now()}.md`;
                                a.click();
                                URL.revokeObjectURL(url);
                            }}
                            title="Download as Markdown"
                        >
                            <Download size={13} /> .md
                        </button>
                    )}
                    {content && !isGenerating && (
                        <button
                            style={{ ...styles.audioBtn, opacity: isSynthesizing ? 0.7 : 1 }}
                            onClick={() => {
                                if (audioPlaying) {
                                    audioRef.current.pause();
                                    setAudioPlaying(false);
                                } else {
                                    if (audioRef.current && audioRef.current.src) {
                                        audioRef.current.play();
                                        setAudioPlaying(true);
                                    } else {
                                        synthesizeAudio();
                                    }
                                }
                            }}
                            disabled={isSynthesizing}
                        >
                            {isSynthesizing
                                ? <><Activity size={13} style={{ animation: 'spin 1s linear infinite' }} /> {t(language, 'btnSynthesizing')}</>
                                : audioPlaying
                                    ? <><Pause size={13} /> Pause Audio</>
                                    : <><Play size={13} /> {t(language, 'btnListen')}</>
                            }
                        </button>
                    )}
                    {/* No manual Generate button — docs auto-update on code change */}
                </div>
            </div>

            {/* ── Tab Navigation ── */}
            {content && !isGenerating && (
                <div style={styles.tabBar}>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                ...styles.tabBtn,
                                ...(activeTab === tab.id ? styles.tabBtnActive : {}),
                            }}
                        >
                            {tab.label}
                            {tab.id === 'security' && advisory && (
                                <span style={{ ...styles.secBadge, background: sev.bg, color: sev.color, border: `1px solid ${sev.border}` }}>
                                    {advisory.severity}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* ── Content Area ── */}
            <div style={styles.contentArea}>
                {/* Loading state */}
                {isGenerating && (
                    <div style={styles.loadingState}>
                        <div style={styles.loadingRing}>
                            <Activity size={32} color="#3B82F6" style={{ animation: 'spin 1s linear infinite' }} />
                        </div>
                        <p style={styles.loadingTitle}>{t(language, 'loadingTitle')}</p>
                        <p style={styles.loadingSubtitle}>{t(language, 'loadingSubtitle')}</p>
                        <div style={styles.loadingSteps}>
                            {[t(language, 'step1'), t(language, 'step2'), t(language, 'step3'), t(language, 'step4')].map((step, i) => (
                                <div key={step} style={{ ...styles.loadingStep, animationDelay: `${i * 0.4}s` }}>
                                    <span style={styles.loadingStepDot} />
                                    <span>{step}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {!isGenerating && !content && (
                    <div style={styles.emptyState}>
                        <div style={styles.emptyGlow} />
                        <div style={styles.emptyIconWrap}>
                            <Cpu size={36} color="#3B82F6" />
                        </div>
                        <h3 style={styles.emptyTitle}>{t(language, 'emptyTitle')}</h3>
                        <p style={styles.emptySubtitle}>{t(language, 'emptySubtitle')} <strong style={{ color: '#3B82F6' }}>{t(language, 'btnGenerate')}</strong></p>
                        <p style={styles.emptyHint}>{t(language, 'emptyHint')}</p>
                        <div style={styles.featurePills}>
                            {['📝 Markdown Docs', '🗺️ Architecture Diagram', '🔒 Security Scan', '🎙️ Audio Walkthrough'].map(f => (
                                <span key={f} style={styles.featurePill}>{f}</span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Docs Tab */}
                {!isGenerating && content && activeTab === 'docs' && (
                    <div style={styles.docsPane}>
                        {renderMarkdown(content)}
                    </div>
                )}

                {/* Diagram Tab — React Flow */}
                {!isGenerating && content && activeTab === 'diagram' && (
                    <div style={{ ...styles.diagramPane, minHeight: 360 }}>
                        <FlowDiagram mermaidCode={mermaidCode} />
                    </div>
                )}

                {/* Security Tab */}
                {!isGenerating && content && activeTab === 'security' && (
                    <div style={styles.securityPane}>
                        {advisory ? (
                            <>
                                <div style={{ ...styles.sevHeader, background: sev.bg, border: `1px solid ${sev.border}` }}>
                                    <ShieldCheck size={20} color={sev.color} />
                                    <div>
                                        <div style={{ ...styles.sevTitle, color: sev.color }}>{advisory.severity} Severity — {advisory.id}</div>
                                        <div style={styles.sevSub}>OWASP Vulnerability Scan by Amazon Bedrock</div>
                                    </div>
                                    <span style={{ ...styles.sevPill, background: sev.bg, color: sev.color, border: `1px solid ${sev.border}` }}>
                                        {advisory.severity}
                                    </span>
                                </div>

                                <div style={styles.sevBlock}>
                                    <div style={styles.sevBlockLabel}>🔍 Finding</div>
                                    <p style={styles.sevBlockText}>{advisory.description}</p>
                                </div>

                                <div style={{ ...styles.sevBlock, borderColor: 'rgba(251,191,36,0.2)', background: 'rgba(251,191,36,0.04)' }}>
                                    <div style={{ ...styles.sevBlockLabel, color: '#FBBF24' }}>🔧 Remediation</div>
                                    <p style={styles.sevBlockText}>{advisory.remediation}</p>
                                </div>
                            </>
                        ) : (
                            <div style={styles.emptyState}>
                                <div style={styles.emptyIconWrap}>✅</div>
                                <h3 style={{ ...styles.emptyTitle, color: '#10B981' }}>{t(language, 'emptyClean')}</h3>
                                <p style={styles.emptySubtitle}>{t(language, 'emptyCleanSub')}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-layer1)',
        overflow: 'hidden',
    },
    toolbar: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 20px',
        background: 'var(--bg-base)',
        borderBottom: '1px solid var(--border-soft)',
        flexShrink: 0,
    },
    statusArea: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    statusDot: {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        transition: 'all 0.3s',
        flexShrink: 0,
    },
    statusText: {
        fontSize: '12px',
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-muted)',
        fontWeight: '500',
    },
    toolbarActions: {
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
    },
    audioBtn: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '7px 14px',
        background: 'var(--bg-layer1)',
        color: 'var(--warning)',
        border: 'none',
        boxShadow: 'var(--clay-drop), var(--clay-inset-light), var(--clay-inset-dark)',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: '600',
        fontFamily: 'var(--font-body)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    },
    tabBar: {
        display: 'flex',
        gap: '6px',
        padding: '8px 16px',
        background: 'var(--bg-layer1)',
        boxShadow: 'var(--clay-drop), var(--clay-inset-light), var(--clay-inset-dark)',
        flexShrink: 0,
    },
    tabBtn: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 14px',
        fontSize: '12px',
        fontWeight: '600',
        cursor: 'pointer',
        borderRadius: '8px',
        border: 'none',
        background: 'var(--bg-layer1)',
        color: 'var(--text-secondary)',
        boxShadow: 'var(--clay-drop), var(--clay-inset-light), var(--clay-inset-dark)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        fontFamily: 'var(--font-body)',
    },
    tabBtnActive: {
        background: 'var(--bg-layer2)',
        color: 'var(--saffron)',
        boxShadow: 'inset 3px 3px 6px rgba(0,0,0,0.05), inset -3px -3px 6px rgba(255,255,255,0.6)',
    },
    secBadge: {
        fontSize: '9px',
        fontWeight: '800',
        letterSpacing: '0.06em',
        padding: '1px 6px',
        borderRadius: '999px',
        textTransform: 'uppercase',
        marginLeft: '4px',
    },
    contentArea: {
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        padding: '24px',
    },
    // Loading
    loadingState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        height: '100%',
        minHeight: '300px',
    },
    loadingRing: {
        width: '72px',
        height: '72px',
        borderRadius: '50%',
        background: 'var(--bg-layer1)',
        boxShadow: 'var(--clay-drop), var(--clay-inset-light), var(--clay-inset-dark)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingTitle: {
        fontSize: '16px',
        fontWeight: '700',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-display)',
        margin: 0,
    },
    loadingSubtitle: {
        fontSize: '13px',
        color: 'var(--text-muted)',
        margin: 0,
        textAlign: 'center',
    },
    loadingSteps: {
        display: 'flex',
        gap: '20px',
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginTop: '8px',
    },
    loadingStep: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '11px',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)',
        animation: 'fadeInUp 0.5s ease forwards',
        opacity: 0,
    },
    loadingStepDot: {
        width: '5px',
        height: '5px',
        borderRadius: '50%',
        background: '#3B82F6',
        animation: 'pulse-glow 1.5s infinite',
    },
    // Empty state
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        height: '100%',
        minHeight: '300px',
        textAlign: 'center',
        position: 'relative',
    },
    emptyGlow: {
        position: 'absolute',
        width: '300px',
        height: '300px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
    },
    emptyIconWrap: {
        width: '72px',
        height: '72px',
        borderRadius: '20px',
        background: 'var(--bg-layer2)',
        boxShadow: 'inset 4px 4px 8px rgba(0,0,0,0.05), inset -4px -4px 8px rgba(255,255,255,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '32px',
    },
    emptyTitle: {
        fontSize: '18px',
        fontWeight: '700',
        color: 'var(--text-primary)',
        margin: 0,
        fontFamily: 'var(--font-display)',
    },
    emptySubtitle: {
        fontSize: '14px',
        color: 'var(--text-secondary)',
        margin: 0,
        maxWidth: '380px',
    },
    emptyHint: {
        fontSize: '12px',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)',
        margin: 0,
    },
    featurePills: {
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginTop: '8px',
    },
    featurePill: {
        padding: '4px 12px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: '600',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: 'var(--text-muted)',
    },
    // Docs pane
    docsPane: {
        color: 'var(--text-secondary)',
        lineHeight: '1.75',
    },
    // Diagram pane
    diagramPane: {
        flex: 1,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
        minHeight: '300px',
    },
    // Security pane
    securityPane: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
    },
    sevHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '16px 20px',
        borderRadius: '12px',
    },
    sevTitle: {
        fontSize: '14px',
        fontWeight: '700',
        marginBottom: '3px',
    },
    sevSub: {
        fontSize: '11px',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)',
    },
    sevPill: {
        marginLeft: 'auto',
        padding: '3px 12px',
        borderRadius: '999px',
        fontSize: '10px',
        fontWeight: '800',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        flexShrink: 0,
    },
    sevBlock: {
        padding: '16px 18px',
        borderRadius: '10px',
        background: 'rgba(248,113,113,0.04)',
        border: '1px solid rgba(248,113,113,0.15)',
    },
    sevBlockLabel: {
        fontSize: '11px',
        fontWeight: '700',
        color: '#F87171',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        marginBottom: '8px',
        fontFamily: 'var(--font-mono)',
    },
    sevBlockText: {
        fontSize: '13.5px',
        color: 'var(--text-secondary)',
        lineHeight: '1.65',
        margin: 0,
    },
};

export default WikiViewer;
