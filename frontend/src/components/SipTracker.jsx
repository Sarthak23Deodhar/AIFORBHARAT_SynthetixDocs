import React, { useState, useEffect, useMemo } from 'react';
import { Search, ExternalLink, Filter, RefreshCw, Bot, ChevronDown, ChevronUp, Tag, ScrollText } from 'lucide-react';
import { t } from '../utils/translations';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const STATUS_COLORS = {
    sip: { bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.3)', text: '#818cf8' },
    sccp: { bg: 'rgba(244,114,182,0.12)', border: 'rgba(244,114,182,0.3)', text: '#f472b6' },
};

const MOCK_PROPOSALS = [
    { id: 'SIP-420', kind: 'sip', number: 420, htmlUrl: 'https://sips.synthetix.io/sips/sip-420', githubUrl: 'https://github.com/Synthetixio/SIPs/blob/master/content/sips/sip-420.md' },
    { id: 'SIP-373', kind: 'sip', number: 373, htmlUrl: 'https://sips.synthetix.io/sips/sip-373', githubUrl: 'https://github.com/Synthetixio/SIPs/blob/master/content/sips/sip-373.md' },
    { id: 'SCCP-300', kind: 'sccp', number: 300, htmlUrl: 'https://sips.synthetix.io/sccps/sccp-300', githubUrl: 'https://github.com/Synthetixio/SIPs/blob/master/content/sccp/sccp-300.md' },
];

