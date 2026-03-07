import React from 'react';
import { Globe, Zap, Compass, Sun, Moon, LogOut, User } from 'lucide-react';
import { t } from '../utils/translations';

const LANGUAGES = [
    { value: 'en', label: '🇺🇸 English' },
    { value: 'hi', label: '🇮🇳 Hindi' },
    { value: 'mr', label: '🇮🇳 Marathi' },
    { value: 'ta', label: '🇮🇳 Tamil' },
    { value: 'te', label: '🇮🇳 Telugu' },
    { value: 'kn', label: '🇮🇳 Kannada' },
    { value: 'ml', label: '🇮🇳 Malayalam' },
    { value: 'bn', label: '🇮🇳 Bengali' },
    { value: 'gu', label: '🇮🇳 Gujarati' },
    { value: 'pa', label: '🇮🇳 Punjabi' },
    { value: 'or', label: '🇮🇳 Odia' },
    { value: 'as', label: '🇮🇳 Assamese' },
    { value: 'sa', label: '🇮🇳 Sanskrit' },
];

/* ── NativeSelect: fix for arrow/dropdown not triggering on click ── */
/* The trick: overlay the <select> with position:absolute;inset:0;opacity:0
   so the ENTIRE wrapper div is the clickable area. A custom visible label
   layer renders below it. This means clicking the icon OR the chevron OR
   anywhere on the pill opens the native dropdown correctly. */
function NativeSelect({ icon: Icon, value, onChange, options }) {
    const currentLabel = options.find(o => o.value === value)?.label || value;

    return (
        <div style={styles.selectPill}>
            {/* Invisible native select covering the full pill */}
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                style={styles.selectOverlay}
                aria-label="Select option"
            >
                {options.map(o => (
                    <option key={o.value} value={o.value} style={{ background: '#14142a', color: '#eeeef8' }}>
                        {o.label}
                    </option>
                ))}
            </select>

            {/* Visible display layer (pointer-events:none so clicks pass through) */}
            <div style={styles.selectDisplay}>
                <Icon size={13} color="var(--text-muted)" />
                <span style={styles.selectLabel}>{currentLabel}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </div>
        </div>
    );
}

