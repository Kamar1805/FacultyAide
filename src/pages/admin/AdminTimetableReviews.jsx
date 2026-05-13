import React, { useEffect, useState } from 'react';
import { auth } from '../../firebase';
import {
    subscribeAllThreads,
    subscribeThreadMessages,
    addThreadMessage,
    updateThreadStatus,
    markAdminCaughtUp,
} from '../../services/timetableReviews';
import { analyzeLectureScheduleBundles, analyzeExamScheduleBundles } from '../../utils/timetableClashAnalysis';
import { explainClashesWithAi } from '../../utils/clashAiExplain';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { MessageSquare, Send, ClipboardList, GitCompare, Loader2 } from 'lucide-react';

export default function AdminTimetableReviews() {
    const [tab, setTab] = useState('reviews');
    const [threads, setThreads] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [msgs, setMsgs] = useState([]);
    const [adminNote, setAdminNote] = useState('');
    const [busy, setBusy] = useState(false);

    const [clashKind, setClashKind] = useState('lecture');
    const [jsonA, setJsonA] = useState('');
    const [jsonB, setJsonB] = useState('');
    const [clashReport, setClashReport] = useState('');
    const [aiText, setAiText] = useState('');
    const [aiBusy, setAiBusy] = useState(false);

    useEffect(() => {
        const unsub = subscribeAllThreads(setThreads);
        return () => unsub && unsub();
    }, []);

    useEffect(() => {
        if (!activeId) {
            setMsgs([]);
            return undefined;
        }
        markAdminCaughtUp(activeId).catch(() => {});
        const unsub = subscribeThreadMessages(activeId, setMsgs);
        return () => unsub && unsub();
    }, [activeId]);

    const active = threads.find((t) => t.id === activeId);
    const snap = active?.snapshot || {};

    const sendAdminFeedback = async () => {
        if (!activeId || !adminNote.trim()) return;
        setBusy(true);
        try {
            await addThreadMessage(activeId, {
                senderRole: 'admin',
                senderUid: auth.currentUser?.uid,
                senderName: 'Administrator',
                body: adminNote.trim(),
            });
            await updateThreadStatus(activeId, 'reviewed');
            setAdminNote('');
        } catch (e) {
            console.error(e);
            alert('Failed to save feedback.');
        } finally {
            setBusy(false);
        }
    };

    const requestChanges = async () => {
        if (!activeId) return;
        setBusy(true);
        try {
            if (adminNote.trim()) {
                await addThreadMessage(activeId, {
                    senderRole: 'admin',
                    senderUid: auth.currentUser?.uid,
                    senderName: 'Administrator',
                    body: adminNote.trim(),
                });
            }
            await updateThreadStatus(activeId, 'changes_requested');
            setAdminNote('');
        } catch (e) {
            console.error(e);
        } finally {
            setBusy(false);
        }
    };

    const runClashCheck = () => {
        setAiText('');
        try {
            const slotsA = JSON.parse(jsonA.trim() || '[]');
            const slotsB = JSON.parse(jsonB.trim() || '[]');
            if (clashKind === 'lecture') {
                const r = analyzeLectureScheduleBundles([
                    { label: 'Schedule A', slots: Array.isArray(slotsA) ? slotsA : slotsA.slots || [] },
                    { label: 'Schedule B', slots: Array.isArray(slotsB) ? slotsB : slotsB.slots || [] },
                ]);
                if (!r.hasClashes) {
                    setClashReport('No clash detected — merged lecture-style slots do not double-book tangible rooms or lecturers in overlapping periods.');
                    return;
                }
                const lines = [
                    ...r.venueClashes.map((c) => `[VENUE] ${c.day}: ${c.a} vs ${c.b}. Fix: ${c.fix}`),
                    ...r.lecturerClashes.map((c) => `[LECTURER] ${c.day} · ${c.lecturer}: ${c.a} vs ${c.b}. Fix: ${c.fix}`),
                ];
                setClashReport(lines.join('\n'));
            } else {
                const r = analyzeExamScheduleBundles([
                    { label: 'Schedule A', exams: Array.isArray(slotsA) ? slotsA : slotsA.schedule || slotsA.exams || [] },
                    { label: 'Schedule B', exams: Array.isArray(slotsB) ? slotsB : slotsB.schedule || slotsB.exams || [] },
                ]);
                if (!r.hasClashes) {
                    setClashReport('No clash detected — merged exam bundles do not share a hall or collide on same departmental level.');
                    return;
                }
                setClashReport(r.clashes.map((c) => `[${c.type.toUpperCase()}] ${c.date || ''}: ${c.a} vs ${c.b}. Fix: ${c.fix}`).join('\n'));
            }
        } catch (e) {
            console.error(e);
            setClashReport('Paste valid JSON arrays of slots (lecture) or exams (exam), or wrapped objects with "slots"/"schedule" keys.');
        }
    };

    const runAiExplain = async () => {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            alert('Add VITE_GEMINI_API_KEY to .env for AI explanations.');
            return;
        }
        setAiBusy(true);
        try {
            const res = await explainClashesWithAi(apiKey, clashKind === 'lecture' ? 'lecture' : 'exam', clashReport);
            setAiText(res.ok ? res.text || '' : '');
        } finally {
            setAiBusy(false);
        }
    };

    const hydrateFromActiveThread = () => {
        const sc = snap?.schedule;
        if (!sc) return;
        setClashKind(active?.kind === 'exam' ? 'exam' : 'lecture');
        setJsonA(JSON.stringify(sc, null, 2));
        setTab('clash');
    };

    const onDropJson =
        (which) =>
        async (e) => {
            e.preventDefault();
            const t = e.dataTransfer?.getData('application/json');
            const txt = await e.dataTransfer?.files?.[0]?.text?.();
            const raw = t || txt;
            if (!raw) return;
            try {
                const o = JSON.parse(raw);
                const str = JSON.stringify(o, null, 2);
                if (which === 'a') setJsonA(str);
                else setJsonB(str);
            } catch (_) {}
        };

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500 max-w-[1400px] mx-auto">
            <div className="flex gap-2 p-1 bg-slate-200/60 rounded-2xl w-fit">
                <button
                    type="button"
                    className={`px-5 py-2 rounded-xl text-sm font-black flex items-center gap-2 ${tab === 'reviews' ? 'bg-white shadow text-[#00008b]' : 'text-slate-600'}`}
                    onClick={() => setTab('reviews')}
                >
                    <ClipboardList size={18} /> Reviews inbox
                </button>
                <button
                    type="button"
                    className={`px-5 py-2 rounded-xl text-sm font-black flex items-center gap-2 ${tab === 'clash' ? 'bg-white shadow text-[#00008b]' : 'text-slate-600'}`}
                    onClick={() => setTab('clash')}
                >
                    <GitCompare size={18} /> Compare &amp; clash check
                </button>
            </div>

            {tab === 'reviews' ? (
                <div className="grid lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-5 space-y-2">
                        {threads.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setActiveId(t.id)}
                                className={`w-full text-left rounded-xl border p-4 ${activeId === t.id ? 'border-[#579044] bg-emerald-50/40 shadow' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                            >
                                <div className="font-black text-slate-900 text-sm">{t.title}</div>
                                <div className="text-xs text-slate-500 mt-1">
                                    {t.department} · {t.kind} · {t.status}
                                </div>
                                {t.pendingAdminAttention && (
                                    <span className="mt-2 inline-block text-[10px] font-black uppercase bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">Needs admin</span>
                                )}
                            </button>
                        ))}
                        {!threads.length && (
                            <Card><CardContent className="py-12 text-center text-slate-500 font-bold text-sm">No submissions yet.</CardContent></Card>
                        )}
                    </div>

                    <div className="lg:col-span-7">
                        {!activeId ? (
                            <Card className="h-96 flex items-center justify-center text-slate-400 font-bold">Choose a coordinator submission.</Card>
                        ) : (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2"><MessageSquare className="text-indigo-600" /> Discuss with coordinator</CardTitle>
                                    <CardDescription>Approve, request changes, or drag this snapshot into the clash tab.</CardDescription>
                                    <Button type="button" variant="outline" size="sm" className="w-fit mt-2 font-bold" onClick={hydrateFromActiveThread}>
                                        Load snapshot into clash checker
                                    </Button>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div
                                        className="max-h-48 overflow-y-auto rounded-xl border bg-slate-50 p-3 text-[11px] font-mono whitespace-pre-wrap"
                                        draggable
                                        onDragStart={(e) =>
                                            e.dataTransfer.setData('application/json', JSON.stringify(snap?.schedule || [], null, 2))
                                        }
                                    >
                                        {JSON.stringify(snap?.schedule ?? [], null, 2)?.slice(0, 2800)}
                                        {(snap?.schedule?.length || 0) > 3 ? '\n…' : ''}
                                    </div>

                                    <div className="h-52 overflow-y-auto rounded-xl border p-3 space-y-3 bg-white">
                                        {msgs.map((m) => (
                                            <div key={m.id} className={`rounded-xl px-3 py-2 text-sm ${m.senderRole === 'admin' ? 'bg-[#00008b] text-white ml-8' : 'bg-slate-100 mr-8'}`}>
                                                <div className="text-[10px] font-black uppercase opacity-80">{m.senderName}</div>
                                                <div className="whitespace-pre-wrap">{m.body}</div>
                                            </div>
                                        ))}
                                    </div>

                                    <textarea
                                        value={adminNote}
                                        onChange={(e) => setAdminNote(e.target.value)}
                                        placeholder="Assessment / optional instructions…"
                                        className="w-full rounded-xl border min-h-[80px] p-3 text-sm"
                                    />
                                    <div className="flex flex-wrap gap-2">
                                        <Button type="button" disabled={busy} onClick={sendAdminFeedback} className="bg-[#579044] hover:bg-[#426d33] text-white font-bold rounded-xl">
                                            {busy ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} className="mr-2" />}
                                            Publish remarks
                                        </Button>
                                        <Button type="button" variant="outline" disabled={busy} onClick={requestChanges} className="font-bold rounded-xl border-amber-300 text-amber-900">
                                            Request changes
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Combine two payloads</CardTitle>
                            <CardDescription>Drop coordinator JSON exports or paste Firestore snapshots. Lecture: array of timetable slots · Exam: exams array or timetable object.</CardDescription>
                            <div className="flex gap-3 pt-3">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 cursor-pointer">
                                    <input type="radio" checked={clashKind === 'lecture'} onChange={() => setClashKind('lecture')} /> Lecture-hour merge
                                </label>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 cursor-pointer">
                                    <input type="radio" checked={clashKind === 'exam'} onChange={() => setClashKind('exam')} /> Exam-session merge
                                </label>
                            </div>
                        </CardHeader>
                        <CardContent className="grid md:grid-cols-2 gap-4">
                            <div
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={onDropJson('a')}
                                className="space-y-1"
                            >
                                <div className="text-xs font-black text-slate-500 uppercase">Timetable A</div>
                                <textarea value={jsonA} onChange={(e) => setJsonA(e.target.value)} className="w-full h-52 font-mono text-xs rounded-xl border border-slate-200 p-3 bg-slate-50" />
                            </div>
                            <div
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={onDropJson('b')}
                                className="space-y-1"
                            >
                                <div className="text-xs font-black text-slate-500 uppercase">Timetable B</div>
                                <textarea value={jsonB} onChange={(e) => setJsonB(e.target.value)} className="w-full h-52 font-mono text-xs rounded-xl border border-slate-200 p-3 bg-slate-50" />
                            </div>
                            <div className="md:col-span-2 flex flex-wrap gap-2">
                                <Button type="button" onClick={runClashCheck} className="bg-slate-900 text-white rounded-xl font-bold">
                                    Run deterministic clash check
                                </Button>
                                <Button type="button" variant="outline" disabled={!clashReport || aiBusy} onClick={runAiExplain} className="rounded-xl font-bold">
                                    {aiBusy ? <Loader2 className="animate-spin" /> : null} Explain / suggest fixes with AI
                                </Button>
                            </div>
                            {clashReport && (
                                <div className="md:col-span-2 whitespace-pre-wrap text-sm rounded-xl border border-slate-200 bg-white p-4 text-slate-800 font-medium">
                                    {clashReport}
                                </div>
                            )}
                            {aiText && (
                                <div className="md:col-span-2 whitespace-pre-wrap text-sm rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 text-indigo-950">
                                    <div className="text-[10px] font-black uppercase text-indigo-600 mb-2">AI briefing</div>
                                    {aiText}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
