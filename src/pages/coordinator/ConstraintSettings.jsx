import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { ShieldAlert, Sparkles, Trash2, Save, Info, RefreshCw, MessageSquare } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import InstructionGuide from '../../components/InstructionGuide';
import { db } from '../../firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc, query, where } from 'firebase/firestore';

const ConstraintSettings = () => {
    const { userData } = useOutletContext();
    const [constraints, setConstraints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(null);

    const [newRule, setNewRule] = useState({
        title: '',
        text: '',
    });

    useEffect(() => {
        if (!userData?.department) return;

        const qConstraints = query(
            collection(db, 'constraints'),
            where('department', '==', userData.department)
        );
        const unsubscribe = onSnapshot(qConstraints, (snapshot) => {
            const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            list.sort((a, b) => {
                const ta = a.createdAt || '';
                const tb = b.createdAt || '';
                return tb.localeCompare(ta);
            });
            setConstraints(list);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userData]);

    const handleAddNl = async () => {
        const text = (newRule.text || '').trim();
        if (!text) {
            alert('Write a rule in plain language before saving.');
            return;
        }
        if (isSaving) return;

        setIsSaving(true);
        try {
            await addDoc(collection(db, 'constraints'), {
                kind: 'natural_language',
                title: (newRule.title || '').trim() || 'Department rule',
                text,
                department: userData.department,
                createdAt: new Date().toISOString(),
            });
            setNewRule({ title: '', text: '' });
        } catch (error) {
            console.error('Error adding constraint:', error);
            alert('Failed to save rule.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this constraint?')) return;
        setIsDeleting(id);
        try {
            await deleteDoc(doc(db, 'constraints', id));
        } catch (error) {
            console.error('Error deleting constraint:', error);
            alert('Failed to delete constraint.');
        } finally {
            setIsDeleting(null);
        }
    };

    const isNlRule = (c) => c.kind === 'natural_language' && (c.text || '').trim();
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <InstructionGuide
                title="Department scheduling rules"
                steps={[
                    'Save policies for your department in plain English (lecturers, levels, courses, or whole-dept).',
                    'When you generate a lecture timetable, rules are sent to the AI parser with your courses and staff list, then applied by the OR-Tools solver.',
                    'You can still add one-off rules on the timetable page before each run.',
                ]}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-1 border-indigo-100 shadow-md h-fit">
                    <CardHeader className="bg-indigo-50/50 border-b border-indigo-50">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <Sparkles className="text-indigo-600" size={20} />
                            Add department rule
                        </CardTitle>
                        <CardDescription>
                            Natural language only—this department&apos;s coordinators can edit the list anytime.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Short label (optional)</label>
                            <input
                                className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm font-medium bg-white"
                                placeholder="e.g. Friday policy, 400L lab block"
                                value={newRule.title}
                                onChange={(e) => setNewRule({ ...newRule, title: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                <MessageSquare size={14} />
                                Rule in plain language
                            </label>
                            <textarea
                                className="w-full min-h-[140px] rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                placeholder={'Examples:\n• No 300-level courses on Friday afternoons.\n• Dr. Ada Smith is unavailable Monday mornings.\n• CSC301 must not be scheduled before 11am on Tuesdays.'}
                                value={newRule.text}
                                onChange={(e) => setNewRule({ ...newRule, text: e.target.value })}
                            />
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                            Rules are stored per department. Timetable generation uses your{' '}
                            <strong className="text-slate-700">VITE_GEMINI_API_KEY</strong> to turn them into
                            structured exclusions before solving.
                        </p>
                        <Button
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold"
                            onClick={handleAddNl}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <RefreshCw size={16} className="mr-2 animate-spin" />
                            ) : (
                                <Save size={16} className="mr-2" />
                            )}
                            {isSaving ? 'Saving…' : 'Save rule'}
                        </Button>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2 border-slate-200 shadow-sm">
                    <CardHeader className="border-b border-slate-100">
                        <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-700">
                            <ShieldAlert className="text-amber-500" size={20} />
                            Active rules ({userData?.department})
                        </CardTitle>
                        <CardDescription>
                            Saved here apply every time this department runs timetable generation.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="p-16 flex justify-center">
                                <RefreshCw className="animate-spin text-indigo-500" size={28} />
                            </div>
                        ) : constraints.length === 0 ? (
                            <div className="p-20 text-center text-slate-400">
                                <Info className="mx-auto mb-4 opacity-50" size={40} />
                                <p className="font-medium">No saved rules yet.</p>
                                <p className="text-sm mt-2 max-w-md mx-auto">
                                    Add natural-language policies on the left; they will be enforced on the next
                                    generation.
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {constraints.map((c) => (
                                    <div
                                        key={c.id}
                                        className="p-4 flex items-start justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                                    >
                                        <div className="flex items-start gap-4 min-w-0">
                                            <div
                                                className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center ${
                                                    isNlRule(c)
                                                        ? 'bg-violet-50 text-violet-600'
                                                        : 'bg-amber-50 text-amber-600'
                                                }`}
                                            >
                                                {isNlRule(c) ? <Sparkles size={18} /> : <ShieldAlert size={18} />}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                    <span className="font-bold text-slate-900 truncate">
                                                        {isNlRule(c)
                                                            ? c.title || 'Department rule'
                                                            : 'Lecturer availability (legacy)'}
                                                    </span>
                                                    <span
                                                        className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                                                            isNlRule(c)
                                                                ? 'bg-violet-100 text-violet-800'
                                                                : 'bg-amber-100 text-amber-800'
                                                        }`}
                                                    >
                                                        {isNlRule(c) ? 'Natural language' : 'Structured'}
                                                    </span>
                                                </div>
                                                {isNlRule(c) ? (
                                                    <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                                                        {c.text}
                                                    </p>
                                                ) : (
                                                    <p className="text-sm text-slate-600">
                                                        <span className="font-semibold text-slate-800">{c.lecturer}</span>{' '}
                                                        unavailable on <span className="font-semibold">{c.day}</span> during{' '}
                                                        <span className="font-semibold text-indigo-600">{c.timeSlot}</span>
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-slate-300 hover:text-red-500 shrink-0"
                                            onClick={() => handleDelete(c.id)}
                                            disabled={isDeleting === c.id}
                                            aria-label="Delete rule"
                                        >
                                            {isDeleting === c.id ? (
                                                <RefreshCw size={16} className="animate-spin text-red-500" />
                                            ) : (
                                                <Trash2 size={16} />
                                            )}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default ConstraintSettings;