export default function SipTracker({ language, skillLevel, user }) {
    const [proposals, setProposals] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all'); // all | sip | sccp
    const [summaries, setSummaries] = useState({});
    const [loadingSummary, setLoadingSummary] = useState({});
    const [expanded, setExpanded] = useState({});
    const [statsMode, setStatsMode] = useState(false);

    const fetchProposals = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE}/api/governance?type=${filter === 'all' ? 'all' : filter}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setProposals(data.proposals || []);
        } catch (e) {
            setError('Backend not reachable — showing sample proposals. Deploy the backend to load live SIPs.');
            // Show mock data so the UI isn't blank
            setProposals(MOCK_PROPOSALS);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchProposals(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        return proposals
            .filter(p => filter === 'all' || p.kind === filter)
            .filter(p => !q || p.id.toLowerCase().includes(q) || String(p.number).includes(q));
    }, [proposals, search, filter]);

    const handleSummarize = async (proposal) => {
        const id = proposal.id;
        if (summaries[id]) {
            setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
            return;
        }
        setLoadingSummary(prev => ({ ...prev, [id]: true }));
        setExpanded(prev => ({ ...prev, [id]: true }));
        try {
            const res = await fetch(`${API_BASE}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: `Summarize what Synthetix ${proposal.kind.toUpperCase()} #${proposal.number} typically covers. Synthetix Improvement Proposals (SIPs) are governance documents for the Synthetix DeFi protocol. Provide a concise 3-4 sentence overview of what such a proposal in the ${proposal.number > 300 ? 'recent' : 'early'} era would address, covering its purpose, mechanism, and impact on the protocol. Keep it educational.`,
                    language, skill_level: skillLevel,
                    userId: user?.username || 'anonymous',
                    history: []
                })
            });
            const data = await res.json();
            setSummaries(prev => ({ ...prev, [id]: data.response || 'No summary available.' }));
        } catch {
            setSummaries(prev => ({ ...prev, [id]: '⚠️ Backend not reachable. Deploy the serverless backend first.' }));
        } finally {
            setLoadingSummary(prev => ({ ...prev, [id]: false }));
        }
    };

    const sipCount = proposals.filter(p => p.kind === 'sip').length;
    const sccpCount = proposals.filter(p => p.kind === 'sccp').length;

    return (
        <div style={styles.root}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.headerLeft}>
                    <div style={styles.headerIcon}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2.5">
                            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <div>
                        <div style={styles.headerTitle}>Documentation Governance</div>
                        <div style={styles.headerSub}>Synthetix Improvement Proposals &amp; Configuration Changes</div>
                    </div>
                </div>
                <button onClick={fetchProposals} style={styles.refreshBtn} title="Refresh from GitHub">
                    <RefreshCw size={13} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
                </button>
            </div>

            {/* Stats row */}
            <div style={styles.statsRow}>
                <div style={{ ...styles.statCard, borderColor: 'rgba(99,102,241,0.3)' }}>
                    <span style={{ color: '#818cf8', fontWeight: 700, fontSize: 18 }}>{sipCount}</span>
                    <span style={styles.statLabel}>SIPs</span>
                </div>
                <div style={{ ...styles.statCard, borderColor: 'rgba(244,114,182,0.3)' }}>
                    <span style={{ color: '#f472b6', fontWeight: 700, fontSize: 18 }}>{sccpCount}</span>
                    <span style={styles.statLabel}>SCCPs</span>
                </div>
                <div style={{ ...styles.statCard, borderColor: 'rgba(255,255,255,0.1)' }}>
                    <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 18 }}>{proposals.length}</span>
                    <span style={styles.statLabel}>Total</span>
                </div>
                <div style={styles.poweredBy}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="#6e737a" stroke="none"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
                    <span style={{ color: '#6e737a', fontSize: 10 }}>Synthetix GitHub</span>
                </div>
            </div>

            {/* Error banner */}
            {error && (
                <div style={styles.errorBanner}>
                    <span style={{ fontSize: 11 }}>⚠️ {error}</span>
                </div>
            )}

            {/* Filter + Search */}
            <div style={styles.controls}>
                <div style={styles.filterGroup}>
                    {['all', 'sip', 'sccp'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            style={{ ...styles.filterBtn, ...(filter === f ? styles.filterBtnActive : {}) }}
                        >
                            <Filter size={10} />
                            {f.toUpperCase()}
                        </button>
                    ))}
                </div>
                <div style={styles.searchWrap}>
                    <Search size={11} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={t(language, 'searchPlaceholder')}
                        style={styles.searchInput}
                    />
                </div>
            </div>

            {/* Proposal list */}
            <div style={styles.listHeader}>
                <ScrollText size={16} color="#c084fc" />
                <span style={styles.title}>{t(language, 'govTitle')}</span>
            </div>
            <div style={styles.subtitle}>
                {t(language, 'govSubtitle')}
            </div>
            <div style={styles.listWrap}>
                {loading ? (
                    <div style={styles.loader}>
                        <div style={styles.spinnerRing} />
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 10 }}>{t(language, 'sipTrackerLoading')}</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={styles.emptyState}>
                        <Tag size={28} style={{ color: 'rgba(255,255,255,0.15)', marginBottom: 8 }} />
                        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>{t(language, 'noProposals')}</div>
                    </div>
                ) : (
                    filtered.map(p => {
                        const colors = STATUS_COLORS[p.kind] || STATUS_COLORS.sip;
                        const isExpanded = expanded[p.id];
                        const summary = summaries[p.id];
                        const isLoadingS = loadingSummary[p.id];
                        return (
                            <div key={p.id} style={styles.row}>
                                <div style={styles.rowMain}>
                                    {/* Badge */}
                                    <span style={{ ...styles.kindBadge, background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}>
                                        {p.kind.toUpperCase()}
                                    </span>
                                    {/* Number */}
                                    <span style={styles.rowNum}>#{p.number}</span>
                                    {/* ID */}
                                    <span style={styles.rowId}>{p.id}</span>

                                    <div style={{ flex: 1 }} />

                                    {/* AI Summarize */}
                                    <button onClick={() => handleSummarize(p)} style={styles.summarizeBtn} title={t(language, 'summarizeBtn')}>
                                        <Bot size={11} />
                                        {isLoadingS ? t(language, 'loading') : summary ? (isExpanded ? t(language, 'hide') : t(language, 'show')) : t(language, 'summarize')}
                                        {summary && (isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
                                    </button>

                                    {/* Links */}
                                    <a href={p.htmlUrl} target="_blank" rel="noopener noreferrer" style={styles.linkBtn} title={t(language, 'viewOnSips')}>
                                        <ExternalLink size={11} />
                                    </a>
                                </div>

                                {/* Expanded summary */}
                                {isExpanded && (
                                    <div style={styles.summaryBox}>
                                        {isLoadingS
                                            ? <span style={styles.summaryLoading}>{t(language, 'askingBedrock')}</span>
                                            : <pre style={styles.summaryPre}>{summary}</pre>
                                        }
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Footer */}
            <div style={styles.footer}>
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>
                    Showing {filtered.length} of {proposals.length} proposals · Live data from Synthetix GitHub
                </span>
            </div>

            <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes spinRing { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
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
        background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 13, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.01em' },
    headerSub: { fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 },
    refreshBtn: {
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 6, padding: '5px 8px', color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
        display: 'flex', alignItems: 'center',
    },
    statsRow: {
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0,
    },
    statCard: {
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        flex: 1, padding: '8px 4px', borderRadius: 8,
        background: 'rgba(255,255,255,0.02)', border: '1px solid',
        gap: 2,
    },
    statLabel: { fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' },
    poweredBy: { display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' },
    errorBanner: {
        padding: '7px 16px', background: 'rgba(251,191,36,0.08)',
        borderBottom: '1px solid rgba(251,191,36,0.15)', color: '#fbbf24', flexShrink: 0,
    },
    controls: {
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0,
    },
    filterGroup: { display: 'flex', gap: 4 },
    filterBtn: {
        display: 'inline-flex', alignItems: 'center', gap: 3,
        padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)',
        background: 'transparent', color: 'rgba(255,255,255,0.3)',
        fontSize: 10, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
        letterSpacing: '0.05em', transition: 'all 0.15s',
    },
    filterBtnActive: {
        background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
        color: '#818cf8',
    },
    searchWrap: {
        flex: 1, display: 'flex', alignItems: 'center', gap: 6,
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 7, padding: '5px 10px',
    },
    searchInput: {
        flex: 1, background: 'transparent', border: 'none', outline: 'none',
        color: 'rgba(255,255,255,0.7)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
    },
    listWrap: { flex: 1, overflowY: 'auto', padding: '6px 0' },
    loader: {
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: 160, gap: 4,
    },
    spinnerRing: {
        width: 28, height: 28, borderRadius: '50%',
        border: '3px solid rgba(99,102,241,0.15)',
        borderTopColor: '#818cf8',
        animation: 'spinRing 0.8s linear infinite',
    },
    emptyState: {
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: 120, gap: 6,
    },
    row: {
        borderBottom: '1px solid rgba(255,255,255,0.035)', transition: 'background 0.1s',
    },
    rowMain: {
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '9px 16px', cursor: 'default',
    },
    kindBadge: {
        fontSize: 9, fontWeight: 800, letterSpacing: '0.08em',
        padding: '2px 7px', borderRadius: 4,
        flexShrink: 0,
    },
    rowNum: {
        fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
        color: 'rgba(255,255,255,0.55)', fontWeight: 600, minWidth: 40,
    },
    rowId: {
        fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
        color: 'rgba(255,255,255,0.75)', fontWeight: 700,
    },
    summarizeBtn: {
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '3px 8px', borderRadius: 5,
        border: '1px solid rgba(139,92,246,0.2)', background: 'rgba(139,92,246,0.06)',
        color: '#a78bfa', fontSize: 10, fontWeight: 600, cursor: 'pointer',
        fontFamily: 'inherit', transition: 'all 0.15s',
    },
    linkBtn: {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 24, height: 24, borderRadius: 5,
        border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
        color: 'rgba(255,255,255,0.35)', textDecoration: 'none', flexShrink: 0,
        transition: 'all 0.15s',
    },
    summaryBox: {
        padding: '8px 16px 12px 40px',
        background: 'rgba(139,92,246,0.03)',
        borderTop: '1px solid rgba(139,92,246,0.1)',
    },
    summaryLoading: { color: 'rgba(255,255,255,0.3)', fontSize: 11, fontStyle: 'italic' },
    summaryPre: {
        margin: 0, fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11, lineHeight: 1.6, color: 'rgba(255,255,255,0.65)',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    },
    footer: {
        padding: '7px 16px', borderTop: '1px solid rgba(255,255,255,0.04)',
        flexShrink: 0, background: 'rgba(255,255,255,0.01)',
    },
};
