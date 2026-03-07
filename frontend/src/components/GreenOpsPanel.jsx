import React, { useState, useEffect, useRef } from 'react';
import { Leaf, Zap, TrendingDown, AlertTriangle, CheckCircle, RefreshCw, Globe } from 'lucide-react';
import { t } from '../utils/translations';

// ─── Simulated carbon data (mirrors design.md monthly report schema) ──────────
const BASELINE = {
    totalEmissions: 1.24,          // metric tons CO2e
    emissionsPerUser: 1.24,        // kg CO2e
    carbonEfficiency: 0.04,        // kg CO2e per 1000 requests
    renewableEnergyPercent: 38,
    breakdown: {
        lambda: 0.41,
        bedrock: 0.53,
        storage: 0.21,
        networking: 0.09,
    },
    optimizations: [
        { label: 'Batch audio generation – low carbon hours', saving: 15, done: true },
        { label: 'ARM Graviton processors (Lambda)', saving: 20, done: true },
        { label: 'Aggressive CloudFront caching', saving: 30, done: true },
        { label: 'S3 Intelligent-Tiering for audio', saving: 8, done: false },
        { label: 'Carbon-aware regional routing', saving: 12, done: false },
        { label: 'Bedrock prompt caching', saving: 18, done: false },
    ],
    regionCarbon: [
        { region: 'ap-south-1 (Mumbai)', intensity: 'Medium', pct: 40, color: '#FBBF24', active: true },
        { region: 'ap-southeast-1 (Singapore)', intensity: 'Low', pct: 30, color: '#34D399', active: false },
        { region: 'us-east-1 (N. Virginia)', intensity: 'Low', pct: 20, color: '#60A5FA', active: false },
    ],
    trend: [1.89, 1.72, 1.58, 1.44, 1.37, 1.24], // last 6 months
};

// ─── Animated counter hook ────────────────────────────────────────────────────
function useCountUp(target, duration = 1200) {
    const [val, setVal] = useState(0);
    useEffect(() => {
        let start = 0;
        const step = target / (duration / 16);
        const timer = setInterval(() => {
            start = Math.min(start + step, target);
            setVal(start);
            if (start >= target) clearInterval(timer);
        }, 16);
        return () => clearInterval(timer);
    }, [target, duration]);
    return val;
}

// ─── Pure-CSS Donut Chart ─────────────────────────────────────────────────────
const DonutChart = ({ segments, size = 120 }) => {
    const r = 40, cx = 60, cy = 60, circ = 2 * Math.PI * r;
    let offset = 0;
    const slices = segments.map(s => {
        const dash = (s.pct / 100) * circ;
        const slice = { ...s, dash, offset, gap: circ - dash };
        offset += dash;
        return slice;
    });
    return (
        <svg width={size} height={size} viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={14} />
            {slices.map((s, i) => (
                <circle key={i} cx={cx} cy={cy} r={r} fill="none"
                    stroke={s.color} strokeWidth={14}
                    strokeDasharray={`${s.dash} ${s.gap}`}
                    strokeDashoffset={-s.offset}
                    style={{ transition: 'stroke-dasharray 0.8s ease' }}
                />
            ))}
        </svg>
    );
};

