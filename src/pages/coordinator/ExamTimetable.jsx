import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Play, Calendar, Download, RefreshCw, Filter, ShieldCheck, Users, MapPin, Save, AlertTriangle, Clock, Edit3, MessageSquare } from 'lucide-react';
import InstructionGuide from '../../components/InstructionGuide';
import { collection, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { logActivity } from '../../utils/activityLog';
import { useOutletContext, useSearchParams, useNavigate } from 'react-router-dom';
import { analyzeExamScheduleBundles } from '../../utils/timetableClashAnalysis';
import { createReviewThread, addThreadMessage, getReviewThread, markCoordinatorCaughtUp } from '../../services/timetableReviews';
import OptionalNoteToAdminsModal from '../../components/OptionalNoteToAdminsModal';

function parseExamStartMs(dateStr, hhmm) {
    const t = `${dateStr}T${String(hhmm || '09:00').slice(0, 5)}:00`;
    const x = Date.parse(t);
    return Number.isNaN(x) ? null : x;
}

function examIntervalsOverlap(exA, exB) {
    if (!exA || !exB || exA.date !== exB.date) return false;
    const ma = parseExamStartMs(exA.date, exA.startTime);
    const mb = parseExamStartMs(exB.date, exB.startTime);
    if (ma == null || mb == null) return false;
    const da = (parseInt(exA.durationMins, 10) || 90) * 60000;
    const db = (parseInt(exB.durationMins, 10) || 90) * 60000;
    return ma < mb + db && mb < ma + da;
}

function examPairHardClash(exA, exB) {
    if (!examIntervalsOverlap(exA, exB)) return false;
    const vidA = String(exA.venueId || '');
    const vidB = String(exB.venueId || '');
    const tangible = vidA && vidB && vidA !== 'TBH' && vidB !== 'TBH';
    if (tangible && vidA === vidB) return true;
    if (String(exA.department || '') === String(exB.department || '') && String(exA.level || '') === String(exB.level || ''))
        return true;
    return false;
}

function candidateClashesBuckets(candidate, internal, externalFlat) {
    for (const ex of externalFlat) {
        if (examPairHardClash(candidate, ex)) return true;
    }
    for (const ex of internal) {
        if (examPairHardClash(candidate, ex)) return true;
    }
    return false;
}

function aggregateExamConflicts(draft, externalFlat) {
    const raw = analyzeExamScheduleBundles([
        { label: 'This timetable', exams: draft || [] },
        { label: 'Other departments (published)', exams: externalFlat || [] },
    ]);
    if (!raw.hasClashes) return [];
    return raw.clashes.map(
        (c) =>
            `${c.type === 'venue' ? 'VENUE' : 'COHORT'} clash: ${c.a} ↔ ${c.b}. Suggested fix: ${c.fix}`
    );
}

const ExamTimetable = () => {
    const { userData } = useOutletContext();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const reviewThreadId = searchParams.get('reviewThread');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [timetable, setTimetable] = useState(null);
    const [generationStats, setGenerationStats] = useState({ totalExams: 0, startDate: '', endDate: '' });
    
    const [config, setConfig] = useState({
        startDate: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0],
        semester: 'First',
        morningStart: '09:00',
        afternoonStart: '14:00'
    });

    const [venues, setVenues] = useState([]);
    const [conflicts, setConflicts] = useState([]);
    const [draggedExamId, setDraggedExamId] = useState(null);
    const [editingExamId, setEditingExamId] = useState(null);
    const [editForm, setEditForm] = useState(null);
    const [sendingReview, setSendingReview] = useState(false);
    const [adminNoteModalOpen, setAdminNoteModalOpen] = useState(false);

    const [externalExamRows, setExternalExamRows] = useState([]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!userData?.department) return;
            try {
                const snap = await getDocs(collection(db, 'exam_timetables'));
                const flat = [];
                snap.docs.forEach((docSnap) => {
                    const t = docSnap.data();
                    if (t.published !== true && t.isActive !== true) return;
                    if (String(t.department || '') === String(userData.department || '')) return;
                    for (const row of t.schedule || []) flat.push(row);
                });
                if (!cancelled) setExternalExamRows(flat);
            } catch (e) {
                console.error(e);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [userData?.department]);

    useEffect(() => {
        if (!timetable?.length) {
            setConflicts([]);
            return;
        }
        setConflicts(aggregateExamConflicts(timetable, externalExamRows));
    }, [timetable, externalExamRows]);

    useEffect(() => {
        if (!reviewThreadId || !userData?.uid) return undefined;
        let cancelled = false;
        (async () => {
            try {
                const t = await getReviewThread(reviewThreadId);
                if (cancelled) return;
                if (!t || t.coordinatorUid !== userData.uid) {
                    if (t && t.coordinatorUid !== userData.uid) {
                        alert('This review thread belongs to another coordinator.');
                    }
                    setSearchParams((p) => {
                        p.delete('reviewThread');
                        return p;
                    }, { replace: true });
                    return;
                }
                if ((t.kind || 'lecture') === 'lecture') {
                    navigate(`/coordinator/lecture-timetable?reviewThread=${reviewThreadId}`, { replace: true });
                    return;
                }
                const snap = t.snapshot || {};
                const sched = Array.isArray(snap.schedule) ? [...snap.schedule] : [];
                setTimetable(sched);
                if (snap.stats && typeof snap.stats === 'object') {
                    setGenerationStats(snap.stats);
                }
                if (snap.semester === 'First' || snap.semester === 'Second') {
                    setConfig((c) => ({ ...c, semester: snap.semester }));
                }
                markCoordinatorCaughtUp(reviewThreadId).catch(() => {});
                setSearchParams((p) => {
                    p.delete('reviewThread');
                    return p;
                }, { replace: true });
            } catch (e) {
                console.error(e);
                alert('Could not load this review thread. Check Firestore rules and that you are signed in as the coordinator who submitted it.');
                setSearchParams((p) => {
                    p.delete('reviewThread');
                    return p;
                }, { replace: true });
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [reviewThreadId, userData?.uid, navigate, setSearchParams]);

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const coursesSnapshot = await getDocs(collection(db, 'courses'));
            const venuesSnapshot = await getDocs(collection(db, 'venues'));
            
            let allCourses = coursesSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
            const allVenues = venuesSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })).filter((v) => v.status !== 'maintenance');
            setVenues(allVenues);

            allCourses = allCourses.filter((c) => c.semester === config.semester || !c.semester);
            const deptCourses = allCourses.filter((c) => String(c.department || '') === String(userData?.department || '') && !c.excludeFromTimetable);

            if (deptCourses.length === 0) {
                alert(
                    userData?.department
                        ? `No ${config.semester} semester courses assigned to "${userData.department}".`
                        : 'No courses for your department.'
                );
                setIsGenerating(false);
                return;
            }

            const extSnap = await getDocs(collection(db, 'exam_timetables'));
            const externalFlat = [];
            extSnap.docs.forEach((docSnap) => {
                const t = docSnap.data();
                if (t.published !== true && t.isActive !== true) return;
                if (String(t.department || '') === String(userData?.department || '')) return;
                for (const row of t.schedule || []) externalFlat.push(row);
            });
            setExternalExamRows(externalFlat);

            const bumpDay = (d) => {
                const nd = new Date(d);
                nd.setDate(nd.getDate() + 1);
                if (nd.getDay() === 6) nd.setDate(nd.getDate() + 2);
                else if (nd.getDay() === 0) nd.setDate(nd.getDate() + 1);
                return nd;
            };

            const generatedExams = [];
            let cursor = new Date(config.startDate);
            let session = 'Morning';
            const queue = [...deptCourses].sort((a, b) => a.level - b.level);

            outer: while (queue.length > 0) {
                const course = queue.shift();
                const units = parseInt(course.creditUnit, 10) || 2;
                const durationMins = units === 3 ? 120 : units >= 4 ? 150 : units === 1 ? 60 : 90;

                let placed = false;
                let tries = 0;
                while (!placed && tries < 3200) {
                    tries++;
                    const dateString = cursor.toISOString().split('T')[0];
                    const startTime = session === 'Morning' ? config.morningStart : config.afternoonStart;

                    const deptV = allVenues.filter((v) => v.dept === course.department);
                    const genV = allVenues.filter((v) => v.dept === 'General');
                    let pool =
                        deptV.length > 0 ? [...deptV] : [...genV, ...allVenues.filter((x) => !genV.some((g) => g.id === x.id))];
                    if (pool.length === 0) pool = [{ id: 'TBH', name: 'TBA', capacity: 50 }];
                    pool = [...pool].sort(() => Math.random() - 0.5);

                    for (const assignedVenue of pool) {
                        const candidate = {
                            id: course.id,
                            courseCode: course.code,
                            courseTitle: course.title,
                            department: course.department,
                            level: course.level,
                            creditUnit: course.creditUnit || 2,
                            durationMins,
                            venueId: assignedVenue.id,
                            venueName: assignedVenue.name,
                            venueCapacity: assignedVenue.capacity,
                            date: dateString,
                            startTime,
                            session,
                            invigilatorsAssigned: Math.max(
                                1,
                                Math.ceil((assignedVenue.capacity === 'N/A' ? 50 : assignedVenue.capacity) / 40)
                            ),
                        };
                        if (!candidateClashesBuckets(candidate, generatedExams, externalFlat)) {
                            generatedExams.push(candidate);
                            placed = true;
                            if (session === 'Morning') {
                                session = 'Afternoon';
                            } else {
                                session = 'Morning';
                                cursor = bumpDay(cursor);
                            }
                            continue outer;
                        }
                    }

                    if (session === 'Morning') {
                        session = 'Afternoon';
                    } else {
                        session = 'Morning';
                        cursor = bumpDay(cursor);
                    }
                }

                alert(
                    `Could not place "${course.code}" without clashing venues/cohorts elsewhere. Leave more dates or regenerate.`
                );
            }

            generatedExams.sort((a, b) => new Date(a.date) - new Date(b.date));

            setGenerationStats({
                totalExams: generatedExams.length,
                startDate: generatedExams[0]?.date,
                endDate: generatedExams[generatedExams.length - 1]?.date,
            });

            setTimetable(generatedExams);
        } catch (error) {
            console.error("Error generating exams:", error);
            alert("Failed to generate timetable.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = async () => {
        if (!timetable || conflicts.length > 0) {
            alert("Please resolve conflicts before saving!");
            return;
        }
        setIsSaving(true);
        try {
            const ref = await addDoc(collection(db, 'exam_timetables'), {
                department: userData?.department || 'General',
                coordinatorUid: auth.currentUser?.uid || null,
                coordinatorName: userData?.name || '',
                semester: config.semester,
                isActive: true,
                schedule: timetable,
                stats: generationStats,
                createdAt: Timestamp.now(),
                published: true,
                publishedAt: new Date().toISOString(),
                type: 'exam',
                name: `${config.semester} Semester Exam Timetable`
            });
            await logActivity(db, {
                uid: auth.currentUser?.uid,
                userName: userData?.name,
                userRole: 'coordinator',
                department: userData?.department,
                action: 'exam_timetable_published',
                targetType: 'exam_timetables',
                targetId: ref.id,
                meta: { semester: config.semester },
            });
            alert("Exam Timetable Published Successfully!");
        } catch (err) {
            console.error("Save error:", err);
            alert("Failed to publish timetable.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSendExamToAdmins = () => {
        const uid = auth.currentUser?.uid;
        if (!uid || !userData?.department) {
            alert('Sign in as a coordinator with a department to submit for review.');
            return;
        }
        if (!timetable?.length) {
            alert('Generate an exam timetable first.');
            return;
        }
        if (conflicts.length > 0 && !window.confirm(`${conflicts.length} conflict flag(s) remain. Send this draft to admins anyway?`))
            return;
        setAdminNoteModalOpen(true);
    };

    const submitExamReviewWithNote = async (noteRaw) => {
        const uid = auth.currentUser?.uid;
        if (!uid || !userData?.department) return;

        setSendingReview(true);
        try {
            const threadId = await createReviewThread({
                coordinatorUid: uid,
                coordinatorName: userData?.name || '',
                coordinatorEmail: userData?.email || '',
                department: userData.department,
                kind: 'exam',
                title: `${userData.department} · ${config.semester} Semester · Exam draft`,
                snapshot: {
                    schedule: timetable,
                    stats: generationStats,
                    semester: config.semester,
                    conflicts,
                },
            });
            await addThreadMessage(threadId, {
                senderRole: 'coordinator',
                senderUid: uid,
                senderName: userData?.name || '',
                body:
                    (noteRaw || '').trim() ||
                    'Submitted exam timetable draft for review. Conflicts array lists venue/cohort issues if any.',
            });
            setAdminNoteModalOpen(false);
            alert('Sent to admins. Use Admin feedback in the sidebar to read replies and adjust if needed.');
        } catch (e) {
            console.error(e);
            alert('Could not send to admins. Check Firestore security rules for timetable_review_threads.');
        } finally {
            setSendingReview(false);
        }
    };

    const handleDragStart = (e, id) => {
        e.dataTransfer.setData("examId", id);
        setDraggedExamId(id);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDrop = (e, targetExamId) => {
        e.preventDefault();
        const sourceExamId = e.dataTransfer.getData("examId");
        if (sourceExamId === targetExamId) {
            setDraggedExamId(null);
            return;
        }

        setTimetable(prev => {
            const newTimetable = [...prev];
            const sourceIndex = newTimetable.findIndex(x => x.id === sourceExamId);
            const targetIndex = newTimetable.findIndex(x => x.id === targetExamId);
            
            const sourceObj = {...newTimetable[sourceIndex]};
            const targetObj = {...newTimetable[targetIndex]};

            const tempDate = sourceObj.date;
            const tempStart = sourceObj.startTime;
            const tempSession = sourceObj.session;
            const tempVenueId = sourceObj.venueId;
            const tempVenueName = sourceObj.venueName;
            const tempCapacity = sourceObj.venueCapacity;

            newTimetable[sourceIndex] = {
                ...sourceObj,
                date: targetObj.date,
                startTime: targetObj.startTime,
                session: targetObj.session,
                venueId: targetObj.venueId,
                venueName: targetObj.venueName,
                venueCapacity: targetObj.venueCapacity
            };

            newTimetable[targetIndex] = {
                ...targetObj,
                date: tempDate,
                startTime: tempStart,
                session: tempSession,
                venueId: tempVenueId,
                venueName: tempVenueName,
                venueCapacity: tempCapacity
            };
            
            const newC = aggregateExamConflicts(newTimetable, externalExamRows);
            if(newC.length > 0) {
                alert(`Swap failed. It introduces the following conflict(s):\n- ${newC.join('\n- ')}`);
                return prev; // Revert
            }

            newTimetable.sort((a,b) => new Date(a.date) - new Date(b.date));
            return newTimetable;
        });
        setDraggedExamId(null);
    };

    const openEdit = (exam) => {
        setEditingExamId(exam.id);
        setEditForm({
            durationMins: exam.durationMins,
            startTime: exam.startTime,
            date: exam.date,
            venueId: exam.venueId
        });
    };

    const saveEdit = () => {
        setTimetable(prev => {
            const newTbl = prev.map(ex => {
                if(ex.id === editingExamId) {
                    const selVenue = venues.find(v => v.id === editForm.venueId);
                    return { ...ex, ...editForm, venueName: selVenue ? selVenue.name : ex.venueName };
                }
                return ex;
            });
            const newC = aggregateExamConflicts(newTbl, externalExamRows);
            if(newC.length > 0) {
                alert(`Edit failed. It introduces the following conflict(s):\n- ${newC.join('\n- ')}`);
                return prev;
            }
            newTbl.sort((a,b) => new Date(a.date) - new Date(b.date));
            return newTbl;
        });
        setEditingExamId(null);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <InstructionGuide
                title="Exam Timetable Engine"
                steps={[
                    "Configure Start Date and target Semester.",
                    "Generate intelligent schedule. Notice durations natively align with Credit Units.",
                    "Drag & Drop any exam row over another to rapidly swap their dates/venues.",
                    "Conflicts (like Level/Venue clash) are flagged and automatically blocked."
                ]}
            />

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 space-y-2 w-full">
                    <label className="text-xs font-bold text-slate-500 uppercase">Start Date</label>
                    <input 
                        type="date" 
                        value={config.startDate}
                        onChange={(e)=>setConfig({...config, startDate: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-sm text-slate-700 font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    />
                </div>
                <div className="flex-1 space-y-2 w-full">
                    <label className="text-xs font-bold text-slate-500 uppercase">Semester</label>
                    <select 
                        value={config.semester}
                        onChange={(e)=>setConfig({...config, semester: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-sm text-slate-700 font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    >
                        <option value="First">First Semester</option>
                        <option value="Second">Second Semester</option>
                    </select>
                </div>
                <div className="w-full md:w-auto">
                    <Button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className={`w-full md:w-auto gap-2 ${isGenerating ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'} text-white shadow-lg shadow-indigo-200 transition-all px-8`}
                    >
                        {isGenerating ? <RefreshCw className="animate-spin" size={16} /> : <Play size={16} />}
                        {isGenerating ? 'Computing...' : 'Generate Target Timetable'}
                    </Button>
                </div>
            </div>

            {timetable ? (
                <div className="space-y-12 mt-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-4">
                        <div>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Generated Results</h2>
                            <p className="text-slate-500 font-medium mt-1">Period: {generationStats.startDate} to {generationStats.endDate} • {generationStats.totalExams} Exams Scheduled</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                className="gap-2 border-emerald-200 text-emerald-900 hover:bg-emerald-50 px-6 h-12 rounded-xl font-bold"
                                disabled={sendingReview}
                                onClick={() => handleSendExamToAdmins()}
                            >
                                {sendingReview ? <RefreshCw className="animate-spin" size={18} /> : <MessageSquare size={18} />}
                                Send to admins
                            </Button>
                            <Button onClick={handleSave} disabled={isSaving || conflicts.length>0} className="gap-2 bg-slate-900 text-white hover:bg-slate-800 shadow-xl shadow-slate-900/10 px-6 h-12 rounded-xl text-md font-bold">
                                {isSaving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                                Publish to Dashboard
                            </Button>
                        </div>
                    </div>

                    {['100', '200', '300', '400'].map(level => {
                        const levelSchedule = timetable.filter(item => item.level.toString() === level);
                        if (levelSchedule.length === 0) return null;

                        return (
                            <div key={level} data-level={level} className="space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-16 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-slate-900/20">
                                        {level}L
                                    </div>
                                    <h3 className="text-2xl font-bold text-slate-800 uppercase tracking-tight">Exam Schedule</h3>
                                    <div className="h-px flex-1 bg-slate-200"></div>
                                </div>

                                <div className="overflow-x-auto rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/40">
                                    <table className="w-full text-sm text-left border-collapse">
                                        <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-[0.2em] font-black">
                                            <tr>
                                                <th className="px-8 py-5 border-r border-slate-800">Code</th>
                                                <th className="px-8 py-5 border-r border-slate-800">Course</th>
                                                <th className="px-8 py-5 border-r border-slate-800 text-center">Date</th>
                                                <th className="px-8 py-5 border-r border-slate-800 text-center">Time</th>
                                                <th className="px-8 py-5 border-r border-slate-800">Venue</th>
                                                <th className="px-8 py-5 text-center">Duration</th>
                                                <th className="px-8 py-5 border-l border-slate-800 text-center text-slate-500">*</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {levelSchedule.map((course, idx) => (
                                                <tr 
                                                    key={`${course.id}-${idx}`} 
                                                    className={`hover:bg-indigo-50/20 transition-colors group cursor-grab active:cursor-grabbing ${draggedExamId === course.id ? 'opacity-30 bg-slate-100' : ''}`}
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, course.id)}
                                                    onDragOver={handleDragOver}
                                                    onDrop={(e) => handleDrop(e, course.id)}
                                                >
                                                    <td className="px-8 py-5 font-black text-slate-900 border-r border-slate-100 bg-slate-50/50">{course.courseCode}</td>
                                                    <td className="px-8 py-5 font-bold text-slate-700 border-r border-slate-100 max-w-md leading-relaxed">
                                                        {course.courseTitle}
                                                        <div className="flex gap-2 items-center mt-1">
                                                            <span className="text-[9px] text-slate-500 uppercase tracking-widest bg-slate-100 px-1.5 rounded">{course.department}</span>
                                                            <span className="text-[9px] font-black text-green-700 uppercase tracking-widest bg-green-100 px-1.5 py-0.5 rounded">{course.creditUnit} Units</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5 text-center font-black border-r border-slate-100 whitespace-nowrap">
                                                        <div className={`inline-block px-4 py-1.5 rounded-lg text-white font-black text-[10px] uppercase shadow-md ${course.session === 'Morning' ? 'bg-emerald-500 shadow-emerald-200' : 'bg-sky-500 shadow-sky-200'}`}>
                                                            {new Date(course.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5 text-center font-black text-indigo-600 border-r border-slate-100 whitespace-nowrap bg-indigo-50/10">
                                                        {course.startTime}
                                                    </td>
                                                    <td className="px-8 py-5 font-bold text-slate-500 border-r border-slate-100">
                                                        <div className="flex items-center gap-2 text-indigo-900">
                                                            <MapPin size={14} className="text-slate-300" />
                                                            {course.venueName}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">Cap: {course.venueCapacity}</div>
                                                    </td>
                                                    <td className="px-8 py-5 text-center font-black text-slate-700 bg-slate-50/30">
                                                        {course.durationMins}m
                                                    </td>
                                                    <td className="px-4 py-5 text-center border-l border-slate-100 bg-slate-50/30">
                                                        <Button variant="ghost" size="sm" onClick={() => openEdit(course)} className="text-slate-400 hover:text-indigo-600">
                                                            <Edit3 size={16} />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center bg-slate-50/30 mt-8">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300 shadow-sm border border-slate-100">
                        <Calendar size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">Ready to Schedule</h3>
                    <p className="text-slate-500 max-w-sm mx-auto mt-2">
                        Set your parameters above to automatically distribute exams across your active venues without conflict.
                    </p>
                </div>
            )}

            <OptionalNoteToAdminsModal
                open={adminNoteModalOpen}
                onClose={() => {
                    if (!sendingReview) setAdminNoteModalOpen(false);
                }}
                onSend={(note) => void submitExamReviewWithNote(note)}
                pending={sendingReview}
                title="Send exam draft to administrators"
                description="Optional note attached to this review thread. Coordinators can clarify context, risks, or requested checks for the admin team."
            />

            {/* Edit Modal */}
            {editingExamId && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 space-y-4 animate-in zoom-in-95 duration-200">
                        <h3 className="text-2xl font-black text-slate-900 border-b border-slate-100 pb-4">Manual Override</h3>
                        
                        <div className="space-y-4 pt-2">
                            <div>
                                <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Exam Date</label>
                                <input type="date" value={editForm.date} onChange={e=>setEditForm({...editForm, date: e.target.value})} className="w-full mt-1 bg-slate-50 border p-3 font-bold text-slate-700 rounded-lg text-sm" />
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Start Time</label>
                                    <input type="time" value={editForm.startTime} onChange={e=>setEditForm({...editForm, startTime: e.target.value})} className="w-full mt-1 bg-slate-50 border p-3 font-bold text-slate-700 rounded-lg text-sm" />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Duration (Mins)</label>
                                    <input type="number" value={editForm.durationMins} onChange={e=>setEditForm({...editForm, durationMins: parseInt(e.target.value)})} className="w-full mt-1 bg-slate-50 border p-3 font-bold text-slate-700 rounded-lg text-sm" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Assigned Venue</label>
                                <select value={editForm.venueId} onChange={e=>setEditForm({...editForm, venueId: e.target.value})} className="w-full mt-1 bg-slate-50 border p-3 font-bold text-slate-700 rounded-lg text-sm">
                                    {venues.map(v => <option key={v.id} value={v.id}>{v.name} (Cap: {v.capacity})</option>)}
                                    <option value="TBH">TBA</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-6 border-t border-slate-100">
                            <Button variant="ghost" className="flex-1 font-bold text-slate-500" onClick={()=>setEditingExamId(null)}>Cancel</Button>
                            <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12 rounded-xl" onClick={saveEdit}>Confirm Change</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExamTimetable;
