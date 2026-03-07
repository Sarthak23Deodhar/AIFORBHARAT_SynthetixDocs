import React, { useState, useRef } from 'react';
import { Volume2, Play, Pause, Download, Loader2 } from 'lucide-react';

const API_BASE = 'http://localhost:8000/api';

const AudioPlayer = ({ codeSnippet, language }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [audioUrl, setAudioUrl] = useState(null);
    const audioRef = useRef(null);

    const generateAudio = async () => {
        setIsLoading(true);
        setAudioUrl(null);

        try {
            // Mocking the "Context synthesis" before audio generation for the frontend UI visual flow.
            // In reality, the backend would read the code, summarize it, and pass it to Polly.
            const summaryText = `This code is responsible for creating synthetic assets in the smart contract.`;
            // Replace with actual Bedrock summarization or let backend handle full text generation.

            const res = await fetch(`${API_BASE}/audio`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: summaryText,
                    language: language
                })
            });

            const data = await res.json();

            if (data.audio_url) {
                setAudioUrl(data.audio_url);

                setTimeout(() => {
                    if (audioRef.current) {
                        audioRef.current.play();
                        setIsPlaying(true);
                    }
                }, 100);
            } else if (data.audio_base64) {
                // Construct data URI for the audio
                const url = `data:audio/mp3;base64,${data.audio_base64}`;
                setAudioUrl(url);

                // Auto play when ready
                setTimeout(() => {
                    if (audioRef.current) {
                        audioRef.current.play();
                        setIsPlaying(true);
                    }
                }, 100);
            } else {
                alert("Failed to generate audio.");
            }
        } catch (err) {
            console.error(err);
            alert("Error generating audio.");
        } finally {
            setIsLoading(false);
        }
    };

    const togglePlay = () => {
        if (!audioUrl) return;

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    return (
        <div style={styles.container} className="clay-card">
            <div style={styles.header}>
                <div style={styles.iconBox}>
                    <Volume2 size={24} color="var(--primary)" />
                </div>
                <div>
                    <h3 style={styles.title}>The Bharat Explainer</h3>
                    <p style={styles.subtitle}>Neural Audio Walkthrough ({language.toUpperCase()})</p>
                </div>
            </div>

            <div style={styles.content}>
                <p style={styles.description}>
                    Listen to a localized 60-second explanation of the current code architecture.
                </p>

                {!audioUrl ? (
                    <button
                        onClick={generateAudio}
                        disabled={isLoading}
                        className="clay-button primary"
                        style={styles.actionBtn}
                    >
                        {isLoading ? (
                            <><Loader2 size={18} className="animate-spin" /> Synthesizing...</>
                        ) : (
                            <><Play size={18} /> Generate Audio</>
                        )}
                    </button>
                ) : (
                    <div style={styles.playerWrapper}>
                        <audio
                            ref={audioRef}
                            src={audioUrl}
                            onEnded={() => setIsPlaying(false)}
                            onPause={() => setIsPlaying(false)}
                            onPlay={() => setIsPlaying(true)}
                            style={{ display: 'none' }}
                        />

                        <div style={styles.controls}>
                            <button onClick={togglePlay} style={styles.playBtn} className="clay-button primary">
                                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                            </button>

                            <div style={styles.waveform}>
                                {/* Simulated waveform visualization */}
                                {[...Array(20)].map((_, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            ...styles.bar,
                                            height: `${Math.random() * 80 + 20}%`,
                                            opacity: isPlaying ? 1 : 0.5,
                                            animationDuration: isPlaying ? `${Math.random() * 0.5 + 0.5}s` : '0s'
                                        }}
                                        className={isPlaying ? 'wave-animate' : ''}
                                    />
                                ))}
                            </div>

                            <a
                                href={audioUrl}
                                download={`walkthrough_${language}.mp3`}
                                style={styles.downloadBtn}
                                className="clay-button"
                            >
                                <Download size={18} />
                            </a>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
        @keyframes wave {
          0% { transform: scaleY(0.5); }
          50% { transform: scaleY(1); }
          100% { transform: scaleY(0.5); }
        }
        .wave-animate {
          animation-name: wave;
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
        }
      `}</style>
        </div>
    );
};

const styles = {
    container: {
        padding: '24px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '20px',
    },
    iconBox: {
        width: '48px',
        height: '48px',
        borderRadius: '16px',
        background: 'var(--primary-glow)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: '18px',
        margin: 0,
    },
    subtitle: {
        fontSize: '13px',
        color: 'var(--text-muted)',
        margin: 0,
        marginTop: '4px',
    },
    content: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
    },
    description: {
        fontSize: '14px',
        color: 'var(--text-muted)',
        marginBottom: '24px',
    },
    actionBtn: {
        width: '100%',
        justifyContent: 'center',
        padding: '14px',
        fontSize: '16px',
    },
    playerWrapper: {
        background: 'rgba(255,255,255,0.4)',
        padding: '16px',
        borderRadius: '16px',
        border: '1px solid var(--card-border)',
    },
    controls: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
    },
    playBtn: {
        width: '48px',
        height: '48px',
        padding: 0,
        borderRadius: '50%',
        flexShrink: 0,
    },
    waveform: {
        flex: 1,
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        overflow: 'hidden',
    },
    bar: {
        flex: 1,
        background: 'var(--primary)',
        borderRadius: '2px',
        transformOrigin: 'bottom',
    },
    downloadBtn: {
        width: '40px',
        height: '40px',
        padding: 0,
        borderRadius: '10px',
        flexShrink: 0,
        justifyContent: 'center',
    }
};

export default AudioPlayer;
