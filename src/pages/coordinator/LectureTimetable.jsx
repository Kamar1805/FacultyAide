import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc, onSnapshot, orderBy } from 'firebase/firestore';
import { generateSchedule, DAYS, HOURS } from '../../utils/timetableEngine';
import { parseAIConstraints } from '../../utils/aiParser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import {
    Calendar, Clock, User, Building2, FileDown, Rocket, Check,
    AlertCircle, RefreshCw, Layers, Sparkles, Plus, MessageSquare,
    Play, Download, MapPin, Trash2, Home, Share2, Save, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';


const LectureTimetable = () => {
    const { userData } = useOutletContext();
    const navigate = useNavigate();

    // State for Fetching Real Data
    const [fetchedCourses, setFetchedCourses] = useState([]);
    const [fetchedVenues, setFetchedVenues] = useState([]);
    const [storedConstraints, setStoredConstraints] = useState([]);
    const [loadingData, setLoadingData] = useState(true);

    // Generation State
    const [step, setStep] = useState(1); // 1: Setup, 2: Generating, 3: Result
    const [progress, setProgress] = useState(0);
    const [nlConstraint, setNlConstraint] = useState('');
    const [addedConstraints, setAddedConstraints] = useState([]);
    const [generatedResult, setGeneratedResult] = useState({ schedule: [], conflicts: [] });
    const [activeLevelTab, setActiveLevelTab] = useState('All');
    const [isPrinting, setIsPrinting] = useState(false);
    const [printScope, setPrintScope] = useState('All');
    const [showExportOptions, setShowExportOptions] = useState(false);
    const [viewMode, setViewMode] = useState('generate'); // 'generate' or 'saved'
    const [savedTimetables, setSavedTimetables] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [saveModalOpen, setSaveModalOpen] = useState(false);
    const [newTimetableName, setNewTimetableName] = useState('');

    // Fetch Saved Timetables
    useEffect(() => {
        if (!userData?.department) return;

        const q = query(
            collection(db, 'saved_timetables'),
            where('department', '==', userData.department),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSavedTimetables(list);
        });

        return () => unsubscribe();
    }, [userData]);

    // Fetch Base Data on Mount
    useEffect(() => {
        const fetchData = async () => {
            setLoadingData(true);
            if (!userData?.department) {
                setLoadingData(false);
                return;
            }

            try {
                // 1. Fetch Department Courses
                const coursesQ = query(collection(db, 'courses'), where('department', '==', userData.department));
                const coursesSnap = await getDocs(coursesQ);
                const courses = coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // 2. Fetch Relevant Venues (Department + General)
                const venueDepts = [...new Set(['General', userData.department])];
                const venuesQ = query(collection(db, 'venues'), where('dept', 'in', venueDepts));
                const venuesSnap = await getDocs(venuesQ);
                const venues = venuesSnap.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(v => v.status === 'available');

                // 3. Fetch Stored Constraints
                const constraintsQ = query(collection(db, 'constraints'), where('department', '==', userData.department));
                const constraintsSnap = await getDocs(constraintsQ);
                const constraints = constraintsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                setFetchedCourses(courses);
                setFetchedVenues(venues);
                setStoredConstraints(constraints);
            } catch (error) {
                console.error("Error fetching generation data:", error);
            } finally {
                setLoadingData(false);
            }
        };

        fetchData();
    }, [userData]);

    const handleAddConstraint = () => {
        if (!nlConstraint.trim()) return;
        setAddedConstraints([...addedConstraints, nlConstraint]);
        setNlConstraint('');
    };

    const handleGenerate = async () => {
        if (fetchedCourses.length === 0) {
            alert("No courses found! Please add courses in the 'Courses' page first.");
            navigate('/coordinator/courses');
            return;
        }
        if (fetchedVenues.length === 0) {
            alert("No venues available! Please contact Admin to map halls to your department.");
            return;
        }

        setStep(2);
        setProgress(0);

        try {
            // 1. AI Parsing of NL Constraints
            const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
            let parsedConstraints = [];

            if (addedConstraints.length > 0 && geminiKey) {
                setProgress(20);
                parsedConstraints = await parseAIConstraints(addedConstraints, geminiKey);
            } else if (addedConstraints.length > 0 && !geminiKey) {
                console.warn("VITE_GEMINI_API_KEY is missing. Skipping AI constraint parsing.");
                alert("AI Parsing is unavailable (API Key missing), but scheduling will continue with basic rules.");
            }

            setProgress(40);

            // 2. Run Scheduling Engine
            // Small delay to simulate "thinking" for UX
            await new Promise(resolve => setTimeout(resolve, 800));
            setProgress(70);

            const result = generateSchedule(
                fetchedCourses,
                fetchedVenues,
                [...parsedConstraints, ...storedConstraints] // Combine AI and Manual constraints
            );

            setProgress(90);
            await new Promise(resolve => setTimeout(resolve, 500));

            setGeneratedResult(result);
            setProgress(100);
            setStep(3);
        } catch (error) {
            console.error("Generation failed:", error);
            alert("An error occurred during generation. Please try again.");
            setStep(1);
        }
    };

    const handleSaveTimetable = async () => {
        if (!newTimetableName.trim()) return;
        setIsSaving(true);
        try {
            await addDoc(collection(db, 'saved_timetables'), {
                name: newTimetableName,
                department: userData.department,
                schedule: generatedResult.schedule,
                conflicts: generatedResult.conflicts,
                createdAt: new Date().toISOString(),
                isActive: false
            });
            setSaveModalOpen(false);
            setNewTimetableName('');
            alert("Timetable saved successfully!");
        } catch (error) {
            console.error("Error saving timetable:", error);
            alert("Failed to save timetable.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteTimetable = async (id) => {
        if (window.confirm("Are you sure you want to delete this saved timetable?")) {
            try {
                await deleteDoc(doc(db, 'saved_timetables', id));
            } catch (error) {
                console.error("Error deleting timetable:", error);
            }
        }
    };

    const handleSetActive = async (timetable) => {
        try {
            // 1. Deactivate all others in this department
            for (const t of savedTimetables) {
                if (t.isActive && t.id !== timetable.id) {
                    await updateDoc(doc(db, 'saved_timetables', t.id), { isActive: false });
                }
            }
            // 2. Set this one as active (toggle)
            const newStatus = !timetable.isActive;
            await updateDoc(doc(db, 'saved_timetables', timetable.id), { isActive: newStatus });
            alert(newStatus ? "Timetable set as active for dashboard!" : "Timetable removed from dashboard.");
        } catch (error) {
            console.error("Error setting active timetable:", error);
            alert("Failed to update dashboard status.");
        }
    };

    const handleDownloadPDF = async (level = 'All') => {
        const element = level === 'All'
            ? document.getElementById('timetable-container')
            : document.querySelector(`[data-level="${level}"]`);

        if (!element) {
            alert("Timetable element not found for export.");
            return;
        }

        try {
            // Add a temporary class to force background visibility and hide non-exportable items
            element.classList.add('pdf-export-mode');

            const canvas = await html2canvas(element, {
                scale: 3, // Higher scale for better quality
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                onclone: (clonedDoc) => {
                    // Hide any 'no-print' elements in the clone
                    const noPrint = clonedDoc.querySelectorAll('.no-print');
                    noPrint.forEach(el => el.style.display = 'none');
                }
            });

            element.classList.remove('pdf-export-mode');

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
            pdf.save(`Nile-Timetable-${level}-${userData.department}-${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`);
        } catch (error) {
            console.error("PDF Export failed:", error);
            alert("Failed to generate PDF. Check console for details.");
        }
    };

    const handleShareWhatsApp = (level = 'All') => {
        const text = `*OFFICIAL NILE UNIVERSITY TIMETABLE*\nDept: ${userData.department}\nLevel: ${level}\n\nGenerated via Nile FacultyAide. Please check your dashboard for the full interactive view!`;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    };
    // Helper to group courses by level for display
    const coursesByLevel = fetchedCourses.reduce((acc, course) => {
        const lvl = course.level || 'Unknown';
        if (!acc[lvl]) acc[lvl] = 0;
        acc[lvl]++;
        return acc;
    }, {});

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Main Navigation Tabs */}
            <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit border border-slate-200 shadow-sm no-print">
                <Button
                    variant={viewMode === 'generate' ? 'default' : 'ghost'}
                    onClick={() => setViewMode('generate')}
                    className={`rounded-xl px-6 h-10 font-bold transition-all ${viewMode === 'generate' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:text-slate-900'}`}
                >
                    <Rocket size={16} className="mr-2" />
                    {step === 3 ? 'Current Result' : 'Generate New'}
                </Button>
                <Button
                    variant={viewMode === 'saved' ? 'default' : 'ghost'}
                    onClick={() => setViewMode('saved')}
                    className={`rounded-xl px-6 h-10 font-bold transition-all ${viewMode === 'saved' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:text-slate-900'}`}
                >
                    <Layers size={16} className="mr-2" />
                    Saved Timetables
                    {savedTimetables.length > 0 && <span className="ml-2 px-1.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px]">{savedTimetables.length}</span>}
                </Button>
            </div>

            {viewMode === 'saved' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-4 duration-500">
                    <AnimatePresence>
                        {savedTimetables.map((t, index) => (
                            <motion.div
                                key={t.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <Card className={`group transition-all border-slate-200 relative overflow-hidden h-full flex flex-col hover:border-indigo-200 hover:shadow-2xl hover:shadow-indigo-50/50 ${t.isActive ? 'ring-2 ring-indigo-500 ring-offset-2 border-transparent' : ''}`}>
                                    {t.isActive && (
                                        <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[9px] font-black uppercase px-4 py-1.5 rounded-bl-xl shadow-lg z-20 flex items-center gap-1.5">
                                            <Check size={10} strokeWidth={4} /> Active version
                                        </div>
                                    )}
                                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-50 rounded-full group-hover:scale-150 transition-transform duration-700 opacity-50"></div>

                                    <CardHeader className="pb-4 relative z-10">
                                        <CardTitle className="text-xl font-black text-slate-800 tracking-tight leading-tight pr-6">{t.name}</CardTitle>
                                        <div className="flex items-center gap-3 mt-2">
                                            <div className="flex items-center gap-1 text-[10px] uppercase font-black tracking-widest text-slate-400 bg-slate-50 px-2 py-0.5 rounded">
                                                <Calendar size={10} />
                                                {new Date(t.createdAt).toLocaleDateString()}
                                            </div>
                                            <div className="flex items-center gap-1 text-[10px] uppercase font-black tracking-widest text-indigo-400 bg-indigo-50 px-2 py-0.5 rounded">
                                                <Layers size={10} />
                                                {t.schedule?.length || 0} Slots
                                            </div>
                                        </div>
                                    </CardHeader>

                                    <CardContent className="space-y-5 relative z-10 flex-1 flex flex-col justify-between">
                                        <div className="flex gap-2">
                                            <Button
                                                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs h-11 rounded-xl shadow-md transition-all active:scale-95"
                                                onClick={() => {
                                                    setGeneratedResult({ schedule: t.schedule, conflicts: t.conflicts || [] });
                                                    setStep(3);
                                                    setViewMode('generate');
                                                }}
                                            >
                                                <Play size={14} className="mr-2" /> Load Now
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className={`flex-1 font-black text-xs h-11 rounded-xl transition-all active:scale-95 ${t.isActive ? 'border-indigo-100 text-indigo-600 bg-indigo-50/50' : 'text-slate-600 border-slate-200'}`}
                                                onClick={() => handleSetActive(t)}
                                            >
                                                <Home size={14} className="mr-2" /> {t.isActive ? 'Active' : 'Set Active'}
                                            </Button>
                                        </div>

                                        <div className="flex justify-between items-center py-4 border-t border-slate-100">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-slate-400 hover:text-red-500 hover:bg-red-50 font-bold transition-colors"
                                                onClick={() => handleDeleteTimetable(t.id)}
                                            >
                                                <Trash2 size={14} className="mr-2" /> Delete
                                            </Button>
                                            <div className="flex gap-2">
                                                <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-slate-100 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all" onClick={() => {
                                                    setGeneratedResult({ schedule: t.schedule, conflicts: t.conflicts || [] });
                                                    handleDownloadPDF();
                                                }}>
                                                    <Download size={16} />
                                                </Button>
                                                <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-slate-100 text-slate-400 hover:text-emerald-600 hover:border-emerald-200 transition-all" onClick={() => handleShareWhatsApp()}>
                                                    <MessageSquare size={16} />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    {savedTimetables.length === 0 && (
                        <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl">
                            <Layers size={48} className="mx-auto text-slate-200 mb-4" />
                            <p className="text-slate-500 font-bold">No saved timetables yet.</p>
                            <p className="text-xs text-slate-400 mt-1">Generate one and click "Save" to see it here.</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-6">
                    {step === 1 && (
                        <div className="space-y-6">
                            <div className="flex flex-col gap-2">
                                <h1 className="text-3xl font-bold text-slate-900">Generate New Timetable</h1>
                                <p className="text-slate-500">
                                    Generating schedule for <span className="font-bold text-indigo-600">{userData?.department}</span> using <span className="font-bold">{fetchedCourses.length} Courses</span> and <span className="font-bold">{fetchedVenues.length} Venues</span>.
                                </p>
                            </div>

                            {loadingData ? (
                                <div className="py-20 text-center">
                                    <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                                    <p className="text-slate-500">Fetching department data...</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    {/* Left Col: Data Summary */}
                                    <Card className="lg:col-span-2 border-slate-200 shadow-sm h-fit">
                                        <CardHeader>
                                            <CardTitle className="text-lg font-bold">1. Verified Data Scope</CardTitle>
                                            <CardDescription>The engine will schedule based on the following available resources.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-3">
                                                {/* Courses Summary */}
                                                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold">
                                                            {fetchedCourses.length}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-700">Total Active Courses</div>
                                                            <div className="text-xs text-slate-500 flex gap-2">
                                                                {Object.entries(coursesByLevel).map(([lvl, count]) => (
                                                                    <span key={lvl}>{count} in {lvl}Lvl</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Button variant="outline" size="sm" onClick={() => navigate('/coordinator/courses')}>Manage</Button>
                                                </div>

                                                {/* Venues Summary */}
                                                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-bold">
                                                            {fetchedVenues.length}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-700">Available Venues</div>
                                                            <div className="text-xs text-slate-500">
                                                                Includes {fetchedVenues.filter(v => v.dept === 'General').length} General & {fetchedVenues.filter(v => v.dept !== 'General').length} Department-specific halls.
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {fetchedVenues.length === 0 && (
                                                        <div className="flex items-center text-amber-600 text-xs font-bold gap-1">
                                                            <AlertCircle size={14} /> No venues found
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {fetchedCourses.length === 0 && (
                                                <div className="mt-4 p-4 bg-amber-50 text-amber-800 rounded-lg text-sm border border-amber-100 flex items-start gap-2">
                                                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                                                    <div>
                                                        <strong>Action Required:</strong> You have not added any courses for this department yet. Please go to the 'Courses' page and catalog your curriculum before generating a timetable.
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Right Col: Natural Language Constraints */}
                                    <Card className="border-indigo-100 shadow-md ring-1 ring-indigo-50 h-fit">
                                        <CardHeader className="bg-gradient-to-br from-indigo-50 to-white pb-4 border-b border-indigo-50">
                                            <CardTitle className="text-lg font-bold flex items-center gap-2 text-indigo-900">
                                                <Sparkles className="text-indigo-500" size={18} />
                                                AI Constraints
                                            </CardTitle>
                                            <CardDescription>Add complex rules in plain English.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="pt-6 space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase">New Constraint</label>
                                                <div className="relative">
                                                    <textarea
                                                        className="w-full min-h-[100px] p-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                                        placeholder="e.g., 'Ensure Dr. Smith does not have lectures on Monday morning'"
                                                        value={nlConstraint}
                                                        onChange={(e) => setNlConstraint(e.target.value)}
                                                    />
                                                    <Button
                                                        size="sm"
                                                        className="absolute bottom-2 right-2 h-7 bg-indigo-600 hover:bg-indigo-700"
                                                        onClick={handleAddConstraint}
                                                    >
                                                        <Plus size={14} className="mr-1" /> Add
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                {addedConstraints.length > 0 && <p className="text-xs font-bold text-slate-400 uppercase">Active Rules:</p>}
                                                {addedConstraints.map((c, i) => (
                                                    <div key={i} className="flex items-start gap-2 text-sm bg-indigo-50 text-indigo-800 p-2 rounded border border-indigo-100">
                                                        <MessageSquare size={14} className="mt-0.5 shrink-0 opacity-50" />
                                                        <span>{c}</span>
                                                    </div>
                                                ))}
                                                <div className="flex items-start gap-2 text-sm bg-slate-50 text-slate-600 p-2 rounded border border-slate-100 opacity-60">
                                                    <MessageSquare size={14} className="mt-0.5 shrink-0 opacity-50" />
                                                    <span>Default: No double booking of rooms.</span>
                                                </div>
                                            </div>

                                            <Button
                                                size="lg"
                                                className="w-full mt-4 font-bold bg-slate-900 hover:bg-slate-800 disabled:opacity-50"
                                                onClick={handleGenerate}
                                                disabled={fetchedCourses.length === 0}
                                            >
                                                <Play size={16} className="mr-2" /> Start Generation Engine
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 2 && (
                        <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6">
                            <div className="relative w-32 h-32">
                                <svg className="animate-spin w-full h-full text-indigo-100" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                    <path className="opacity-75 text-indigo-600" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center font-bold text-indigo-600 text-xl">
                                    {progress}%
                                </div>
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900">Generating Optimal Schedule...</h2>
                                <p className="text-slate-500 mt-2">
                                    Processing {fetchedCourses.length} courses across {fetchedVenues.length} venues.
                                </p>
                            </div>
                            <div className="w-full max-w-md bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div className="h-full bg-indigo-600 transition-all duration-100" style={{ width: `${progress}%` }}></div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6 max-w-6xl mx-auto">
                            {/* Conflicts Alert */}
                            {generatedResult.conflicts.length > 0 && (
                                <Card className="border-amber-200 bg-amber-50/50 rounded-2xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-top-4 duration-700">
                                    <div className="bg-amber-100/50 p-4 border-b border-amber-200/50 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 bg-amber-200 text-amber-900 rounded-xl flex items-center justify-center shadow-inner">
                                                <AlertCircle size={22} className="animate-pulse" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-amber-900 uppercase tracking-tight">Deployment Notice</h3>
                                                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest leading-none mt-0.5">
                                                    {generatedResult.conflicts.length} Unscheduled Courses
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-[10px] font-black text-amber-600 bg-amber-100 px-3 py-1 rounded-full uppercase tracking-tighter shadow-sm border border-amber-200">
                                            Resource Conflict
                                        </div>
                                    </div>
                                    <CardContent className="p-4 bg-white/50 space-y-3">
                                        {generatedResult.conflicts.map(c => (
                                            <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white rounded-xl border border-amber-100 shadow-sm transition-all hover:border-amber-200">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 bg-slate-900 text-white rounded-lg flex items-center justify-center font-black text-[10px] border border-slate-800 shadow-md">
                                                        {c.code}
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-black text-slate-900 uppercase pr-4">{c.title}</div>
                                                        <div className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-0.5">
                                                            <X size={10} strokeWidth={4} /> {c.reason || 'General resource constraint'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="text-[9px] font-black text-slate-400 border border-slate-100 px-2 py-0.5 rounded uppercase tracking-widest">
                                                        {c.level}L • {c.type}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        <div className="p-3 bg-amber-50/50 rounded-xl border border-dashed border-amber-200 text-[11px] text-amber-800 font-bold flex items-center justify-center gap-2">
                                            <Sparkles size={14} className="text-amber-500" />
                                            TIP: Try adding more venues or adjusting course durations in Management.
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Header Controls */}
                            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 no-print">
                                <div className="flex items-center gap-3">
                                    <Button variant="outline" onClick={() => setStep(1)} className="rounded-full">
                                        <RefreshCw size={16} className="mr-2" /> Re-configure
                                    </Button>
                                    <Button onClick={() => setSaveModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-full">
                                        <Save size={16} className="mr-2" /> Save Timetable
                                    </Button>
                                </div>
                                <div className="flex items-center gap-3 w-full sm:w-auto relative">
                                    <div className="flex bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
                                        <Button
                                            variant={activeLevelTab === 'All' ? 'default' : 'ghost'}
                                            size="sm"
                                            onClick={() => setActiveLevelTab('All')}
                                            className={`rounded-lg text-[10px] font-black uppercase tracking-tighter h-8 ${activeLevelTab === 'All' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500'}`}
                                        >
                                            All Levels
                                        </Button>
                                        {[100, 200, 300, 400].map(lvl => (
                                            <Button
                                                key={lvl}
                                                variant={activeLevelTab === lvl.toString() ? 'default' : 'ghost'}
                                                size="sm"
                                                onClick={() => setActiveLevelTab(lvl.toString())}
                                                className={`rounded-lg text-[10px] font-black uppercase tracking-tighter h-8 ${activeLevelTab === lvl.toString() ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500'}`}
                                            >
                                                {lvl}L
                                            </Button>
                                        ))}
                                    </div>

                                    <div className="relative">
                                        <Button
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 px-6 rounded-xl shadow-lg shadow-indigo-100 flex items-center gap-2"
                                            onClick={() => setShowExportOptions(!showExportOptions)}
                                        >
                                            <Share2 size={18} />
                                            Export / Share
                                        </Button>

                                        {showExportOptions && (
                                            <div className="absolute right-0 top-12 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                                <div className="p-2 border-b border-slate-50 bg-slate-50/50">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Official Export</span>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        handleDownloadPDF(activeLevelTab);
                                                        setShowExportOptions(false);
                                                    }}
                                                    className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors border-b border-slate-50 flex items-center gap-3"
                                                >
                                                    <Download size={14} className="text-indigo-500" />
                                                    Download as PDF
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        handleShareWhatsApp(activeLevelTab);
                                                        setShowExportOptions(false);
                                                    }}
                                                    className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 transition-colors flex items-center gap-3"
                                                >
                                                    <MessageSquare size={14} className="text-emerald-500" />
                                                    Share via WhatsApp
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div id="timetable-container" className="space-y-12">
                                {(() => {
                                    const standardLevels = ['100', '200', '300', '400'];
                                    const levelsToRender = activeLevelTab === 'All' ? standardLevels : [activeLevelTab];

                                    return levelsToRender.map(level => {
                                        const levelSchedule = generatedResult.schedule.filter(s => s.level.toString() === level);
                                        if (levelSchedule.length === 0 && activeLevelTab !== 'All') {
                                            return (
                                                <div key={level} className="py-20 text-center bg-white rounded-2xl border border-slate-200">
                                                    <Calendar size={48} className="mx-auto text-slate-100 mb-4" />
                                                    <p className="text-slate-400 font-bold">No courses scheduled for {level} Level.</p>
                                                </div>
                                            );
                                        }
                                        if (levelSchedule.length === 0) return null;

                                        return (
                                            <div key={level} data-level={level} className="bg-white shadow-2xl rounded-2xl border border-slate-200 overflow-hidden print:shadow-none print:border-none print:break-after-page">
                                                {/* Level Summary Header */}
                                                <div className="bg-slate-900 p-4 px-8 flex justify-between items-center text-white relative overflow-hidden">
                                                    <div className="absolute top-0 right-0 w-64 h-full bg-indigo-600/10 skew-x-12 translate-x-32 pointer-events-none"></div>
                                                    <div className="flex items-center gap-5 relative z-10">
                                                        <div className="h-12 w-12 bg-white rounded-xl flex items-center justify-center p-1.5 shadow-lg">
                                                            <img src="/nile.jpeg" alt="Nile Logo" className="h-full w-full object-contain" />
                                                        </div>
                                                        <div>
                                                            <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                                                                {level} Level Timetable
                                                                <span className="px-2 py-0.5 bg-indigo-500 text-[10px] rounded-full uppercase tracking-tighter shadow-sm">Official</span>
                                                            </h2>
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
                                                                NILE UNIVERSITY OF NIGERIA • {userData?.department}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Session</div>
                                                        <div className="text-sm font-black text-white">2024/2025 Academic</div>
                                                    </div>
                                                </div>

                                                <div className="overflow-x-auto">
                                                    <table className="w-full border-collapse border border-slate-300">
                                                        <thead className="bg-slate-100">
                                                            <tr>
                                                                <th className="p-3 border border-slate-300 text-[11px] font-black text-red-600 uppercase tracking-wider text-center w-24">Code</th>
                                                                <th className="p-3 border border-slate-300 text-[11px] font-black text-red-600 uppercase tracking-wider text-left">Course Title</th>
                                                                <th className="p-3 border border-slate-300 text-[11px] font-black text-red-600 uppercase tracking-wider text-center w-32">Time</th>
                                                                <th className="p-3 border border-slate-300 text-[11px] font-black text-red-600 uppercase tracking-wider text-center w-28">Day</th>
                                                                <th className="p-3 border border-slate-300 text-[11px] font-black text-red-600 uppercase tracking-wider text-center w-24">Venue</th>
                                                                <th className="p-3 border border-slate-300 text-[11px] font-black text-red-600 uppercase tracking-wider text-left">Lecturer</th>
                                                                <th className="p-3 border border-slate-300 text-[11px] font-black text-red-600 uppercase tracking-wider text-center w-20">Hours</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-200">
                                                            {DAYS.map(day => {
                                                                const dayItems = levelSchedule
                                                                    .filter(s => s.assignedDay === day)
                                                                    .sort((a, b) => a.assignedStart - b.assignedStart);

                                                                if (dayItems.length === 0) return null;

                                                                return dayItems.map((slot, idx) => {
                                                                    const start = slot.assignedStart;
                                                                    const end = slot.assignedEnd;
                                                                    const formatTime = (h) => {
                                                                        const meridian = h >= 12 ? 'PM' : 'AM';
                                                                        const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
                                                                        return `${hour}${meridian}`;
                                                                    };

                                                                    return (
                                                                        <tr key={`${slot.id}-${idx}`} className="hover:bg-slate-50 transition-colors">
                                                                            <td className="p-3 border border-slate-200 text-xs font-black text-slate-900 text-center uppercase">{slot.code}</td>
                                                                            <td className="p-3 border border-slate-200 text-xs font-black text-slate-800 uppercase">{slot.title}</td>
                                                                            <td className="p-3 border border-slate-200 text-xs font-black text-slate-900 text-center whitespace-nowrap">
                                                                                {formatTime(start)} - {formatTime(end)}
                                                                            </td>
                                                                            <td className="p-3 border border-slate-200 text-xs font-black text-slate-900 text-center uppercase">{day}</td>
                                                                            <td className="p-3 border border-slate-200 text-xs font-black text-slate-900 text-center uppercase">{slot.assignedVenue?.name}</td>
                                                                            <td className="p-3 border border-slate-200 text-xs font-black text-slate-700 uppercase">{slot.lecturer || 'Staff'}</td>
                                                                            <td className="p-3 border border-slate-200 text-sm font-black text-slate-900 text-center">{end - start}</td>
                                                                        </tr>
                                                                    );
                                                                });
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center no-print">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></div>
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Optimization Active</span>
                                                    </div>
                                                    <p className="text-[9px] text-slate-400 font-bold italic">Generated via Nile FacultyAide Timetable Engine</p>
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Save Timetable Modal */}
            {saveModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <Card className="w-full max-w-md shadow-2xl border-indigo-100 animate-in zoom-in-95 duration-200">
                        <CardHeader className="pb-4">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-xl font-bold">Save Current Timetable</CardTitle>
                                <Button variant="ghost" size="icon" onClick={() => setSaveModalOpen(false)} className="rounded-full h-8 w-8">
                                    <X size={18} />
                                </Button>
                            </div>
                            <CardDescription>Give this version a name to access it later or set it on your dashboard.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Timetable Name</label>
                                <input
                                    type="text"
                                    className="w-full h-12 px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                                    placeholder="e.g., First Semester 2024/25 Final"
                                    value={newTimetableName}
                                    onChange={(e) => setNewTimetableName(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <Button
                                className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl"
                                onClick={handleSaveTimetable}
                                disabled={isSaving || !newTimetableName.trim()}
                            >
                                {isSaving ? (
                                    <div className="flex items-center gap-2">
                                        <RefreshCw size={16} className="animate-spin" /> Saving...
                                    </div>
                                ) : (
                                    'Confirm & Save Configuration'
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default LectureTimetable;
