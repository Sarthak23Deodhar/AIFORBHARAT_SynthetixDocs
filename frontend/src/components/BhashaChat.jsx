import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Activity, Sparkles, User, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchWithFallback } from '../mockData';
import { t } from '../utils/translations';

const API_BASE = 'https://ihm3s4vc87.execute-api.us-east-1.amazonaws.com/dev/api';

const LANGUAGE_NAMES = {
    'en': 'English', 'hi': 'हिंदी', 'mr': 'मराठी',
    'ta': 'தமிழ்', 'te': 'తెలుగు', 'kn': 'ಕನ್ನಡ', 'bn': 'বাংলা',
    'ml': 'മലയാളം', 'gu': 'ગુજરાતી', 'pa': 'ਪੰਜਾਬੀ', 'or': 'ଓଡ଼ିଆ',
    'as': 'অসমীয়া', 'ur': 'اردو', 'sa': 'संस्कृतम्'
};

const GREETINGS = {
    'en': 'Hey! 👋 Ask me anything — code, AWS, DevOps, whatever.',
    'hi': 'नमस्ते! 👋 पूछो — code, AWS, DevOps, कुछ भी।',
    'mr': 'नमस्कार! 👋 विचारा — code, AWS, DevOps, काहीही।',
    'ta': 'வணக்கம்! 👋 கேளுங்கள் — code, AWS, DevOps, எதுவும்.',
    'te': 'నమస్కారం! 👋 అడగండి — code, AWS, DevOps, ఏదైనా.',
    'kn': 'ನಮಸ್ಕಾರ! 👋 ಕೇಳಿ — code, AWS, DevOps, ಏನಾದರೂ.',
    'ml': 'നമസ്കാരം! 👋 ചോദിക്കൂ — code, AWS, DevOps, എന്തും.',
    'bn': 'নমস্কার! 👋 জিজ্ঞেস করো — code, AWS, DevOps, যেকোনো কিছু।',
    'gu': 'નમસ્તે! 👋 પૂછો — code, AWS, DevOps, કંઈ પણ.',
    'pa': 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! 👋 ਪੁੱਛੋ — code, AWS, DevOps, ਕੁਝ ਵੀ।',
    'or': 'ନମସ୍କାର! 👋 ପଚାର — code, AWS, DevOps, ଯାହା ହେଉ।',
    'as': 'নমস্কাৰ! 👋 সুধিব — code, AWS, DevOps, যি হয়।',
    'ur': 'سلام! 👋 پوچھو — code, AWS, DevOps، کچھ بھی۔',
    'sa': 'नमस्ते! 👋 पृच्छतु — code, AWS, DevOps, किमपि।',
};

