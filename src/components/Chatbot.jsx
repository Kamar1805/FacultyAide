import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

const Chatbot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { id: 1, text: "Hello! I'm FacultyAide AI. Ask me about venue capacity, student locations, or attendance stats.", sender: 'bot' }
    ]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg = { id: Date.now(), text: input, sender: 'user' };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setIsTyping(true);

        // Mock response for now (to avoid API key issues in demo if not provided)
        setTimeout(() => {
            let replyText = "I'm analyzing the current hall data...";
            if (input.toLowerCase().includes('lt5')) replyText = "LT5 is currently at 85% capacity with 51/60 students present.";
            if (input.toLowerCase().includes('kamar')) replyText = "Found 1 match: Kamar Deen is seated in Row 3, Seat 5 (E125). Status: Present.";
            if (input.toLowerCase().includes('absent')) replyText = "There are currently 3 absentees marked in E125.";

            const botMsg = { id: Date.now() + 1, text: replyText, sender: 'bot' };
            setMessages(prev => [...prev, botMsg]);
            setIsTyping(false);
        }, 1500);
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {/* Chat Window */}
            {isOpen && (
                <div className="mb-4 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[500px] animate-in slide-in-from-bottom-10 fade-in duration-300">
                    {/* Header */}
                    <div className="bg-[#579044] p-4 flex justify-between items-center text-white">
                        <div className="flex items-center gap-2">
                            <div className="bg-white/20 p-1.5 rounded-full">
                                <Bot size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm">FacultyAide Assistant</h3>
                                <span className="text-[10px] text-green-100 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-green-200 rounded-full animate-pulse"></span> Online
                                </span>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded transition-colors">
                            <X size={18} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={cn(
                                    "flex w-full mb-2",
                                    msg.sender === 'user' ? "justify-end" : "justify-start"
                                )}
                            >
                                <div
                                    className={cn(
                                        "max-w-[80%] p-3 rounded-2xl text-sm shadow-sm",
                                        msg.sender === 'user'
                                            ? "bg-[#00008b] text-white rounded-br-none"
                                            : "bg-white text-slate-800 border border-slate-100 rounded-bl-none"
                                    )}
                                >
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {isTyping && (
                            <div className="flex justify-start w-full">
                                <div className="bg-white p-3 rounded-2xl rounded-bl-none border border-slate-100 shadow-sm flex gap-1">
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-3 bg-white border-t flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Ask about venue status..."
                            className="flex-1 bg-slate-100 border-none rounded-full px-4 text-sm focus:ring-1 focus:ring-primary outline-none"
                        />
                        <Button
                            size="icon"
                            className="rounded-full bg-[#579044] hover:bg-[#4a7a3a]"
                            onClick={handleSend}
                        >
                            <Send size={18} />
                        </Button>
                    </div>
                </div>
            )}

            {/* Toggle Button */}
            {!isOpen && (
                <Button
                    onClick={() => setIsOpen(true)}
                    className="h-14 w-14 rounded-full bg-[#579044] hover:bg-[#4a7a3a] shadow-lg flex items-center justify-center transition-transform hover:scale-105"
                >
                    <MessageSquare className="h-6 w-6 text-white" />
                </Button>
            )}
        </div>
    );
};

export default Chatbot;
