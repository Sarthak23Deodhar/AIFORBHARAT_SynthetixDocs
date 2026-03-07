import React, { useState } from 'react';
import {
    signUp, signIn, confirmSignUp, resendSignUpCode, signOut
} from 'aws-amplify/auth';
import { Compass, Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, CheckCircle, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { isCognitoConfigured } from '../aws-exports';

// Auth screens: 'login' | 'signup' | 'confirm'
const AuthModal = ({ onAuthSuccess }) => {
    const [screen, setScreen] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmCode, setConfirmCode] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const clearMessages = () => { setError(''); setSuccessMsg(''); };

    // ── Sign In ───────────────────────────────────────────────────────────────
    const handleLogin = async (e) => {
        e.preventDefault();
        clearMessages();
        setLoading(true);
        try {
            const { isSignedIn, nextStep } = await signIn({ username: email, password });
            if (isSignedIn) {
                onAuthSuccess();
            } else if (nextStep?.signInStep === 'CONFIRM_SIGN_UP') {
                setScreen('confirm');
                setError('Please verify your email first.');
            }
        } catch (err) {
            setError(err.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    // ── Sign Up ───────────────────────────────────────────────────────────────
    const handleSignUp = async (e) => {
        e.preventDefault();
        clearMessages();
        if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
        setLoading(true);
        try {
            const { nextStep } = await signUp({
                username: email,
                password,
                options: { userAttributes: { email } }
            });
            if (nextStep?.signUpStep === 'CONFIRM_SIGN_UP') {
                setScreen('confirm');
                setSuccessMsg('Verification code sent to your email!');
            }
        } catch (err) {
            setError(err.message || 'Sign up failed. Try again.');
        } finally {
            setLoading(false);
        }
    };

    // ── Confirm OTP ───────────────────────────────────────────────────────────
    const handleConfirm = async (e) => {
        e.preventDefault();
        clearMessages();
        setLoading(true);
        try {
            await confirmSignUp({ username: email, confirmationCode: confirmCode });
            setSuccessMsg('Email verified! Signing you in…');
            // Auto sign-in after confirmation
            await signIn({ username: email, password });
            onAuthSuccess();
        } catch (err) {
            setError(err.message || 'Invalid code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        clearMessages();
        try {
            await resendSignUpCode({ username: email });
            setSuccessMsg('New verification code sent!');
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div style={styles.overlay}>
            <div className="auth-floating-shape" style={{ top: '10%', left: '15%', width: '300px', height: '300px', background: 'var(--saffron-dim)' }} />
            <div className="auth-floating-shape" style={{ bottom: '15%', right: '10%', width: '250px', height: '250px', background: 'var(--teal-dim)', animationDelay: '-4s' }} />

            <AnimatePresence mode="wait">
                <motion.div
                    key={screen}
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -20 }}
                    transition={{ type: 'spring', bounce: 0.4, duration: 0.5 }}
                    style={styles.card}
                >
                    {/* ── Dev Mode Banner ── */}
                    {!isCognitoConfigured && (
                        <div style={styles.devBanner}>
                            <AlertTriangle size={13} color="#FBBF24" style={{ flexShrink: 0, marginTop: 1 }} />
                            <div style={{ flex: 1 }}>
                                <strong style={{ color: '#FCD34D', fontSize: '12px', display: 'block' }}>Cognito not configured</strong>
                                <span style={{ fontSize: '11px', color: 'rgba(255,215,0,0.5)', lineHeight: 1.4 }}>
                                    Fill <code style={{ background: 'rgba(0,0,0,0.3)', padding: '0 3px', borderRadius: 3 }}>frontend/.env.local</code> with real User Pool IDs.
                                </span>
                            </div>
                            <button
                                onClick={() => onAuthSuccess({ username: 'dev-user', signInDetails: { loginId: 'dev@local' } })}
                                style={styles.bypassBtn}
                            >
                                Skip →
                            </button>
                        </div>
                    )}
                    {/* Logo */}
                    <div style={styles.logoRow}>
                        <div style={styles.logoMark}>
                            <Compass size={20} color="#fff" strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 style={styles.brand}>Synthetix <span style={styles.brandAccent}>Docs</span></h1>
                            <p style={styles.brandSub}>AI for Bharat · Enterprise Edition</p>
                        </div>
                    </div>

                    {/* Title */}
                    <h2 style={styles.screenTitle}>
                        {screen === 'login' && 'Welcome back'}
                        {screen === 'signup' && 'Create your account'}
                        {screen === 'confirm' && 'Verify your email'}
                    </h2>
                    <p style={styles.screenSub}>
                        {screen === 'login' && 'Sign in to access your documentation history'}
                        {screen === 'signup' && 'Start documenting code in 13 Indian languages'}
                        {screen === 'confirm' && `Enter the 6-digit code sent to ${email}`}
                    </p>

                    {/* Error / Success messages */}
                    {error && <div style={styles.errorBox}>{error}</div>}
                    {successMsg && <div style={styles.successBox}><CheckCircle size={14} /> {successMsg}</div>}

                    {/* ── Login Form ── */}
                    {screen === 'login' && (
                        <form onSubmit={handleLogin} style={styles.form}>
                            <InputField
                                icon={<Mail size={14} />}
                                type="email"
                                placeholder="Email address"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                            />
                            <InputField
                                icon={<Lock size={14} />}
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                right={
                                    <button type="button" onClick={() => setShowPassword(p => !p)} style={styles.eyeBtn}>
                                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                }
                            />
                            <AuthButton loading={loading} label="Sign In" />
                        </form>
                    )}

                    {/* ── Sign Up Form ── */}
                    {screen === 'signup' && (
                        <form onSubmit={handleSignUp} style={styles.form}>
                            <InputField
                                icon={<Mail size={14} />}
                                type="email"
                                placeholder="Email address"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                            />
                            <InputField
                                icon={<Lock size={14} />}
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Password (min 8 characters)"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                right={
                                    <button type="button" onClick={() => setShowPassword(p => !p)} style={styles.eyeBtn}>
                                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                }
                            />
                            <AuthButton loading={loading} label="Create Account" />
                        </form>
                    )}

                    {/* ── Confirm OTP Form ── */}
                    {screen === 'confirm' && (
                        <form onSubmit={handleConfirm} style={styles.form}>
                            <InputField
                                icon={<CheckCircle size={14} />}
                                type="text"
                                placeholder="6-digit verification code"
                                value={confirmCode}
                                onChange={e => setConfirmCode(e.target.value)}
                                required
                                maxLength={6}
                                inputMode="numeric"
                                pattern="[0-9]*"
                            />
                            <AuthButton loading={loading} label="Verify & Sign In" />
                            <button type="button" onClick={handleResend} style={styles.linkBtn}>
                                Resend code
                            </button>
                        </form>
                    )}

                    {/* ── Switch Screens ── */}
                    {screen !== 'confirm' && (
                        <p style={styles.switchRow}>
                            {screen === 'login' ? (
                                <>Don't have an account?{' '}
                                    <button type="button" onClick={() => { setScreen('signup'); clearMessages(); }} style={styles.switchLink}>
                                        Sign up free
                                    </button>
                                </>
                            ) : (
                                <>Already have an account?{' '}
                                    <button type="button" onClick={() => { setScreen('login'); clearMessages(); }} style={styles.switchLink}>
                                        Sign in
                                    </button>
                                </>
                            )}
                        </p>
                    )}

                    {/* AWS Badge */}
                    <div style={styles.awsBadge}>
                        <span style={styles.awsDot} />
                        <span style={styles.awsText}>Secured by AWS Cognito</span>
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

// ─── Shared sub-components ──────────────────────────────────────────────────
const InputField = ({ icon, right, ...rest }) => (
    <div style={styles.inputWrapper}>
        <span style={styles.inputIcon}>{icon}</span>
        <input style={styles.input} {...rest} />
        {right && <span style={styles.inputRight}>{right}</span>}
    </div>
);

const AuthButton = ({ loading, label }) => (
    <button type="submit" disabled={loading} style={{ ...styles.submitBtn, opacity: loading ? 0.7 : 1 }}>
        {loading
            ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            : <><span>{label}</span><ArrowRight size={15} /></>
        }
    </button>
);

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = {
    overlay: {
        position: 'fixed',
        inset: 0,
        background: 'var(--bg-layer1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        overflow: 'hidden',
    },
    blob1: {
        position: 'absolute',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)',
        top: '-100px',
        left: '-100px',
        pointerEvents: 'none',
    },
    blob2: {
        position: 'absolute',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(251,191,36,0.08) 0%, transparent 70%)',
        bottom: '-80px',
        right: '-80px',
        pointerEvents: 'none',
    },
    card: {
        width: '420px',
        padding: '40px 36px',
        background: 'var(--bg-layer1)',
        border: '1px solid var(--border-soft)',
        borderRadius: '24px',
        boxShadow: 'var(--clay-drop), var(--clay-inset-light), var(--clay-inset-dark)',
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
    },
    logoRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '13px',
        marginBottom: '4px',
    },
    logoMark: {
        width: '42px',
        height: '42px',
        borderRadius: '12px',
        background: 'var(--bg-layer1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: 'var(--clay-drop), var(--clay-inset-light), var(--clay-inset-dark)',
        color: 'var(--saffron)',
        flexShrink: 0,
    },
    brand: {
        margin: 0,
        fontSize: '18px',
        fontWeight: '800',
        color: 'var(--text-bright)',
        letterSpacing: '-0.04em',
        lineHeight: 1.2,
        fontFamily: "'Inter', sans-serif",
    },
    brandAccent: {
        background: 'linear-gradient(90deg, #3B82F6, #60A5FA)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
    },
    brandSub: {
        margin: 0,
        fontSize: '11px',
        color: 'var(--text-muted)',
        fontFamily: 'monospace',
        letterSpacing: '0.04em',
    },
    screenTitle: {
        margin: 0,
        fontSize: '22px',
        fontWeight: '700',
        color: 'var(--text-bright)',
        letterSpacing: '-0.02em',
        fontFamily: "'Inter', sans-serif",
    },
    screenSub: {
        margin: 0,
        fontSize: '13px',
        color: 'var(--text-muted)',
        lineHeight: 1.5,
        fontFamily: "'Inter', sans-serif",
    },
    errorBox: {
        padding: '10px 14px',
        background: 'var(--bg-layer2)',
        border: '1px solid var(--danger)',
        boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.05), inset -2px -2px 4px rgba(255,255,255,0.6)',
        borderRadius: '10px',
        color: 'var(--danger)',
        fontSize: '13px',
        fontFamily: "'Inter', sans-serif",
    },
    successBox: {
        padding: '10px 14px',
        background: 'var(--bg-layer2)',
        border: '1px solid var(--success)',
        boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.05), inset -2px -2px 4px rgba(255,255,255,0.6)',
        borderRadius: '10px',
        color: 'var(--success)',
        fontSize: '13px',
        display: 'flex',
        alignItems: 'center',
        gap: '7px',
        fontFamily: "'Inter', sans-serif",
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    inputWrapper: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
    },
    inputIcon: {
        position: 'absolute',
        left: '14px',
        color: 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        pointerEvents: 'none',
    },
    input: {
        width: '100%',
        padding: '13px 14px 13px 40px',
        background: 'var(--bg-layer2)',
        border: 'none',
        boxShadow: 'inset 4px 4px 8px rgba(0,0,0,0.05), inset -4px -4px 8px rgba(255,255,255,0.7)',
        borderRadius: '12px',
        color: 'var(--text-primary)',
        fontFamily: "'Inter', sans-serif",
        fontSize: '14px',
        outline: 'none',
        transition: 'all 0.2s',
        boxSizing: 'border-box',
    },
    inputRight: {
        position: 'absolute',
        right: '12px',
        display: 'flex',
        alignItems: 'center',
    },
    eyeBtn: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        padding: '4px',
    },
    submitBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '13px',
        background: 'var(--saffron)',
        border: 'none',
        borderRadius: '12px',
        color: '#ffffff',
        fontFamily: "'Inter', sans-serif",
        fontSize: '14px',
        fontWeight: '700',
        cursor: 'pointer',
        boxShadow: 'var(--clay-drop), inset 2px 2px 6px rgba(255,255,255,0.3)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        marginTop: '8px',
    },
    linkBtn: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--text-muted)',
        fontSize: '13px',
        fontFamily: "'Inter', sans-serif",
        textAlign: 'center',
        textDecoration: 'underline',
        padding: '4px',
    },
    switchRow: {
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '13px',
        margin: 0,
        fontFamily: "'Inter', sans-serif",
    },
    switchLink: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--saffron)',
        fontWeight: '600',
        fontSize: '13px',
        fontFamily: "'Inter', sans-serif",
        padding: 0,
        textDecoration: 'underline',
    },
    awsBadge: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        justifyContent: 'center',
        marginTop: '4px',
    },
    awsDot: {
        width: '5px', height: '5px', borderRadius: '50%',
        background: 'var(--warning)', boxShadow: '0 0 6px var(--warning)',
    },
    awsText: {
        fontSize: '10px', color: 'var(--warning)', fontFamily: 'monospace',
        letterSpacing: '0.08em', textTransform: 'uppercase',
    },
    devBanner: {
        display: 'flex', alignItems: 'flex-start', gap: '10px',
        padding: '10px 12px',
        background: 'var(--bg-layer2)',
        border: '1px solid var(--warning)',
        boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.05)',
        borderRadius: '10px',
    },
    bypassBtn: {
        background: 'var(--warning)',
        border: 'none',
        boxShadow: 'var(--clay-drop), inset 2px 2px 4px rgba(255,255,255,0.3)',
        borderRadius: '8px',
        color: '#ffffff',
        fontSize: '12px', fontWeight: '700',
        fontFamily: "'Inter', sans-serif",
        cursor: 'pointer', padding: '6px 12px',
        flexShrink: 0, whiteSpace: 'nowrap',
    },
};

export default AuthModal;