const Header = ({ language, setLanguage, skillLevel, setSkillLevel, isDarkMode, toggleTheme, user, onSignOut }) => {
    const skillOptions = [
        { value: 'junior', label: t(language, 'skillJunior') },
        { value: 'senior', label: t(language, 'skillSenior') },
    ];

    return (
        <header style={styles.header}>
            {/* Bottom glow line */}
            <div style={styles.glowBar} />

            {/* Logo */}
            <div style={styles.logoArea}>
                <div style={styles.logoMark}>
                    <Compass size={17} color="#fff" strokeWidth={2.5} />
                </div>
                <div>
                    <h1 style={styles.title}>
                        Synthetix{' '}
                        <span style={styles.titleAccent}>Docs</span>
                    </h1>
                    <div style={styles.taglineRow}>
                        <span style={styles.statusDot} />
                        <span style={styles.tagline}>{t(language, 'tagline')}</span>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div style={styles.controls}>
                {/* Language selector — full-pill native dropdown */}
                <NativeSelect
                    icon={Globe}
                    value={language}
                    onChange={setLanguage}
                    options={LANGUAGES}
                />

                {/* Skill selector */}
                <NativeSelect
                    icon={Zap}
                    value={skillLevel}
                    onChange={setSkillLevel}
                    options={skillOptions}
                />

                {/* Theme toggle */}
                <button
                    onClick={toggleTheme}
                    style={styles.iconBtn}
                    title={isDarkMode ? t(language, 'themeLight') : t(language, 'themeDark')}
                >
                    {isDarkMode
                        ? <Sun size={15} color="var(--text-muted)" />
                        : <Moon size={15} color="var(--text-muted)" />
                    }
                </button>

                {/* AWS live badge */}
                <div style={styles.awsBadge}>
                    <span style={styles.awsDot} />
                    <span style={styles.awsText}>AWS Live</span>
                </div>

                {/* User + sign out */}
                {user && (
                    <div style={styles.userArea}>
                        <div style={styles.userAvatar}>
                            <User size={11} color="#818cf8" />
                        </div>
                        <span style={styles.userEmail}>
                            {(user.signInDetails?.loginId || user.username || '').split('@')[0]}
                        </span>
                        <button onClick={onSignOut} style={styles.signOutBtn} title="Sign out">
                            <LogOut size={13} />
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
};

const styles = {
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 28px',
        background: 'var(--bg-layer1)',
        boxShadow: 'var(--clay-drop), var(--clay-inset-light), var(--clay-inset-dark)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        flexShrink: 0,
        borderBottom: '1px solid var(--border-soft)',
    },
    glowBar: {
        display: 'none', // Removed for neumorphism
    },
    logoArea: { display: 'flex', alignItems: 'center', gap: '12px' },
    logoMark: {
        width: '36px', height: '36px',
        background: 'var(--bg-layer1)',
        borderRadius: '10px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: 'var(--clay-drop), var(--clay-inset-light), var(--clay-inset-dark)',
        flexShrink: 0,
    },
    title: {
        fontSize: '18px', fontWeight: '700', margin: 0,
        letterSpacing: '-0.02em', color: 'var(--text-bright)', lineHeight: 1.2,
        fontFamily: 'var(--font-display)',
    },
    titleAccent: {
        background: 'linear-gradient(90deg, #34d399, #f59e0b)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
    },
    taglineRow: { display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' },
    statusDot: {
        width: '6px', height: '6px', borderRadius: '50%',
        background: '#10b981', boxShadow: '0 0 6px rgba(16,185,129,0.8)', flexShrink: 0,
    },
    tagline: {
        fontSize: '10px', color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)', letterSpacing: '0.02em',
    },

    controls: { display: 'flex', alignItems: 'center', gap: '8px' },

    selectPill: {
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: '8px',
        background: 'var(--bg-layer2)',
        border: 'none',
        boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.05), inset -2px -2px 5px rgba(255,255,255,0.6)',
        cursor: 'pointer',
        overflow: 'hidden',
    },
    selectOverlay: {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        opacity: 0,
        cursor: 'pointer',
        zIndex: 1,
        fontSize: '13px',
        border: 'none',
        outline: 'none',
        appearance: 'auto',
    },
    selectDisplay: {
        display: 'flex', alignItems: 'center', gap: '7px',
        padding: '7px 12px',
        pointerEvents: 'none',
        userSelect: 'none',
        whiteSpace: 'nowrap',
    },
    selectLabel: {
        color: 'var(--text-primary)',
        fontSize: '12.5px', fontWeight: '500',
        fontFamily: 'var(--font-body)',
        maxWidth: '100px',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    },

    iconBtn: {
        background: 'var(--bg-layer1)',
        border: 'none',
        boxShadow: 'var(--clay-drop), var(--clay-inset-light), var(--clay-inset-dark)',
        borderRadius: '8px', padding: '7px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        color: 'var(--text-primary)',
    },

    awsBadge: {
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '6px 11px',
        background: 'var(--bg-layer2)',
        border: 'none',
        boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.05), inset -2px -2px 5px rgba(255,255,255,0.6)',
        borderRadius: '8px',
    },
    awsDot: {
        width: '6px', height: '6px', borderRadius: '50%',
        background: 'var(--warning)', boxShadow: '0 0 8px var(--warning)',
    },
    awsText: {
        fontSize: '10px', fontWeight: '700', color: 'var(--warning)',
        fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase',
    },

    userArea: {
        display: 'flex', alignItems: 'center', gap: '7px',
        padding: '5px 9px',
        background: 'var(--bg-layer1)',
        border: 'none',
        boxShadow: 'var(--clay-drop), var(--clay-inset-light), var(--clay-inset-dark)',
        borderRadius: '8px',
    },
    userAvatar: {
        width: '20px', height: '20px', borderRadius: '5px',
        background: 'var(--bg-layer2)',
        boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.05), inset -2px -2px 4px rgba(255,255,255,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
    },
    userEmail: {
        fontSize: '11.5px', fontWeight: '600', color: 'var(--saffron)',
        fontFamily: 'var(--font-mono)',
        maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    },
    signOutBtn: {
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--danger)',
        display: 'flex', alignItems: 'center',
        padding: '2px', transition: 'color 0.2s',
    },
};

export default Header;
