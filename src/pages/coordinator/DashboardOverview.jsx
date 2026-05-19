import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Calendar, Eye, Edit, Download, Rocket, User, RefreshCw, FileJson, Sheet, ChevronDown, AlertCircle } from 'lucide-react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import {
    downloadLectureSchedulePdf,
    downloadScheduleJson,
    downloadScheduleCsv,
    downloadExamSchedulePdf,
    downloadExamScheduleCsv,
    downloadExamScheduleJson,
    formatExamInvigilatorsCell,
} from '../../utils/timetableExport';

const DashboardOverview = () => {
    const navigate = useNavigate();
    const { userData } = useOutletContext();
    const [selectedLevel, setSelectedLevel] = useState('100');
    const [activeTimetable, setActiveTimetable] = useState(null);
    const [activeExamTimetable, setActiveExamTimetable] = useState(null);
    const [loading, setLoading] = useState(true);
    const [exportOpen, setExportOpen] = useState(false);

    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    useEffect(() => {
        if (!userData?.department) return;

        const q = query(
            collection(db, 'saved_timetables'),
            where('department', '==', userData.department),
            where('published', '==', true),
            where('isActive', '==', true)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                setActiveTimetable({ id: doc.id, ...doc.data() });
            } else {
                setActiveTimetable(null);
            }
            setLoading(false);
        });

        const qExam = query(
            collection(db, 'exam_timetables'),
            where('department', '==', userData.department),
            where('published', '==', true),
            where('isActive', '==', true)
        );

        const unsubscribeExam = onSnapshot(qExam, (snapshot) => {
            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                setActiveExamTimetable({ id: doc.id, ...doc.data() });
            } else {
                setActiveExamTimetable(null);
            }
        });

        return () => { unsubscribe(); unsubscribeExam(); };
    }, [userData]);

    const formatTime = (h) => {
        const meridian = h >= 12 ? 'PM' : 'AM';
        let hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
        return `${hour}${meridian}`;
    };

    const levelSchedule = activeTimetable?.schedule?.filter(
        s => s.level.toString() === selectedLevel
    ) || [];

    return (
        <div className="space-y-4 md:space-y-6">
            {/* 1. Welcome Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 pb-4 md:pb-6">
                <div>
                    <h1 className="text-xl md:text-3xl font-bold tracking-tight text-slate-900">
                        Welcome, {userData?.name?.split(' ')[0] || 'Coordinator'}! 👋
                    </h1>
                    <p className="text-slate-500 mt-1 text-sm md:text-lg">
                        {activeTimetable ? (
                            <>Currently viewing <span className="font-bold text-indigo-600">{activeTimetable.name}</span></>
                        ) : (
                                "No published timetable on the home dashboard yet. Publish an admin-approved version from Lecture or Exam timetable tools."
                        )}
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <Button variant="outline" onClick={() => navigate('/coordinator/constraints')} className="gap-2 w-full sm:w-auto text-xs md:text-sm h-9 md:h-10">
                        <Eye size={14} /> Dept constraints
                    </Button>
                    <Button onClick={() => navigate('/coordinator/lecture-timetable')} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-lg shadow-indigo-200 w-full sm:w-auto text-xs md:text-sm h-9 md:h-10">
                        <Edit size={14} /> Management
                    </Button>
                </div>
            </div>

            {/* 2. Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 overflow-x-auto">
                    <span className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Level Filter:</span>
                    <div className="flex bg-slate-100 p-1 rounded-lg overflow-x-auto scrollbar-hide">
                        {['100', '200', '300', '400'].map((level) => (
                            <button
                                key={level}
                                onClick={() => setSelectedLevel(level)}
                                className={`px-3 md:px-4 py-1.5 rounded-md text-xs md:text-sm font-bold transition-all whitespace-nowrap ${selectedLevel === level
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {level} Lvl
                            </button>
                        ))}
                    </div>
                </div>
                {(activeTimetable || activeExamTimetable) && (
                    <div className="relative flex flex-wrap gap-2 justify-end" onMouseDown={(e) => e.stopPropagation()}>
                        <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            className="text-indigo-600 border-indigo-200 text-xs font-bold h-9 px-3"
                            onClick={() => setExportOpen((v) => !v)}
                        >
                            <Download size={14} className="mr-2" /> Export <ChevronDown size={14} className="ml-1" />
                        </Button>
                        {exportOpen && (
                            <div
                                className="absolute right-0 top-full mt-1 w-64 rounded-xl border border-slate-200 bg-white shadow-xl z-30 py-2 text-left"
                                onMouseDown={(e) => e.stopPropagation()}
                            >
                                {activeTimetable && (
                                    <>
                                        <div className="px-4 py-1.5 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                            Lecture timetable
                                        </div>
                                        <button
                                            type="button"
                                            className="w-full px-4 py-2.5 text-xs font-bold hover:bg-slate-50 text-left"
                                            onClick={() => {
                                                setExportOpen(false);
                                                void downloadLectureSchedulePdf(activeTimetable.schedule || [], {
                                                    department: userData?.department,
                                                    level: 'All',
                                                    filePrefix: `${(activeTimetable.name || 'timetable').replace(/\s+/g, '-').slice(0, 40)}`,
                                                    subtitle: activeTimetable.name,
                                                });
                                            }}
                                        >
                                            PDF — all levels
                                        </button>
                                        <button
                                            type="button"
                                            className="w-full px-4 py-2.5 text-xs font-bold hover:bg-slate-50 text-left"
                                            onClick={() => {
                                                setExportOpen(false);
                                                void downloadLectureSchedulePdf(activeTimetable.schedule || [], {
                                                    department: userData?.department,
                                                    level: selectedLevel,
                                                    filePrefix: `${(activeTimetable.name || 'timetable').replace(/\s+/g, '-').slice(0, 40)}-${selectedLevel}L`,
                                                    subtitle: `${activeTimetable.name} · ${selectedLevel} Level`,
                                                });
                                            }}
                                        >
                                            PDF — {selectedLevel} level only
                                        </button>
                                        <button
                                            type="button"
                                            className="w-full px-4 py-2.5 text-xs font-bold hover:bg-slate-50 flex items-center gap-2"
                                            onClick={() => {
                                                setExportOpen(false);
                                                downloadScheduleJson(activeTimetable.schedule || [], {
                                                    department: userData?.department,
                                                    name: `${(activeTimetable.name || 'timetable').replace(/\s+/g, '-')}-all`,
                                                });
                                            }}
                                        >
                                            <FileJson size={14} /> JSON
                                        </button>
                                        <button
                                            type="button"
                                            className="w-full px-4 py-2.5 text-xs font-bold hover:bg-slate-50 flex items-center gap-2"
                                            onClick={() => {
                                                setExportOpen(false);
                                                downloadScheduleCsv(activeTimetable.schedule || [], {
                                                    department: userData?.department,
                                                    name: `${(activeTimetable.name || 'timetable').replace(/\s+/g, '-')}-all`,
                                                });
                                            }}
                                        >
                                            <Sheet size={14} /> CSV
                                        </button>
                                        <button
                                            type="button"
                                            className="w-full px-4 py-2.5 text-xs font-bold hover:bg-slate-50 text-indigo-700"
                                            onClick={() => {
                                                setExportOpen(false);
                                                navigate('/coordinator/lecture-timetable');
                                            }}
                                        >
                                            Open lecture generator
                                        </button>
                                    </>
                                )}
                                {activeTimetable && activeExamTimetable && (
                                    <div className="my-2 mx-3 border-t border-slate-100" role="presentation" />
                                )}
                                {activeExamTimetable && (
                                    <>
                                        <div className="px-4 py-1.5 text-[10px] font-black text-indigo-700 uppercase tracking-wider">
                                            Exam timetable
                                        </div>
                                        <button
                                            type="button"
                                            className="w-full px-4 py-2.5 text-xs font-bold hover:bg-slate-50 text-left"
                                            onClick={() => {
                                                setExportOpen(false);
                                                void downloadExamSchedulePdf(activeExamTimetable.schedule || [], {
                                                    department: userData?.department,
                                                    level: 'All',
                                                    filePrefix: `${(activeExamTimetable.semester || 'exam').toString().replace(/\s+/g, '-')}-Sem-Exams`,
                                                    subtitle:
                                                        activeExamTimetable.name ||
                                                        `${activeExamTimetable.semester || ''} semester exams`,
                                                });
                                            }}
                                        >
                                            Exams PDF — all levels
                                        </button>
                                        <button
                                            type="button"
                                            className="w-full px-4 py-2.5 text-xs font-bold hover:bg-slate-50 text-left"
                                            onClick={() => {
                                                setExportOpen(false);
                                                const filtered = (activeExamTimetable.schedule || []).filter(
                                                    (s) => s.level != null && s.level.toString() === selectedLevel
                                                );
                                                if (!filtered.length) {
                                                    window.alert(`No exams for ${selectedLevel} level in the published timetable.`);
                                                    return;
                                                }
                                                void downloadExamSchedulePdf(filtered, {
                                                    department: userData?.department,
                                                    level: selectedLevel,
                                                    filePrefix: `${(activeExamTimetable.semester || 'exam').toString().replace(/\s+/g, '-')}-Sem-Exams-${selectedLevel}L`,
                                                    subtitle: `${activeExamTimetable.semester || ''} · ${selectedLevel} level`,
                                                });
                                            }}
                                        >
                                            Exams PDF — {selectedLevel} level
                                        </button>
                                        <button
                                            type="button"
                                            className="w-full px-4 py-2.5 text-xs font-bold hover:bg-slate-50 flex items-center gap-2"
                                            onClick={() => {
                                                setExportOpen(false);
                                                downloadExamScheduleJson(activeExamTimetable.schedule || [], {
                                                    department: userData?.department,
                                                    name: `${(activeExamTimetable.semester || 'exams').toString().replace(/\s+/g, '-')}-exams`,
                                                });
                                            }}
                                        >
                                            <FileJson size={14} /> Exams JSON
                                        </button>
                                        <button
                                            type="button"
                                            className="w-full px-4 py-2.5 text-xs font-bold hover:bg-slate-50 flex items-center gap-2"
                                            onClick={() => {
                                                setExportOpen(false);
                                                downloadExamScheduleCsv(activeExamTimetable.schedule || [], {
                                                    department: userData?.department,
                                                    name: `${(activeExamTimetable.semester || 'exams').toString().replace(/\s+/g, '-')}-exams`,
                                                });
                                            }}
                                        >
                                            <Sheet size={14} /> Exams CSV (invigilators)
                                        </button>
                                        <button
                                            type="button"
                                            className="w-full px-4 py-2.5 text-xs font-bold hover:bg-slate-50 text-indigo-700"
                                            onClick={() => {
                                                setExportOpen(false);
                                                navigate('/coordinator/exam-timetable');
                                            }}
                                        >
                                            Open exam generator
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 3. Timetable Display */}
            <Card className="border-slate-200 shadow-md overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3 md:py-4">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base md:text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Calendar className="text-indigo-500" size={16} />
                            {selectedLevel} Level Schedule
                        </CardTitle>
                        {activeTimetable && (
                            <span className="text-[10px] md:text-xs font-bold bg-indigo-600 text-white px-3 py-1 rounded-full uppercase tracking-tighter shadow-sm">
                                Active Version
                            </span>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-20 flex flex-col items-center justify-center gap-4 text-slate-400 font-bold">
                            <RefreshCw size={32} className="animate-spin" />
                            <p>Loading active timetable...</p>
                        </div>
                    ) : activeTimetable ? (
                        <div className="overflow-x-auto max-w-full">
                            <table className="w-full border-collapse min-w-[700px]">
                                <thead className="bg-slate-100 border-b border-slate-200">
                                    <tr>
                                        <th className="p-3 text-[10px] font-black text-red-600 uppercase tracking-wider text-center w-24">Code</th>
                                        <th className="p-3 text-[10px] font-black text-red-600 uppercase tracking-wider text-left">Course</th>
                                        <th className="p-3 text-[10px] font-black text-red-600 uppercase tracking-wider text-center w-32">Time</th>
                                        <th className="p-3 text-[10px] font-black text-red-600 uppercase tracking-wider text-center w-20">Venue</th>
                                        <th className="p-3 text-[10px] font-black text-red-600 uppercase tracking-wider text-left">Lecturer</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {DAYS.map(day => {
                                        const dayItems = levelSchedule
                                            .filter(s => s.assignedDay === day)
                                            .sort((a, b) => a.assignedStart - b.assignedStart);

                                        if (dayItems.length === 0) return null;

                                        return (
                                            <React.Fragment key={day}>
                                                <tr className="bg-slate-50/50">
                                                    <td colSpan="5" className="px-4 py-1.5 text-[9px] font-black text-slate-400 bg-slate-100/50 uppercase tracking-widest border-y border-slate-200/50">
                                                        {day}
                                                    </td>
                                                </tr>
                                                {dayItems.map((slot, idx) => (
                                                    <tr key={`${slot.id}-${idx}`} className="hover:bg-slate-50/80 transition-colors group">
                                                        <td className="p-3 text-xs font-black text-slate-900 text-center">{slot.code}</td>
                                                        <td className="p-3 text-xs font-bold text-slate-700">
                                                            <div>{slot.title}</div>
                                                            <div className="text-[9px] text-slate-400 font-medium">({slot.type})</div>
                                                        </td>
                                                        <td className="p-3 text-xs font-black text-slate-900 text-center whitespace-nowrap">
                                                            {formatTime(slot.assignedStart)} - {formatTime(slot.assignedEnd)}
                                                        </td>
                                                        <td className="p-3 text-xs font-black text-indigo-600 text-center">
                                                            <div className="bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 inline-block">
                                                                {slot.assignedVenue?.name}
                                                            </div>
                                                        </td>
                                                        <td className="p-3 text-xs font-medium text-slate-600">{slot.lecturer || 'TBA'}</td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        );
                                    })}
                                    {levelSchedule.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="p-12 text-center text-slate-400 font-medium italic">
                                                No specific courses found for {selectedLevel} Level in this version.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-3">
                            <AlertCircle size={48} className="opacity-20" />
                            <div>
                                <p className="font-bold text-slate-500">No Active Timetable</p>
                                <p className="text-sm">Go to the timetable tools, save, get admin approval, publish, and set active if needed.</p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate('/coordinator/lecture-timetable')}
                                className="mt-2 border-indigo-200 text-indigo-600"
                            >
                                Setup Timetable
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Exam Timetable Display */}
            {activeExamTimetable && (
                <Card className="border-indigo-200 shadow-md overflow-hidden bg-indigo-50/20">
                    <CardHeader className="bg-indigo-50/80 border-b border-indigo-100 py-3 md:py-4">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base md:text-lg font-bold text-indigo-900 flex items-center gap-2">
                                <Calendar className="text-indigo-600" size={16} />
                                {selectedLevel} Level Exam Schedule - {activeExamTimetable.semester} Sem
                            </CardTitle>
                            <span className="text-[10px] md:text-xs font-bold bg-indigo-600 text-white px-3 py-1 rounded-full uppercase tracking-tighter shadow-sm">
                                Upcoming Exams
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto max-w-full">
                            <table className="w-full border-collapse min-w-[700px]">
                                <thead className="bg-indigo-100/50 border-b border-indigo-100">
                                    <tr>
                                        <th className="p-3 text-[10px] font-black text-indigo-800 uppercase tracking-wider text-center">Date</th>
                                        <th className="p-3 text-[10px] font-black text-indigo-800 uppercase tracking-wider text-left">Course</th>
                                        <th className="p-3 text-[10px] font-black text-indigo-800 uppercase tracking-wider text-center">Time & Duration</th>
                                        <th className="p-3 text-[10px] font-black text-indigo-800 uppercase tracking-wider text-center">Venue</th>
                                        <th className="p-3 text-[10px] font-black text-indigo-800 uppercase tracking-wider text-left">Invigilators</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-indigo-50 border-b border-indigo-100">
                                    {activeExamTimetable.schedule?.filter(s => s.level.toString() === selectedLevel).sort((a,b)=> new Date(a.date) - new Date(b.date)).map((exam, idx) => (
                                        <tr key={idx} className="hover:bg-white transition-colors">
                                            <td className="p-3 text-xs font-black text-indigo-900 text-center whitespace-nowrap">
                                                {new Date(exam.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                            </td>
                                            <td className="p-3 text-xs font-bold text-slate-700">
                                                <div className="text-indigo-900">{exam.courseCode}</div>
                                                <div className="text-[10px] text-slate-500 font-medium">{exam.courseTitle}</div>
                                            </td>
                                            <td className="p-3 text-xs font-bold text-slate-700 text-center">
                                                <div>{exam.startTime}</div>
                                                <div className="text-[9px] text-slate-400">({exam.durationMins} mins)</div>
                                            </td>
                                            <td className="p-3 text-xs font-bold text-indigo-600 text-center">
                                                <div className="bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 inline-block">
                                                    {exam.venueName}
                                                </div>
                                            </td>
                                            <td className="p-3 text-xs font-medium text-slate-600 max-w-[200px]">
                                                {formatExamInvigilatorsCell(exam) || '—'}
                                            </td>
                                        </tr>
                                    ))}
                                    {activeExamTimetable.schedule?.filter(s => s.level.toString() === selectedLevel).length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="p-8 text-center text-indigo-400 font-medium">
                                                No exams scheduled for {selectedLevel} Level.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 4. Quick Actions / Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-900 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
                    <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Rocket className="text-indigo-400" size={20} /> New Cycle
                            </h3>
                            <p className="text-slate-300 text-sm">
                                Start a fresh generation with updated courses and venues for next session.
                            </p>
                        </div>
                        <Button onClick={() => navigate('/coordinator/lecture-timetable')} className="bg-white text-slate-900 hover:bg-slate-100 font-black px-6 w-full">
                            GENERATE NEW
                        </Button>
                    </div>
                </div>

                <div className="bg-indigo-600 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
                    <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <User className="text-indigo-200" size={20} /> Your Scope
                            </h3>
                            <p className="text-slate-100/80 text-sm">
                                Managing <span className="font-black text-white">{userData?.department || 'Department'}</span> at Nile University.
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1 bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
                                <div className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest">Department</div>
                                <div className="text-xs font-black text-white truncate">{userData?.department?.split(' ')[0]}</div>
                            </div>
                            <div className="flex-1 bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
                                <div className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest">Role</div>
                                <div className="text-xs font-black text-white">Coordinator</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardOverview;