const BhashaChat = ({ language, skillLevel, user }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
    }, [isOpen]);

    useEffect(() => {
        setMessages([{ role: 'bot', text: GREETINGS[language] || GREETINGS['en'] }]);
    }, [language]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
        setInput('');
        setIsLoading(true);

        try {
            const data = await fetchWithFallback(`${API_BASE}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: userMessage,
                    language,
                    skill_level: skillLevel,
                    userId: user?.username || user?.signInDetails?.loginId || 'anonymous',
                    // Send last 10 messages as history (skip the initial greeting at index 0)
                    history: messages.slice(1).slice(-10)
                })
            });
            if (data.response) {
                setMessages(prev => [...prev, { role: 'bot', text: data.response }]);
            } else if (data.error) {
                setMessages(prev => [...prev, { role: 'bot', text: `⚠️ API Error: ${data.details || data.error}` }]);
            }
        } catch (err) {
            setMessages(prev => [...prev, {
                role: 'bot',
                text: '⚠️ Network Error: Could not reach the AWS API Gateway backend.'
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const langName = LANGUAGE_NAMES[language] || 'English';

    return (
        <div style={styles.container}>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 24, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 24, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                        style={styles.chatWindow}
                    >
                        {/* Header */}
                        <div style={styles.header}>
                            <div style={styles.headerLeft}>
                                <div style={styles.avatarWrap}>
                                    <Bot size={15} color="#000" strokeWidth={2.5} />
                                </div>
                                <div>
                                    <div style={styles.titleRow}>
                                        <span style={styles.chatTitle}>Bhasha-Chat</span>
                                    </div>
                                    <span style={styles.chatSub}>{langName}</span>
                                </div>
                            </div>
                            <button onClick={() => setIsOpen(false)} style={styles.closeBtn}>
                                <X size={16} />
                            </button>
                        </div>

                        {/* Messages */}
                        <div style={styles.messagesArea}>
                            {messages.map((msg, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        ...styles.msgRow,
                                        justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                        animationDelay: `${idx * 0.05}s`,
                                    }}
                                    className="fade-in-up"
                                >
                                    {msg.role === 'bot' && (
                                        <div style={styles.botAvatar}>
                                            <Bot size={12} color="#BD6C73" />
                                        </div>
                                    )}
                                    <div style={msg.role === 'user' ? styles.userBubble : styles.botBubble}>
                                        {msg.text.split('\n').map((line, i) => (
                                            <span key={i}>{line}{i < msg.text.split('\n').length - 1 && <br />}</span>
                                        ))}
                                    </div>
                                    {msg.role === 'user' && (
                                        <div style={styles.userAvatar}>
                                            <User size={12} color="#000" />
                                        </div>
                                    )}
                                </div>
                            ))}

                            {isLoading && (
                                <div style={{ ...styles.msgRow, justifyContent: 'flex-start' }}>
                                    <div style={styles.botAvatar}>
                                        <Bot size={12} color="#BD6C73" />
                                    </div>
                                    <div style={{ ...styles.botBubble, ...styles.typingBubble }}>
                                        <span style={styles.dot1} />
                                        <span style={styles.dot2} />
                                        <span style={styles.dot3} />
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <form onSubmit={handleSend} style={styles.inputArea}>
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder={t(language, 'chatPlaceholder')}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                style={styles.input}
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || isLoading}
                                style={styles.sendBtn}
                            >
                                <Send size={15} />
                            </button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* FAB */}
            <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.93 }}
                onClick={() => setIsOpen(!isOpen)}
                style={styles.fab}
            >
                <AnimatePresence mode="wait">
                    {isOpen
                        ? <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}><X size={22} color="currentcolor" /></motion.span>
                        : <motion.span key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}><MessageSquare size={22} color="currentcolor" /></motion.span>
                    }
                </AnimatePresence>
                {!isOpen && <span style={styles.fabPulse} />}
            </motion.button>
        </div>
    );
};

const styles = {
    container: {
        position: 'fixed',
        bottom: '32px',
        right: '32px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '16px',
    },
    fab: {
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        background: 'var(--saffron)',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: 'var(--shadow-lg)',
        position: 'relative',
        color: '#ffffff',
    },
    fabPulse: {
        position: 'absolute',
        inset: '-4px',
        borderRadius: '50%',
        border: '2px solid var(--saffron-dim)',
        animation: 'pulse-ring 2s ease-out infinite',
    },
    chatWindow: {
        width: '380px',
        height: '530px',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-layer1)',
        border: '1px solid var(--border-soft)',
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-lg)',
    },
    header: {
        padding: '16px 18px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--bg-layer1)',
        borderBottom: '1px solid var(--border-soft)',
        boxShadow: 'var(--clay-drop), var(--clay-inset-light), var(--clay-inset-dark)',
        flexShrink: 0,
        zIndex: 2,
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    avatarWrap: {
        width: '34px',
        height: '34px',
        borderRadius: '10px',
        background: 'var(--bg-layer2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.05), inset -2px -2px 5px rgba(255,255,255,0.6)',
        color: 'var(--saffron)',
    },
    titleRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '7px',
    },
    chatTitle: {
        fontSize: '14px',
        fontWeight: '700',
        color: 'var(--text-bright)',
        fontFamily: 'var(--font-display)',
    },
    ragBadge: {
        fontSize: '9px',
        fontWeight: '800',
        letterSpacing: '0.08em',
        padding: '2px 6px',
        borderRadius: '4px',
        background: 'rgba(146,161,194,0.15)',
        color: '#92A1C2',
        border: '1px solid rgba(146,161,194,0.25)',
    },
    chatSub: {
        fontSize: '10.5px',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)',
        display: 'block',
        marginTop: '1px',
    },
    closeBtn: {
        background: 'var(--bg-layer1)',
        border: 'none',
        boxShadow: 'var(--shadow-sm)',
        borderRadius: '8px',
        cursor: 'pointer',
        color: 'var(--text-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '30px',
        height: '30px',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    },
    messagesArea: {
        flex: 1,
        padding: '16px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    msgRow: {
        display: 'flex',
        alignItems: 'flex-end',
        gap: '8px',
    },
    botAvatar: {
        width: '24px',
        height: '24px',
        borderRadius: '8px',
        background: 'var(--bg-layer1)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: 'var(--text-muted)',
    },
    userAvatar: {
        width: '24px',
        height: '24px',
        borderRadius: '8px',
        background: 'var(--bg-layer2)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: 'var(--saffron)',
    },
    botBubble: {
        maxWidth: '82%',
        padding: '10px 14px',
        borderRadius: '14px',
        borderBottomLeftRadius: '4px',
        fontSize: '13px',
        lineHeight: '1.65',
        background: 'var(--bg-layer1)',
        color: 'var(--text-secondary)',
        boxShadow: 'var(--shadow-sm)',
    },
    userBubble: {
        maxWidth: '82%',
        padding: '10px 14px',
        borderRadius: '14px',
        borderBottomRightRadius: '4px',
        fontSize: '13px',
        lineHeight: '1.65',
        background: 'var(--saffron)',
        color: '#ffffff',
        fontWeight: '600',
        boxShadow: 'var(--shadow-sm)',
    },
    typingBubble: {
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        padding: '12px 16px',
    },
    dot1: { width: '6px', height: '6px', borderRadius: '50%', background: '#BD6C73', opacity: 0.4, animation: 'bounce 1.2s 0s infinite' },
    dot2: { width: '6px', height: '6px', borderRadius: '50%', background: '#BD6C73', opacity: 0.4, animation: 'bounce 1.2s 0.2s infinite' },
    dot3: { width: '6px', height: '6px', borderRadius: '50%', background: '#BD6C73', opacity: 0.4, animation: 'bounce 1.2s 0.4s infinite' },
    inputArea: {
        padding: '12px',
        background: 'var(--bg-layer1)',
        borderTop: '1px solid var(--border-soft)',
        display: 'flex',
        gap: '10px',
        flexShrink: 0,
        boxShadow: 'var(--shadow-sm)',
    },
    input: {
        flex: 1,
        padding: '11px 16px',
        borderRadius: '12px',
        border: '1px solid var(--border-soft)',
        background: 'var(--bg-layer2)',
        boxShadow: 'none',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-body)',
        fontSize: '13px',
        outline: 'none',
        transition: 'border-color 0.2s',
    },
    sendBtn: {
        width: '42px',
        height: '42px',
        borderRadius: '12px',
        background: 'var(--saffron)',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        flexShrink: 0,
        boxShadow: 'var(--shadow-sm)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    },
};

// Inject bounce keyframes
const style = document.createElement('style');
style.textContent = `
@keyframes bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-5px); opacity: 1; }
}
@keyframes pulse-ring {
  0% { transform: scale(1); opacity: 0.6; }
  100% { transform: scale(1.5); opacity: 0; }
}
`;
document.head.appendChild(style);

export default BhashaChat;



