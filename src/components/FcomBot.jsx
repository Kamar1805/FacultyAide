import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Bot, Minimize2, Maximize2, Loader2, Mic, MicOff, Sparkles } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { geminiGenerateText, getGeminiModelCandidates } from '../utils/geminiApi';
import { ChatMarkdown } from './ChatMarkdown';

/** Remove legacy "(via model-id)" suffix if present in body text */
function stripModelSuffix(text) {
    if (!text || typeof text !== 'string') return text;
    return text.replace(/\s*\(via\s+[^)]+\)\s*$/i, '').trim();
}

function messageBody(m) {
    if (m.content != null) return m.content;
    return m.text != null ? m.text : '';
}

const FcomBot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [messages, setMessages] = useState([
        {
            role: 'bot',
            content:
                "Hello! I'm **Fcom Bot**, your Nile University assistant.\n\nAsk about **courses**, **venues**, **lecturers**, or **active timetables** — I'll answer from your current FacultyAide data.",
        },
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [dbContextMenu, setDbContextMenu] = useState('');

    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const fetchDbContext = async () => {
        try {
            const coursesSnap = await getDocs(collection(db, 'courses'));
            const lecturersSnap = await getDocs(collection(db, 'lecturers'));
            const venuesSnap = await getDocs(collection(db, 'venues'));
            const timetablesSnap = await getDocs(collection(db, 'saved_timetables'));

            const courses = coursesSnap.docs
                .map((docSnap) => {
                    const d = docSnap.data();
                    return `${d.code}: ${d.title} (Level: ${d.level || 'N/A'}, Semester: ${d.semester || 'N/A'}, Enrollment: ${d.students || 0}, Dept: ${d.department})`;
                })
                .join(' | ');

            const lecturers = lecturersSnap.docs
                .map((docSnap) => {
                    const x = docSnap.data();
                    return `${x.title || ''} ${x.name || ''} (${x.department || 'N/A'})`.trim();
                })
                .join(', ');
            const venues = venuesSnap.docs
                .map((docSnap) => {
                    const x = docSnap.data();
                    return `${x.name} (${x.type || '—'}, cap ${x.capacity ?? '—'})`;
                })
                .join(', ');

            const activeTimetables = timetablesSnap.docs
                .filter((docSnap) => docSnap.data().isActive)
                .map((docSnap) => {
                    const d = docSnap.data();
                    const sched = Array.isArray(d.schedule) ? d.schedule : [];
                    const scheduleStr = sched
                        .map(
                            (s) =>
                                `${s.code} at ${s.assignedVenue?.name} on ${s.assignedDay} (${s.assignedStart}:00 - ${s.assignedEnd}:00) for ${s.level} Level`
                        )
                        .join('; ');
                    return `Timetable [${d.name}] for ${d.department}: ${scheduleStr}`;
                })
                .join(' || ');

            setDbContextMenu(`
                COURSES (with enrollment): ${courses}
                LECTURERS: ${lecturers}
                VENUES: ${venues}
                ACTIVE SCHEDULES: ${activeTimetables}
            `);
        } catch (error) {
            console.error('Error fetching bot context:', error);
        }
    };

    useEffect(() => {
        fetchDbContext();
    }, []);

    useEffect(() => {
        if (isOpen) fetchDbContext();
    }, [isOpen]);

    const toggleListening = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('Your browser does not support voice recognition. Please try Chrome or Safari.');
            return;
        }

        if (isListening) {
            setIsListening(false);
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setIsListening(true);
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setInput(transcript);
            setMessages((prev) => [...prev, { role: 'user', content: transcript }]);
            handleSend(transcript);
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.start();
    };

    const handleSend = async (overrideText = '') => {
        const textToSend = overrideText || input;
        if (!textToSend.trim() || loading) return;

        if (!overrideText) {
            setMessages((prev) => [...prev, { role: 'user', content: textToSend }]);
            setInput('');
        }
        setLoading(true);

        try {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!apiKey) {
                setMessages((prev) => [
                    ...prev,
                    {
                        role: 'bot',
                        content:
                            'Add **VITE_GEMINI_API_KEY** to your `.env` file from [Google AI Studio](https://aistudio.google.com/apikey), then restart the dev server.',
                    },
                ]);
                setLoading(false);
                return;
            }

            const systemPrompt = `
You are Fcom Bot, the official AI assistant for the Faculty of Computing at Nile University of Nigeria.
Help administrators and coordinators with courses, lecturers, and timetables.

Nile University Context:
- Motto: "Building a Better Future"
- Core values: Integrity, Excellence, Innovation.
- FCOM includes Computer Science, Software Engineering, Cyber Security, Information Technology, etc.

Current date/time: ${new Date().toLocaleString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            })}

Current system database context (may be empty if Firestore has no data):
${dbContextMenu || '(no context loaded yet)'}

Guidelines:
- Be professional, helpful, and concise.
- Use the database context for courses, enrollment, lecturers, venues, and ACTIVE SCHEDULES when relevant.
- **Formatting:** Use GitHub-flavored Markdown. Use **bold** for key figures and names, short paragraphs, and bullet lists when you enumerate items. Avoid dumping one huge paragraph.
- For "what is happening now" versus a timetable, compare current date/time to schedule entries (note: timetables may list generic weekly slots).
- If information is not in the context, say you do not have it.
- Keep responses safe and academic.
`.trim();

            const result = await geminiGenerateText(apiKey, textToSend, systemPrompt);

            if (!result.ok) {
                console.error('FcomBot Gemini error:', result.error);
                setMessages((prev) => [
                    ...prev,
                    {
                        role: 'bot',
                        content: `I could not reach the AI.\n\n**Details:** ${result.error}\n\n**Tried models:** ${getGeminiModelCandidates().join(', ')}\n\nSet \`VITE_GEMINI_MODEL\` in \`.env\` to a model your API key supports.`,
                    },
                ]);
            } else {
                setMessages((prev) => [
                    ...prev,
                    {
                        role: 'bot',
                        content: stripModelSuffix(result.text || '').trim(),
                        modelUsed: result.modelUsed || null,
                    },
                ]);
            }
        } catch (error) {
            console.error('Bot Error:', error);
            setMessages((prev) => [
                ...prev,
                { role: 'bot', content: 'I encountered a glitch. Please try again in a moment.' },
            ]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-[9999]">
            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        type="button"
                        onClick={() => setIsOpen(true)}
                        className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white p-4 rounded-full shadow-2xl shadow-indigo-900/25 hover:from-indigo-500 hover:to-indigo-700 transition-all flex items-center justify-center group ring-2 ring-white/20"
                        aria-label="Open Fcom Bot"
                    >
                        <Bot size={28} className="group-hover:scale-105 transition-transform" />
                        <span className="absolute -top-12 right-0 bg-white text-indigo-700 px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity border border-slate-100">
                            Chat with Fcom Bot
                        </span>
                    </motion.button>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ y: 24, opacity: 0, scale: 0.96 }}
                        animate={{
                            y: 0,
                            opacity: 1,
                            scale: 1,
                            height: isMinimized ? 56 : 'min(560px, 85vh)',
                        }}
                        exit={{ y: 24, opacity: 0, scale: 0.96 }}
                        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
                        className="w-[min(26rem,calc(100vw-1.5rem))] flex flex-col bg-white rounded-2xl shadow-2xl shadow-slate-900/15 overflow-hidden border border-slate-200/90 ring-1 ring-slate-900/5"
                    >
                        <div className="shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-4 py-3 text-white flex items-center justify-between gap-3 border-b border-white/10">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-900/30 shrink-0">
                                    <Bot size={18} className="text-white" aria-hidden />
                                </div>
                                <div className="min-w-0">
                                    <span className="font-bold text-sm tracking-tight block truncate">Fcom Bot</span>
                                    <span className="text-[10px] text-slate-400 font-medium truncate block">
                                        Faculty of Computing assistant
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsMinimized(!isMinimized)}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                    aria-label={isMinimized ? 'Expand' : 'Minimize'}
                                >
                                    {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                    aria-label="Close chat"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {!isMinimized && (
                            <>
                                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-slate-50/90 to-slate-100/80">
                                    {messages.map((m, i) => (
                                        <div
                                            key={i}
                                            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            {m.role === 'bot' && (
                                                <div
                                                    className="hidden sm:flex w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200/80 items-center justify-center shrink-0 mr-2 mt-1"
                                                    aria-hidden
                                                >
                                                    <Sparkles className="w-4 h-4 text-indigo-600" />
                                                </div>
                                            )}
                                            <div
                                                className={`max-w-[min(92%,20rem)] rounded-2xl shadow-md ${
                                                    m.role === 'user'
                                                        ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-tr-md shadow-indigo-900/15 px-4 py-3'
                                                        : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-md shadow-slate-200/60 pl-4 pr-4 py-3 border-l-[3px] border-l-indigo-500'
                                                }`}
                                            >
                                                <ChatMarkdown variant={m.role === 'user' ? 'user' : 'assistant'}>
                                                    {messageBody(m)}
                                                </ChatMarkdown>
                                                {m.role === 'bot' && m.modelUsed && (
                                                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                                                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                                            Model
                                                        </span>
                                                        <span
                                                            className="text-[10px] font-mono text-slate-500 truncate max-w-[12rem] text-right"
                                                            title={m.modelUsed}
                                                        >
                                                            {m.modelUsed}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {loading && (
                                        <div className="flex justify-start items-start gap-2">
                                            <div
                                                className="hidden sm:flex w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200/80 items-center justify-center shrink-0"
                                                aria-hidden
                                            >
                                                <Loader2 size={16} className="animate-spin text-indigo-600" />
                                            </div>
                                            <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-md border border-slate-200/90 shadow-md text-sm text-slate-500 flex items-center gap-2 border-l-[3px] border-l-indigo-400">
                                                <span className="font-medium">Thinking…</span>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                <div className="shrink-0 p-3 bg-white border-t border-slate-100">
                                    <div className="flex gap-2">
                                        <input
                                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-300 transition-shadow"
                                            placeholder="Ask about courses, venues, timetables…"
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                                        />
                                        <button
                                            type="button"
                                            onClick={toggleListening}
                                            className={`${
                                                isListening
                                                    ? 'bg-red-500 text-white animate-pulse'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            } p-2.5 rounded-xl transition-all shrink-0`}
                                            title={isListening ? 'Listening…' : 'Voice input'}
                                            aria-label="Voice input"
                                        >
                                            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleSend()}
                                            disabled={loading || !input.trim()}
                                            className="bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-45 disabled:pointer-events-none shrink-0 shadow-md shadow-indigo-900/10"
                                            aria-label="Send"
                                        >
                                            <Send size={18} />
                                        </button>
                                    </div>
                                    <p className="text-[9px] text-center text-slate-400 mt-2.5 font-semibold uppercase tracking-widest">
                                        Nile FacultyAide · Markdown replies
                                    </p>
                                </div>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default FcomBot;
