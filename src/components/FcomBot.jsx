import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Bot, User, Minimize2, Maximize2, Loader2, Mic, MicOff } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';

const FcomBot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'bot', text: "Hello! I'm Fcom Bot, your Nile University assistant. How can I help you manage your faculty today?" }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [dbContextMenu, setDbContextMenu] = useState('');

    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Fetch DB context to give to AI
    const fetchDbContext = async () => {
        try {
            const coursesSnap = await getDocs(collection(db, 'courses'));
            const lecturersSnap = await getDocs(collection(db, 'lecturers'));
            const venuesSnap = await getDocs(collection(db, 'venues'));
            const timetablesSnap = await getDocs(collection(db, 'saved_timetables'));

            const courses = coursesSnap.docs.map(doc => {
                const d = doc.data();
                return `${d.code}: ${d.title} (Level: ${d.level || 'N/A'}, Semester: ${d.semester || 'N/A'}, Enrollment: ${d.students || 0}, Dept: ${d.department})`;
            }).join(" | ");

            const lecturers = lecturersSnap.docs.map(doc => doc.data().title + " " + doc.data().name + " (" + doc.data().department + ")").join(", ");
            const venues = venuesSnap.docs.map(doc => doc.data().name + " (" + doc.data().type + ", " + doc.data().capacity + ")").join(", ");

            const activeTimetables = timetablesSnap.docs
                .filter(doc => doc.data().isActive)
                .map(doc => {
                    const d = doc.data();
                    const scheduleStr = d.schedule.map(s =>
                        `${s.code} at ${s.assignedVenue?.name} on ${s.assignedDay} (${s.assignedStart}:00 - ${s.assignedEnd}:00) for ${s.level} Level`
                    ).join("; ");
                    return `Timetable [${d.name}] for ${d.department}: ${scheduleStr}`;
                }).join(" || ");

            setDbContextMenu(`
                COURSES (with enrollment): ${courses}
                LECTURERS: ${lecturers}
                VENUES: ${venues}
                ACTIVE SCHEDULES: ${activeTimetables}
            `);
        } catch (error) {
            console.error("Error fetching bot context:", error);
        }
    };

    useEffect(() => {
        fetchDbContext();
    }, []);



    // Voice recognition logic
    const toggleListening = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Your browser does not support voice recognition. Please try Chrome or Safari.");
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
            // We'll use a functional update to handle the auto-send after the input is updated
            setMessages(prev => [...prev, { role: 'user', text: transcript }]);
            handleSend(transcript); // Pass transcript directly to handleSend
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.start();
    };

    // Modified handleSend to accept optional text override
    const handleSend = async (overrideText = '') => {
        const textToSend = overrideText || input;
        if (!textToSend.trim() || loading) return;

        if (!overrideText) {
            setMessages(prev => [...prev, { role: 'user', text: textToSend }]);
            setInput('');
        }
        setLoading(true);

        try {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!apiKey) {
                setMessages(prev => [...prev, { role: 'bot', text: "I'm sorry, my AI processing engine is currently disconnected (API Key missing)." }]);
                setLoading(false);
                return;
            }

            const systemPrompt = `
                You are Fcom Bot, the official AI assistant for the Faculty of Computing at Nile University of Nigeria.
                Your goal is to help administrators and coordinators manage courses, lecturers, and timetables.
                
                Nile University Context:
                - Motto: "Building a Better Future"
                - Core Values: Integrity, Excellence, Innovation.
                - Faculty of Computing (FCOM) includes departments like Computer Science, Software Engineering, Cyber Security, etc.
                
                Current Date/Time: ${new Date().toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                
                Current System Database Context:
                ${dbContextMenu}
                
                Guidelines:
                - Be professional, helpful, and concise.
                - Refer to the database context provided to answer questions about specific courses, enrollment numbers, or lecturers.
                - Analyze ACTIVE SCHEDULES to answer questions about "what's happening now", "what's in Venue X", or "Monday morning schedules".
                - If asked about what's happening NOW, compare the Current Date/Time with the ACTIVE SCHEDULES.
                - If you don't know something for sure from the context, state that you don't have that information.
                - Always follow Nile University's standard of excellence.
                - Keep responses safe and academic.
            `;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemma-3-4b-it:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: systemPrompt },
                            { text: textToSend }
                        ]
                    }]
                })
            });

            const data = await response.json();
            const botText = data.candidates?.[0]?.content?.parts?.[0]?.text || "I was unable to generate a response.";
            setMessages(prev => [...prev, { role: 'bot', text: botText }]);
        } catch (error) {
            console.error("Bot Error:", error);
            setMessages(prev => [...prev, { role: 'bot', text: "I encountered a glitch. Please try asking again in a moment." }]);
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
                        onClick={() => setIsOpen(true)}
                        className="bg-indigo-600 text-white p-4 rounded-full shadow-2xl hover:bg-indigo-700 transition-all flex items-center justify-center group"
                    >
                        <Bot size={28} className="group-hover:rotate-12 transition-transform" />
                        <span className="absolute -top-12 right-0 bg-white text-indigo-600 px-3 py-1 rounded-lg text-xs font-bold shadow-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                            Chat with Fcom Bot
                        </span>
                    </motion.button>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ y: 100, opacity: 0, scale: 0.9 }}
                        animate={{
                            y: 0,
                            opacity: 1,
                            scale: 1,
                            height: isMinimized ? '60px' : '500px',
                            width: isMinimized ? '200px' : '350px'
                        }}
                        exit={{ y: 100, opacity: 0, scale: 0.9 }}
                        className="bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                    >
                        {/* Header */}
                        <div className="bg-slate-900 p-4 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-1 bg-indigo-500 rounded-lg">
                                    <Bot size={18} />
                                </div>
                                <span className="font-bold text-sm tracking-tight">Fcom Bot</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setIsMinimized(!isMinimized)} className="p-1.5 hover:bg-white/10 rounded-lg">
                                    {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                                </button>
                                <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg">
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {!isMinimized && (
                            <>
                                {/* Messages */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                                    {messages.map((m, i) => (
                                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] p-3 rounded-2xl text-xs font-medium leading-relaxed shadow-sm ${m.role === 'user'
                                                ? 'bg-indigo-600 text-white rounded-tr-none'
                                                : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                                                }`}>
                                                {m.text}
                                            </div>
                                        </div>
                                    ))}
                                    {loading && (
                                        <div className="flex justify-start">
                                            <div className="bg-white p-3 rounded-2xl text-xs text-slate-400 italic flex items-center gap-2 border border-slate-100 shadow-sm">
                                                <Loader2 size={14} className="animate-spin" />
                                                Fcom Bot is thinking...
                                            </div>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Input */}
                                <div className="p-3 bg-white border-t border-slate-100">
                                    <div className="flex gap-2">
                                        <input
                                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                            placeholder="Ask me anything..."
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                                        />
                                        <button
                                            onClick={toggleListening}
                                            className={`${isListening ? 'bg-red-500 animate-pulse' : 'bg-slate-100 text-slate-600'} p-2 rounded-xl hover:opacity-80 transition-all`}
                                            title={isListening ? "Listening..." : "Voice Input"}
                                        >
                                            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                                        </button>
                                        <button
                                            onClick={() => handleSend()}
                                            disabled={loading || !input.trim()}
                                            className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50"
                                        >
                                            <Send size={18} />
                                        </button>
                                    </div>
                                    <p className="text-[9px] text-center text-slate-400 mt-2 font-bold uppercase tracking-wider">
                                        Powered by Nile FacultyAide AI
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