// ─── Mini Trend Sparkline ─────────────────────────────────────────────────────
const Sparkline = ({ data, color = '#34D399', width = 160, height = 40 }) => {
    const max = Math.max(...data), min = Math.min(...data);
    const xStep = width / (data.length - 1);
    const pts = data.map((v, i) => {
        const x = i * xStep;
        const y = height - ((v - min) / (max - min + 0.01)) * (height - 8) - 4;
        return `${x},${y}`;
    }).join(' ');
    return (
        <svg width={width} height={height}>
            <defs>
                <linearGradient id="sg" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
            </defs>
            <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            {data.map((v, i) => (
                <circle key={i} cx={i * xStep} cy={parseFloat(pts.split(' ')[i]?.split(',')[1])} r={3}
                    fill={i === data.length - 1 ? color : 'transparent'} />
            ))}
        </svg>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const GreenOpsPanel = ({ language = 'en' }) => {
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState(BASELINE);

    const animEmissions = useCountUp(data.totalEmissions, 1000);
    const animRenewable = useCountUp(data.renewableEnergyPercent, 1400);
    const animEfficiency = useCountUp(data.carbonEfficiency * 1000, 1200); // ×1000 to show integer

    const total = Object.values(data.breakdown).reduce((a, b) => a + b, 0);
    const donutSegments = [
        { label: 'Lambda', pct: (data.breakdown.lambda / total) * 100, color: '#F97316' },
        { label: 'Bedrock', pct: (data.breakdown.bedrock / total) * 100, color: '#A78BFA' },
        { label: 'Storage', pct: (data.breakdown.storage / total) * 100, color: '#60A5FA' },
        { label: 'Network', pct: (data.breakdown.networking / total) * 100, color: '#34D399' },
    ];

    const handleRefresh = () => {
        setRefreshing(true);
        // Simulate a slight data variation on refresh
        setTimeout(() => {
            setData(prev => ({
                ...prev,
                totalEmissions: +(prev.totalEmissions - (Math.random() * 0.02)).toFixed(3),
                renewableEnergyPercent: Math.min(100, prev.renewableEnergyPercent + Math.floor(Math.random() * 2)),
            }));
            setRefreshing(false);
        }, 1200);
    };

    return (
        <div style={s.root}>
            {/* ── Header ── */}
            <div style={s.header}>
                <div style={s.headerLeft}>
                    <div style={s.leafBadge}><Leaf size={16} color="#34D399" /></div>
                    <div>
                        <h2 style={s.title}>{t(language, 'greenOpsDashboard')}</h2>
                        <p style={s.subtitle}>{t(language, 'awsCarbonFootprint')}</p>
                    </div>
                </div>
                <button onClick={handleRefresh} style={s.refreshBtn} disabled={refreshing}>
                    <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                    <span>{refreshing ? t(language, 'syncing') : t(language, 'refresh')}</span>
                </button>
            </div>

            {/* ── KPI Row ── */}
            <div style={s.kpiRow}>
                <KpiCard
                    icon={<Globe size={18} color="#F97316" />}
                    label={t(language, 'totalCO2e')}
                    value={animEmissions.toFixed(3)}
                    unit={t(language, 'metricTons')}
                    trend={t(language, 'vsLastMonth')}
                    trendGood
                    color="#F97316"
                    bg="rgba(249,115,22,0.08)"
                />
                <KpiCard
                    icon={<Zap size={18} color="#FBBF24" />}
                    label="Renewable Energy"
                    value={Math.round(animRenewable)}
                    unit="% of compute"
                    trend="+5% vs last month"
                    trendGood
                    color="#FBBF24"
                    bg="rgba(251,191,36,0.08)"
                />
                <KpiCard
                    icon={<TrendingDown size={18} color="#34D399" />}
                    label="Carbon Efficiency"
                    value={(animEfficiency / 1000).toFixed(3)}
                    unit="kg CO₂e / 1K req"
                    trend="-8% vs last month"
                    trendGood
                    color="#34D399"
                    bg="rgba(52,211,153,0.08)"
                />
                <KpiCard
                    icon={<Leaf size={18} color="#A78BFA" />}
                    label="Per-User Footprint"
                    value={data.emissionsPerUser.toFixed(2)}
                    unit="kg CO₂e/month"
                    trend="Target: < 1.5 kg ✓"
                    trendGood
                    color="#A78BFA"
                    bg="rgba(167,139,250,0.08)"
                />
            </div>

            {/* ── Two-Column: Breakdown + Trend ── */}
            <div style={s.twoCol}>
                {/* Donut */}
                <div style={s.card}>
                    <div style={s.cardHeader}>
                        <span style={s.cardTitle}>Emissions by Service</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', padding: '16px 20px' }}>
                        <div style={{ position: 'relative' }}>
                            <DonutChart segments={donutSegments} size={120} />
                            <div style={s.donutCenter}>
                                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Total</span>
                                <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{total.toFixed(2)}</span>
                                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>t CO₂e</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                            {donutSegments.map(seg => (
                                <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: 10, height: 10, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
                                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', flex: 1 }}>{seg.label}</span>
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff', fontFamily: 'monospace' }}>
                                        {seg.pct.toFixed(0)}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Trend */}
                <div style={s.card}>
                    <div style={s.cardHeader}>
                        <span style={s.cardTitle}>6-Month Emissions Trend</span>
                        <span style={{ fontSize: '11px', color: '#34D399', fontWeight: 600 }}>↓ 34% reduction</span>
                    </div>
                    <div style={{ padding: '16px 20px' }}>
                        <Sparkline data={data.trend} color="#34D399" width={260} height={60} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                            {['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'].map(m => (
                                <span key={m} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>{m}</span>
                            ))}
                        </div>
                        <div style={s.goalBox}>
                            <span style={{ fontSize: '11px', color: '#34D399', fontWeight: 600 }}>Year 1 Target</span>
                            <div style={s.goalBar}>
                                <div style={{ ...s.goalFill, width: `${(1 - data.totalEmissions / 1.89) * 100}%` }} />
                            </div>
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                                {((1 - data.totalEmissions / 1.89) * 100).toFixed(0)}% to goal
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Region Routing ── */}
            <div style={s.card}>
                <div style={s.cardHeader}>
                    <span style={s.cardTitle}>Carbon-Aware Regional Routing</span>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>Auto-routes to lowest-carbon region</span>
                </div>
                <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {data.regionCarbon.map((r) => (
                        <div key={r.region} style={s.regionRow}>
                            <div style={{ ...s.regionDot, background: r.active ? r.color : 'rgba(255,255,255,0.1)' }} />
                            <span style={{ flex: 1, fontSize: '12px', color: r.active ? '#fff' : 'rgba(255,255,255,0.4)' }}>
                                {r.region}
                            </span>
                            <span style={{ fontSize: '11px', color: r.color, fontWeight: 600, marginRight: 12 }}>
                                {r.intensity}
                            </span>
                            <div style={s.regionBarTrack}>
                                <div style={{ ...s.regionBarFill, width: `${r.pct}%`, background: r.color }} />
                            </div>
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', width: 30, textAlign: 'right' }}>
                                {r.pct}%
                            </span>
                            {r.active && (
                                <span style={s.activePill}>Active</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Optimizations Checklist ── */}
            <div style={s.card}>
                <div style={s.cardHeader}>
                    <span style={s.cardTitle}>Optimization Roadmap</span>
                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
                        {data.optimizations.filter(o => o.done).length} / {data.optimizations.length} implemented
                    </span>
                </div>
                <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {data.optimizations.map((opt, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {opt.done
                                ? <CheckCircle size={14} color="#34D399" style={{ flexShrink: 0 }} />
                                : <AlertTriangle size={14} color="#FBBF24" style={{ flexShrink: 0 }} />
                            }
                            <span style={{ fontSize: '12px', color: opt.done ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.45)', flex: 1 }}>
                                {opt.label}
                            </span>
                            <span style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                color: opt.done ? '#34D399' : '#FBBF24',
                                background: opt.done ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)',
                                padding: '2px 7px',
                                borderRadius: 4,
                            }}>
                                -{opt.saving}%
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── AWS Carbon Footprint API Note ── */}
            <div style={s.apiNote}>
                <span style={s.apiDot} />
                <span style={s.apiText}>
                    Live data via <strong>AWS Customer Carbon Footprint Tool</strong> · Endpoint:{' '}
                    <code style={s.apiCode}>GET /api/sustainability/report</code>
                </span>
            </div>

            <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
        </div>
    );
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ icon, label, value, unit, trend, trendGood, color, bg }) => (
    <div style={{ ...s.kpiCard, background: bg, borderColor: color + '22' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 8 }}>
            <div style={{ ...s.kpiIcon, background: color + '18' }}>{icon}</div>
            <span style={s.kpiLabel}>{label}</span>
        </div>
        <div style={{ ...s.kpiValue, color }}>{value}</div>
        <div style={s.kpiUnit}>{unit}</div>
        <div style={{ fontSize: '11px', color: trendGood ? '#34D399' : '#F87171', marginTop: 4, fontWeight: 600 }}>
            {trend}
        </div>
    </div>
);

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
    root: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '20px',
        background: 'transparent',
        fontFamily: "'Inter', -apple-system, sans-serif",
        overflowY: 'auto',
        height: '100%',
    },
    header: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    },
    headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
    leafBadge: {
        width: 38, height: 38, borderRadius: '10px',
        background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    title: {
        margin: 0, fontSize: '18px', fontWeight: 800,
        color: '#F8FAFC', letterSpacing: '-0.03em', lineHeight: 1.2,
    },
    titleAccent: {
        background: 'linear-gradient(90deg, #34D399, #10B981)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
    },
    subtitle: {
        margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.3)',
        fontFamily: 'monospace', letterSpacing: '0.04em',
    },
    refreshBtn: {
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '7px 14px',
        background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)',
        borderRadius: '10px', color: '#34D399', fontSize: '12px', fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
    },
    kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' },
    kpiCard: {
        padding: '14px 16px', borderRadius: '14px', border: '1px solid',
        background: 'rgba(255,255,255,0.03)',
    },
    kpiIcon: {
        width: 30, height: 30, borderRadius: '8px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    kpiLabel: { fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' },
    kpiValue: { fontSize: '26px', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, fontFamily: 'monospace' },
    kpiUnit: { fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: 2 },
    twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
    card: {
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '14px', overflow: 'hidden',
    },
    cardHeader: {
        padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    },
    cardTitle: { fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.06em' },
    donutCenter: {
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
    },
    goalBox: {
        marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px',
    },
    goalBar: {
        flex: 1, height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden',
    },
    goalFill: {
        height: '100%', background: 'linear-gradient(90deg, #34D399, #10B981)',
        borderRadius: 3, transition: 'width 1s ease',
    },
    regionRow: {
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
    },
    regionDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
    regionBarTrack: { width: 80, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' },
    regionBarFill: { height: '100%', borderRadius: 2, transition: 'width 1s ease' },
    activePill: {
        fontSize: '10px', fontWeight: 700, color: '#34D399',
        background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.2)',
        padding: '2px 7px', borderRadius: 4,
    },
    apiNote: {
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '10px 14px', borderRadius: '10px',
        background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.1)',
    },
    apiDot: { width: 6, height: 6, borderRadius: '50%', background: '#34D399', flexShrink: 0 },
    apiText: { fontSize: '11px', color: 'rgba(255,255,255,0.35)' },
    apiCode: { fontFamily: 'monospace', fontSize: '10px', color: '#34D399', background: 'rgba(52,211,153,0.1)', padding: '1px 5px', borderRadius: 3 },
};

export default GreenOpsPanel;
