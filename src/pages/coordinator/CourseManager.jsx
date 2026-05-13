import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { BookOpen, MapPin, Users, Filter, Clock } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import InstructionGuide from '../../components/InstructionGuide';
import { db } from '../../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

const CourseManager = () => {
    const { userData } = useOutletContext();
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Filters for display
    const [selectedSemester, setSelectedSemester] = useState('All');

    useEffect(() => {
        if (!userData?.department) return;

        const qCourses = query(
            collection(db, 'courses'),
            where('department', '==', userData.department)
        );
        
        const unsubscribe = onSnapshot(qCourses, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const sortedList = list.sort((a, b) => a.code.localeCompare(b.code));
            setCourses(sortedList);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userData]);

    const semesters = ['All', 'First', 'Second'];
    const levels = ['100', '200', '300', '400', 'General'];

    const filteredCourses = selectedSemester === 'All' 
        ? courses 
        : courses.filter(c => c.semester === selectedSemester);

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-24">
            <InstructionGuide
                title={`${userData?.department} Verified Curriculum`}
                steps={[
                    "A read-only view of all courses assigned to your department.",
                    "Review course codes, units, and levels sorted by semester.",
                    "Contact the Faculty Administrator if you notice a missing or incorrectly configured course."
                ]}
            />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-slate-900">Academic Curriculum</h2>
                    <p className="text-slate-500 font-medium mt-1">Review department courses by semester and level.</p>
                </div>
                
                <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                    {semesters.map(sem => (
                        <button
                            key={sem}
                            onClick={() => setSelectedSemester(sem)}
                            className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${selectedSemester === sem ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            {sem === 'All' ? 'All Semesters' : `${sem} Semester`}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="py-24 text-center">
                    <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
                </div>
            ) : filteredCourses.length === 0 ? (
                <div className="text-center py-20 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                    <BookOpen className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                    <p className="text-slate-600 font-black text-lg">No courses found</p>
                    <p className="text-slate-400 text-sm mt-1 max-w-sm mx-auto">
                        No official courses have been added to your department curriculum by the Administrator yet.
                    </p>
                </div>
            ) : (
                <div className="space-y-12 mt-8">
                    {['First', 'Second'].map(semester => {
                        // Skip if filtering by the other semester
                        if (selectedSemester !== 'All' && selectedSemester !== semester) return null;
                        
                        const semesterCourses = courses.filter(c => c.semester === semester || (!c.semester && semester === 'First'));
                        if (semesterCourses.length === 0) return null;

                        return (
                            <div key={semester} className="space-y-8">
                                <div className="flex items-center gap-4">
                                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">{semester} Semester</h3>
                                    <div className="h-px flex-1 bg-slate-200"></div>
                                </div>

                                <div className="space-y-6 pl-4 border-l-2 border-indigo-100">
                                    {levels.map(level => {
                                        const levelCourses = semesterCourses.filter(c => c.level === level);
                                        if (levelCourses.length === 0) return null;

                                        return (
                                            <div key={level}>
                                                <h4 className="text-xs font-black tracking-widest text-indigo-500 uppercase mb-4 flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                                    {level === 'General' ? 'General' : `${level} Level`} Courses
                                                </h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {levelCourses.map(course => (
                                                        <Card key={course.id} className="border-slate-100 shadow-sm hover:shadow-md transition-shadow group overflow-hidden">
                                                            <div className="h-1 w-full bg-indigo-500/20 group-hover:bg-indigo-500 transition-colors"></div>
                                                            <CardContent className="p-5">
                                                                <div className="flex justify-between items-start mb-3">
                                                                    <div className="font-black text-slate-900 bg-slate-100 rounded-lg px-2.5 py-1 text-xs border border-slate-200">
                                                                        {course.code}
                                                                    </div>
                                                                    {course.creditUnit && (
                                                                        <div className="text-[10px] uppercase font-black text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded border border-emerald-100">
                                                                            {course.creditUnit} Units
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <h3 className="font-bold text-slate-800 leading-tight mb-4 min-h-[40px]">{course.title}</h3>
                                                                
                                                                <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-100">
                                                                    <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-widest text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                                                                        <Clock size={10} /> {course.duration || '2h'}
                                                                    </span>
                                                                    <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                                                        {course.type || 'Theory'}
                                                                    </span>
                                                                    {course.isCommon && (
                                                                        <span className="text-[10px] uppercase font-bold tracking-widest text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-100">
                                                                            Common
                                                                        </span>
                                                                    )}
                                                                    {course.excludeFromTimetable && (
                                                                        <span className="text-[10px] uppercase font-bold tracking-widest text-amber-950 bg-amber-100 px-2 py-1 rounded border border-amber-200">
                                                                            Not in timetable gen
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default CourseManager;
