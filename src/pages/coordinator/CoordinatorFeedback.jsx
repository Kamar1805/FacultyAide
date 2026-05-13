import React, { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { auth } from '../../firebase';
import {
    subscribeCoordinatorThreads,
    subscribeThreadMessages,
    addThreadMessage,
    markCoordinatorCaughtUp,
} from '../../services/timetableReviews';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { MessageSquare, Send, ArrowRight, RefreshCw, Calendar, FileText } from 'lucide-react';

export default function CoordinatorFeedback() {
    const { userData } = useOutletContext();
    const navigate = useNavigate();
    const uid = userData?.uid || auth.currentUser?.uid;
    const [threads, setThreads] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [msgs, setMsgs] = useState([]);
    const [reply, setReply] = useState('');
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (!uid) return undefined;
        const unsub = subscribeCoordinatorThreads(uid, setThreads);
        return () => unsub && unsub();
    }, [uid]);

    useEffect(() => {
        if (!activeId) {
            setMsgs([]);
            return undefined;
        }
        markCoordinatorCaughtUp(activeId).catch(() => {});
        const unsub = subscribeThreadMessages(activeId, setMsgs);
        return () => unsub && unsub();
    }, [activeId]);

    const active = threads.find((t) => t.id === activeId);

    const openInGenerator = () => {
        if (!active?.id) return;
        const q = `?reviewThread=${encodeURIComponent(active.id)}`;
        if (active.kind === 'exam') navigate(`/coordinator/exam-timetable${q}`);
        else navigate(`/coordinator/lecture-timetable${q}`);
    };

    const handleSend = async () => {
        if (!reply.trim() || !activeId || !uid) return;
        setSending(true);
        try {
            await addThreadMessage(activeId, {
                senderRole: 'coordinator',
                senderUid: uid,
                senderName: userData?.name,
                body: reply.trim(),
            });
            setReply('');
        } catch (e) {
            console.error(e);
            alert('Could not send message.');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-16 animate-in fade-in duration-500">
            <div className="lg:col-span-4 space-y-3">
                <h1 className="text-3xl font-black text-slate-900">Admin feedback</h1>
                <p className="text-slate-500 text-sm">Threads created when you submit a timetable for review.</p>
                <div className="space-y-2 max-h-[calc(100vh-12rem)] overflow-y-auto">
                    {threads.length === 0 && (
                        <Card className="border-dashed">
                            <CardContent className="p-6 text-sm text-slate-500">Nothing here yet — use “Send to admins” on the timetable screens.</CardContent>
                        </Card>
                    )}
                    {threads.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setActiveId(t.id)}
                            className={`w-full text-left rounded-xl border p-4 transition-all ${
                                activeId === t.id ? 'border-indigo-500 bg-indigo-50/50 shadow-md' : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                        >
                            <div className="flex justify-between items-start gap-2">
                                <div className="flex items-center gap-2">
                                    {t.kind === 'exam' ? <FileText size={18} className="text-violet-600" /> : <Calendar size={18} className="text-emerald-600" />}
                                    <span className="font-black text-slate-900 text-sm line-clamp-2">{t.title}</span>
                                </div>
                                {t.pendingCoordinatorAttention && (
                                    <span className="text-[10px] font-black uppercase bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full shrink-0">New</span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 mt-2 line-clamp-2">{t.lastMessagePreview || t.status}</p>
                        </button>
                    ))}
                </div>
            </div>

            <div className="lg:col-span-8">
                {!activeId ? (
                    <Card className="h-96 flex items-center justify-center text-slate-400 font-bold border-dashed">Select a conversation</Card>
                ) : (
                    <Card className="border-slate-200 shadow-sm min-h-[32rem] flex flex-col">
                        <CardHeader className="border-b bg-slate-50/80">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <MessageSquare size={22} className="text-indigo-600" />
                                {active?.title}
                            </CardTitle>
                            <CardDescription>
                                {active?.kind === 'exam' ? 'Exam draft' : 'Lecture draft'} · {active?.department}{' '}
                                <span className="text-xs font-mono text-slate-400">({active?.status})</span>
                            </CardDescription>
                            <div className="flex flex-wrap gap-2 pt-2">
                                <Button variant="outline" size="sm" className="font-bold" type="button" onClick={openInGenerator}>
                                    <RefreshCw size={14} className="mr-2" /> Adjust &amp; regenerate
                                </Button>
                                <Button variant="ghost" size="sm" className="font-bold text-indigo-700" type="button" onClick={openInGenerator}>
                                    Open workspace <ArrowRight size={14} className="ml-1" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col p-0">
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[22rem] bg-slate-50/50">
                                {msgs.map((m) => (
                                    <div
                                        key={m.id}
                                        className={`max-w-[92%] rounded-2xl px-4 py-2.5 text-sm ${
                                            m.senderRole === 'admin'
                                                ? 'bg-white border border-slate-200 text-slate-800 ml-0'
                                                : 'bg-[#00008b] text-white ml-auto'
                                        }`}
                                    >
                                        <div className="text-[10px] font-black uppercase opacity-70 mb-1">
                                            {m.senderName} · {m.senderRole}
                                        </div>
                                        <div className="whitespace-pre-wrap leading-relaxed">{m.body}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="p-4 border-t bg-white flex gap-2">
                                <textarea
                                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm resize-none min-h-[48px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    placeholder="Reply to admin…"
                                    value={reply}
                                    onChange={(e) => setReply(e.target.value)}
                                />
                                <Button type="button" disabled={sending} onClick={handleSend} className="bg-[#00008b] hover:bg-[#000060] shrink-0 px-4 rounded-xl">
                                    <Send size={18} />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
