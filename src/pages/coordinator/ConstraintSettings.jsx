import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { ShieldAlert, Clock, User, Plus, Trash2, Save, Info } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import InstructionGuide from '../../components/InstructionGuide';
import { db } from '../../firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc, query, where, getDocs } from 'firebase/firestore';

const ConstraintSettings = () => {
    const { userData } = useOutletContext();
    const [constraints, setConstraints] = useState([]);
    const [lecturers, setLecturers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(null);

    const [newConstraint, setNewConstraint] = useState({
        lecturer: '',
        day: 'Monday',
        type: 'Exclusion', // Exclusion (busy) or Preference (preferred)
        timeSlot: 'Morning', // Morning (9-12), Afternoon (13-17)
    });

    useEffect(() => {
        if (!userData?.department) return;

        // Fetch constraints for this dept
        const qConstraints = query(collection(db, 'constraints'), where('department', '==', userData.department));
        const unsubscribeConstraints = onSnapshot(qConstraints, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setConstraints(list);
            setLoading(false);
        });

        // Fetch lecturers for dropdown
        const fetchLecturers = async () => {
            const q = query(collection(db, 'lecturers'), where('department', '==', userData.department));
            const snap = await getDocs(q);
            setLecturers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        };
        fetchLecturers();

        return () => unsubscribeConstraints();
    }, [userData]);

    const handleAdd = async () => {
        if (!newConstraint.lecturer) return alert("Select a lecturer.");
        if (isSaving) return;

        setIsSaving(true);
        try {
            await addDoc(collection(db, 'constraints'), {
                ...newConstraint,
                department: userData.department,
                createdAt: new Date().toISOString()
            });
            setNewConstraint({ ...newConstraint, lecturer: '' });
            alert("Constraint saved successfully.");
        } catch (error) {
            console.error("Error adding constraint:", error);
            alert("Failed to save constraint.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Delete this constraint?")) {
            setIsDeleting(id);
            try {
                await deleteDoc(doc(db, 'constraints', id));
            } catch (error) {
                console.error("Error deleting constraint:", error);
                alert("Failed to delete constraint.");
            } finally {
                setIsDeleting(null);
            }
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <InstructionGuide
                title="Scheduling Constraints"
                steps={[
                    "Define when specific lecturers are unavailable.",
                    "The engine will strictly avoid these slots for the selected staff.",
                    "You can also use 'AI Constraints' on the generation page for complex rules."
                ]}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Add Constraint Form */}
                <Card className="lg:col-span-1 border-indigo-100 shadow-md h-fit">
                    <CardHeader className="bg-indigo-50/50 border-b border-indigo-50">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <Plus className="text-indigo-600" size={20} />
                            Add Restriction
                        </CardTitle>
                        <CardDescription>Manually block slots for lecturers.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Lecturer</label>
                            <select
                                className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold bg-white"
                                value={newConstraint.lecturer}
                                onChange={(e) => setNewConstraint({ ...newConstraint, lecturer: e.target.value })}
                            >
                                <option value="">Select Lecturer</option>
                                {lecturers.map(l => (
                                    <option key={l.id} value={`${l.title} ${l.name}`}>{l.title} {l.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Day of Week</label>
                            <select
                                className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold bg-white"
                                value={newConstraint.day}
                                onChange={(e) => setNewConstraint({ ...newConstraint, day: e.target.value })}
                            >
                                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(d => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Time period</label>
                            <select
                                className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold bg-white"
                                value={newConstraint.timeSlot}
                                onChange={(e) => setNewConstraint({ ...newConstraint, timeSlot: e.target.value })}
                            >
                                <option value="Morning">Morning (9 AM - 12 PM)</option>
                                <option value="Afternoon">Afternoon (1 PM - 5 PM)</option>
                                <option value="All Day">All Day (9 AM - 5 PM)</option>
                            </select>
                        </div>

                        <Button
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold mt-2 disabled:opacity-70"
                            onClick={handleAdd}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <RefreshCw size={16} className="mr-2 animate-spin" />
                            ) : (
                                <Save size={16} className="mr-2" />
                            )}
                            {isSaving ? 'Saving...' : 'Save Constraint'}
                        </Button>
                    </CardContent>
                </Card>

                {/* Constraints List */}
                <Card className="lg:col-span-2 border-slate-200 shadow-sm">
                    <CardHeader className="border-b border-slate-100">
                        <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-700">
                            <ShieldAlert className="text-amber-500" size={20} />
                            Active Departmental Rules
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {constraints.length === 0 ? (
                            <div className="p-20 text-center text-slate-400">
                                <Info className="mx-auto mb-4 opacity-50" size={40} />
                                <p className="font-medium">No manual constraints defined.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {constraints.map(c => (
                                    <div key={c.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
                                                <Clock size={20} />
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-900">{c.lecturer}</div>
                                                <div className="text-xs text-slate-500">
                                                    Unavailable {c.day}s during the <span className="font-bold text-indigo-600">{c.timeSlot}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-slate-300 hover:text-red-500"
                                            onClick={() => handleDelete(c.id)}
                                            disabled={isDeleting === c.id}
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
