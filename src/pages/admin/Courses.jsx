import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Plus, Users, BookOpen, Layers, X, Check, Trash2, Clock, Search, Edit2, ChevronRight, Filter, Ban } from 'lucide-react';
import InstructionGuide from '../../components/InstructionGuide';
import ConfirmationDialog from '../../components/ConfirmationDialog';
import { db } from '../../firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc, query, orderBy, updateDoc } from 'firebase/firestore';

const CourseCard = ({ course, onEdit, onDelete }) => (
    <div
        onClick={() => onEdit(course)}
        className="group relative flex flex-col justify-between bg-white border border-slate-200/80 hover:border-[#00008b]/30 rounded-2xl p-5 shadow-sm hover:shadow-xl hover:shadow-[#00008b]/5 transition-all cursor-pointer overflow-hidden backdrop-blur-sm"
    >
        {/* Subtle Top Gradient Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#00008b] to-[#579044] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

            <div className="flex justify-between items-start mb-3">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-black text-slate-900 uppercase tracking-tight">{course.code}</span>
                    {course.excludeFromTimetable && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 text-amber-950 text-[9px] font-black uppercase tracking-wide border border-amber-200/80">
                            <Ban size={10} /> excluded from timetable
                        </span>
                    )}
                </div>
            <div className="flex items-center gap-2">
                {course.creditUnit && (
                    <span className="px-2.5 py-1 bg-slate-50 text-slate-500 text-[10px] font-black rounded-lg uppercase border border-slate-200/60 transition-colors group-hover:bg-slate-100">
                        {course.creditUnit} UNIT
                    </span>
                )}
                {/* Actions strictly hidden until hover (except on touch devices) */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 md:opacity-0 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); onEdit(course); }} className="p-1.5 text-slate-400 hover:bg-[#00008b]/10 hover:text-[#00008b] rounded-md transition-colors" title="Edit">
                        <Edit2 size={14} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(course.id); }} className="p-1.5 text-slate-400 hover:bg-rose-100 hover:text-rose-600 rounded-md transition-colors" title="Delete">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
        </div>

        <h5 className="text-xs font-bold text-slate-500 leading-relaxed pr-6 line-clamp-2 uppercase tracking-wide">
            {course.title}
        </h5>
    </div>
);

const Courses = () => {
    const [courses, setCourses] = useState([]);
    const [lecturers, setLecturers] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch Courses & Lecturers
    useEffect(() => {
        // Fetch Courses
        const qCourses = query(collection(db, 'courses'), orderBy('code', 'asc'));
        const unsubscribeCourses = onSnapshot(qCourses, (snapshot) => {
            const courseList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setCourses(courseList);
            setLoading(false);
        });

        // Fetch Lecturers for Dropdown
        const qLecturers = query(collection(db, 'lecturers'), orderBy('name', 'asc'));
        const unsubscribeLecturers = onSnapshot(qLecturers, (snapshot) => {
            const lecturerList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setLecturers(lecturerList);
        });

        return () => {
            unsubscribeCourses();
            unsubscribeLecturers();
        };
    }, []);

    const [isAdding, setIsAdding] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);

    const [newCourse, setNewCourse] = useState({
        code: '',
        title: '',
        department: '',
        level: '100',
        semester: 'First',
        creditUnit: '2',
        excludeFromTimetable: false,
    });

    // Delete confirmation state
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [courseToDelete, setCourseToDelete] = useState(null);

    // Filter and Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDept, setSelectedDept] = useState('All');
    const [selectedLevel, setSelectedLevel] = useState('All');
    const [selectedSemester, setSelectedSemester] = useState('All');
    /** all | schedulable | excluded */
    const [timetableFilter, setTimetableFilter] = useState('all');
    
    // Toast Notification State
    const [toastMessage, setToastMessage] = useState('');
    
    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3000);
    };

    // Lecturer Filter State
    const [lecturerSearch, setLecturerSearch] = useState('');

    // Filter Courses logic
    const filteredCourses = courses.filter(course => {
        const matchesSearch = course.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            course.title.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDept = selectedDept === 'All' || course.department === selectedDept;
        const matchesLevel = selectedLevel === 'All' || course.level === selectedLevel;
        const matchesSemester = selectedSemester === 'All' || course.semester === selectedSemester;
        const timetableOk = timetableFilter === 'all'
            ? true
            : timetableFilter === 'schedulable'
                ? !course.excludeFromTimetable
                : !!course.excludeFromTimetable;
        return matchesSearch && matchesDept && matchesLevel && matchesSemester && timetableOk;
    });

    const handleEditClick = (course) => {
        setNewCourse({
            code: course.code,
            title: course.title,
            department: course.department || '',
            level: course.level,
            semester: course.semester || 'First',
            creditUnit: course.creditUnit || '2',
            excludeFromTimetable: !!course.excludeFromTimetable,
        });
        setLecturerSearch(course.lecturer); // Pre-fill search with current lecturer
        setEditId(course.id);
        setIsEditing(true);
        setIsAdding(true);
    };

    const handleAddCourse = async () => {
        if (!newCourse.code || !newCourse.title || !newCourse.department) return alert("Please fill in Code, Title, and Department.");

        // Duplicate Check
        if (!isEditing) {
            const duplicate = courses.find(c => 
                (c.code.toLowerCase().trim() === newCourse.code.toLowerCase().trim() ||
                 c.title.toLowerCase().trim() === newCourse.title.toLowerCase().trim()) &&
                c.department === newCourse.department
            );

            if (duplicate) {
                const semText = duplicate.semester ? duplicate.semester.toUpperCase() + ' SEMESTER' : '';
                alert(`THIS COURSE IS ALREADY PRESENT IN ${duplicate.department.toUpperCase()} (${duplicate.level} LVL ${semText})... YOU CANNOT ADD THE SAME COURSE TWICE TO THE SAME DEPARTMENT.`);
                return;
            }
        }

        try {
            const courseData = {
                code: newCourse.code,
                title: newCourse.title,
                department: newCourse.department,
                level: newCourse.level,
                semester: newCourse.semester,
                creditUnit: newCourse.creditUnit,
                excludeFromTimetable: !!newCourse.excludeFromTimetable,
                updatedAt: new Date().toISOString()
            };

            if (isEditing && editId) {
                // UPDATE
                await updateDoc(doc(db, 'courses', editId), courseData);
            } else {
                // CREATE
                await addDoc(collection(db, 'courses'), {
                    ...courseData,
                    createdAt: new Date().toISOString()
                });
                showToast("New course fully integrated into curriculum!");
            }

            setIsAdding(false);
            setNewCourse({
                code: '', title: '', department: '', level: '100', semester: 'First', creditUnit: '2', excludeFromTimetable: false,
            });
            setLecturerSearch('');
            setIsEditing(false);
            setEditId(null);
        } catch (error) {
            console.error("Error saving course:", error);
            alert("Failed to save course. Please try again.");
        }
    };

    const handleDeleteClickModal = (id) => {
        setCourseToDelete(id);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (courseToDelete) {
            await deleteDoc(doc(db, 'courses', courseToDelete));
            setIsDeleteDialogOpen(false);
            setCourseToDelete(null);
        }
    };

    // Group courses by department for the list view
    const groupedCourses = filteredCourses.reduce((acc, course) => {
        const dept = course.department || 'Unassigned';
        if (!acc[dept]) acc[dept] = [];
        acc[dept].push(course);
        return acc;
    }, {});

    const sortedDepts = Object.keys(groupedCourses).sort();

    const topRef = useRef(null);
    useEffect(() => {
        if (isAdding) {
            topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [isAdding]);

    return (
        <div ref={topRef} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 relative">
            {/* Toast Notification */}
            {toastMessage && (
                <div className="fixed top-6 right-6 bg-emerald-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 z-[100]">
                    <Check className="w-5 h-5 text-white" />
                    <span className="font-bold tracking-wide">{toastMessage}</span>
                </div>
            )}

            <InstructionGuide
                title="Curriculum Overview"
                steps={[
                    "Define the course catalog with Code, Title, Department, and Level.",
                    "Set the Semester (First/Second) for each course.",
                    "Use Exclude from timetable when a module must stay in the catalog but never be auto-scheduled (e.g. project-only, withdrawn offering).",
                    "Detailed configurations (Lecturer, Venue, Sections) are handled by the Coordinator."
                ]}
            />

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-slate-900 leading-tight">Course Management</h2>
                    <p className="text-slate-500 font-medium mt-1">Design and structure the academic curriculum.</p>
                </div>
                {!isAdding ? (
                    <Button
                        onClick={() => { setIsAdding(true); setIsEditing(false); setNewCourse({ code: '', title: '', department: '', level: '100', semester: 'First', creditUnit: '2', excludeFromTimetable: false }); }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-95 px-6 font-bold"
                    >
                        <Plus className="mr-2 h-5 w-5" /> Add New Course
                    </Button>
                ) : (
                    <Button variant="outline" onClick={() => { setIsAdding(false); setIsEditing(false); setEditId(null); }} className="border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold">
                        Cancel
                    </Button>
                )}
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white p-1 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-2 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                        className="w-full pl-11 pr-4 py-3 bg-transparent text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none"
                        placeholder="Search by course code or title..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="h-8 w-px bg-slate-200 hidden md:block"></div>
                <div className="flex flex-wrap gap-2 p-2 w-full md:w-auto">
                    <select
                        className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer hover:bg-slate-100 transition-colors"
                        value={selectedDept}
                        onChange={(e) => setSelectedDept(e.target.value)}
                    >
                        <option value="All">All Departments</option>
                        <option value="Software Engineering">Software Engineering</option>
                        <option value="Computer Science">Computer Science</option>
                        <option value="Information Technology">Information Technology</option>
                        <option value="Cyber Security">Cyber Security</option>
                        <option value="Data Science">Data Science</option>
                    </select>
                    <select
                        className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer hover:bg-slate-100 transition-colors"
                        value={selectedLevel}
                        onChange={(e) => setSelectedLevel(e.target.value)}
                    >
                        <option value="All">All Levels</option>
                        <option value="100">100 Level</option>
                        <option value="200">200 Level</option>
                        <option value="300">300 Level</option>
                        <option value="400">400 Level</option>
                    </select>
                    <select
                        className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer hover:bg-slate-100 transition-colors"
                        value={selectedSemester}
                        onChange={(e) => setSelectedSemester(e.target.value)}
                    >
                        <option value="All">All Semesters</option>
                        <option value="First">First Semester</option>
                        <option value="Second">Second Semester</option>
                    </select>
                    <select
                        className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer hover:bg-slate-100 transition-colors max-w-[12rem]"
                        value={timetableFilter}
                        onChange={(e) => setTimetableFilter(e.target.value)}
                        aria-label="Filter by timetable scheduling"
                    >
                        <option value="all">All (timetable)</option>
                        <option value="schedulable">Schedulable only</option>
                        <option value="excluded">Excluded from timetable</option>
                    </select>
                </div>
            </div>

            {/* Quick Stats Summary */}
            {!isAdding && !loading && courses.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {sortedDepts.map(dept => (
                        <div key={dept} className="bg-white p-4 rounded-xl border border-slate-100 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] flex flex-col items-start justify-between min-h-[80px] hover:border-indigo-100 hover:shadow-indigo-500/10 transition-all group">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate w-full group-hover:text-indigo-500 transition-colors">{dept}</span>
                            <span className="text-2xl font-black text-slate-800">{groupedCourses[dept].length}</span>
                        </div>
                    ))}
                </div>
            )}

            {isAdding && (
                <div className="relative">
                    <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-indigo-50/50 to-transparent -z-10 rounded-t-2xl"></div>
                    <Card className="border border-slate-200 bg-white/80 backdrop-blur-xl shadow-2xl shadow-indigo-500/10 rounded-2xl overflow-hidden ring-1 ring-slate-900/5">
                        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 py-6 px-8 bg-white/50">
                            <div>
                                <CardTitle className="text-xl font-black text-slate-900">
                                    {isEditing ? "Edit Course Details" : "Add New Course"}
                                </CardTitle>
                                <CardDescription className="text-slate-500 mt-1">Enter the core metadata for the course.</CardDescription>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setIsAdding(false)} className="hover:bg-rose-50 hover:text-rose-600 rounded-full transition-colors"><X size={20} /></Button>
                        </CardHeader>
                        <CardContent className="space-y-8 p-8">

                            {/* Row 1: Basic Info */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Course Code</label>
                                    <div className="relative">
                                        <input
                                            className="flex h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-base font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:font-normal placeholder:text-slate-400"
                                            placeholder="e.g. CSC 101"
                                            value={newCourse.code}
                                            onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="md:col-span-1 space-y-3">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Course Title</label>
                                    <input
                                        className="flex h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm font-semibold text-slate-700 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:font-normal placeholder:text-slate-400"
                                        placeholder="e.g. Intro to Computing"
                                        value={newCourse.title}
                                        onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Department</label>
                                    <div className="relative">
                                        <select
                                            className="flex h-12 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm font-semibold text-slate-700 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer"
                                            value={newCourse.department}
                                            onChange={(e) => setNewCourse({ ...newCourse, department: e.target.value })}
                                        >
                                            <option value="" disabled>Select Department</option>
                                            <option value="Software Engineering">Software Engineering</option>
                                            <option value="Computer Science">Computer Science</option>
                                            <option value="Information Technology">Information Technology</option>
                                            <option value="Cyber Security">Cyber Security</option>
                                            <option value="Data Science">Data Science</option>
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                                            <ChevronRight className="h-4 w-4 rotate-90" />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Level</label>
                                    <div className="relative">
                                        <select
                                            className="flex h-12 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm font-semibold text-slate-700 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer"
                                            value={newCourse.level}
                                            onChange={(e) => setNewCourse({ ...newCourse, level: e.target.value })}
                                        >
                                            <option value="100">100 Level</option>
                                            <option value="200">200 Level</option>
                                            <option value="300">300 Level</option>
                                            <option value="400">400 Level</option>
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                                            <ChevronRight className="h-4 w-4 rotate-90" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Row 2: Semester & Credit Unit */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                                <div className="space-y-3 col-span-1 md:col-span-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Semester</label>
                                    <div className="flex bg-slate-100 p-1 rounded-xl h-12">
                                        <button
                                            onClick={() => setNewCourse({ ...newCourse, semester: 'First' })}
                                            className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${newCourse.semester === 'First' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            First
                                        </button>
                                        <button
                                            onClick={() => setNewCourse({ ...newCourse, semester: 'Second' })}
                                            className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${newCourse.semester === 'Second' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            Second
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-3 col-span-1 md:col-span-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Credit Unit</label>
                                    <div className="relative">
                                        <select
                                            className="flex h-12 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm font-semibold text-slate-700 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer"
                                            value={newCourse.creditUnit}
                                            onChange={(e) => setNewCourse({ ...newCourse, creditUnit: e.target.value })}
                                        >
                                            <option value="1">1 Unit</option>
                                            <option value="2">2 Units</option>
                                            <option value="3">3 Units</option>
                                            <option value="4">4 Units</option>
                                            <option value="6">6 Units</option>
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                                            <ChevronRight className="h-4 w-4 rotate-90" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-xl border border-amber-200/90 bg-amber-50/40 p-4 md:p-5">
                                <label className="flex items-start gap-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        className="mt-1 rounded border-slate-300 text-amber-700 focus:ring-amber-500/30"
                                        checked={!!newCourse.excludeFromTimetable}
                                        onChange={(e) => setNewCourse({ ...newCourse, excludeFromTimetable: e.target.checked })}
                                    />
                                    <span>
                                        <span className="block text-sm font-black text-slate-900 uppercase tracking-wide">Exclude from timetable generation</span>
                                        <span className="block text-xs text-slate-600 mt-1.5 leading-relaxed font-medium">
                                            Course remains in the catalog but is hidden from coordinator lecture and exam timetable builders (and omitted from OR-Tools).
                                        </span>
                                    </span>
                                </label>
                            </div>


                            <div className="pt-4 flex justify-end">
                                <Button className={`px-8 text-white font-bold h-12 rounded-xl shadow-lg transition-transform hover:scale-[1.02] active:scale-95 ${isEditing ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`} onClick={handleAddCourse}>
                                    <Check className="mr-2 h-5 w-5" /> {isEditing ? "Update Course" : "Save Course"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {loading ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <div className="animate-spin w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-slate-500 font-medium animate-pulse">Loading existing courses...</p>
                </div>
            ) : (
                <>
                    <div className="space-y-16 mt-8">
                        {courses.length === 0 ? (
                            <div className="text-center py-24 bg-white/50 rounded-3xl border-2 border-dashed border-slate-200 hover:border-[#00008b]/30 hover:bg-white transition-all group cursor-pointer" onClick={() => setIsAdding(true)}>
                                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-[#00008b]/5 group-hover:scale-110 transition-transform">
                                    <BookOpen className="text-slate-300 group-hover:text-[#00008b]" size={36} />
                                </div>
                                <p className="text-slate-900 font-extrabold text-2xl tracking-tight">No courses found</p>
                                <p className="text-slate-500 text-base mt-2 max-w-sm mx-auto font-medium">Get started by defining the academic courses for your faculty.</p>
                                <Button variant="link" className="text-[#579044] font-bold mt-4 text-lg">Add your first course &rarr;</Button>
                            </div>
                        ) : (
                            sortedDepts.map(dept => (
                                <div key={dept} className="space-y-10 relative">
                                    {/* Department Header */}
                                    <div className="sticky top-0 z-20 flex items-center gap-4 bg-[#f8fafc]/90 backdrop-blur-xl py-5 -mx-4 px-4 border-y border-slate-200/50 shadow-sm">
                                        <div className="h-10 w-2 rounded-full bg-gradient-to-b from-[#00008b] to-[#579044] shadow-md"></div>
                                        <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                                            {dept}
                                        </h3>
                                    </div>

                                    <div className="space-y-12">
                                        {['100', '200', '300', '400'].map(level => {
                                            const levelCourses = groupedCourses[dept].filter(c => c.level === level);
                                            if (levelCourses.length === 0) return null;

                                            const firstSem = levelCourses.filter(c => !c.semester || c.semester === 'First');
                                            const secondSem = levelCourses.filter(c => c.semester === 'Second');

                                            return (
                                                <div key={level} className="relative pl-0 md:pl-16">
                                                    {/* Decorative Line & Level indicator (Desktop) */}
                                                    <div className="absolute left-6 top-0 bottom-0 w-px bg-slate-200/80 hidden md:block"></div>
                                                    <div className="absolute left-0 top-0 hidden md:flex items-center justify-center w-12 h-12 bg-white border-2 border-[#00008b]/10 rounded-2xl shadow-sm z-10 box-border border-b-4 border-b-[#00008b]/20 text-[#00008b] font-black text-lg">
                                                        {level}
                                                    </div>

                                                    {/* Mobile Level Indicator */}
                                                    <div className="md:hidden flex items-center justify-between mb-6 bg-white py-3 px-5 rounded-2xl border-2 border-[#00008b]/10 shadow-sm w-full border-b-4 border-b-[#00008b]/20">
                                                        <span className="text-[#00008b] font-black text-lg tracking-tight">{level} Level</span>
                                                        <div className="flex gap-1.5">
                                                            <span className="w-2 h-2 rounded-full bg-[#00008b]"></span>
                                                            <span className="w-2 h-2 rounded-full bg-[#579044]"></span>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-10">
                                                        
                                                        {/* First Semester */}
                                                        <div className="space-y-4">
                                                            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-3 mb-4">
                                                                <div className="h-px w-8 bg-slate-200"></div> First Semester
                                                            </h4>
                                                            <div className="grid gap-3">
                                                                {firstSem.map(course => (
                                                                    <CourseCard 
                                                                        key={course.id} 
                                                                        course={course} 
                                                                        onEdit={handleEditClick} 
                                                                        onDelete={handleDeleteClickModal} 
                                                                    />
                                                                ))}
                                                                {firstSem.length === 0 && (
                                                                    <div className="flex items-center justify-center w-full h-20 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                                                                        <span className="text-sm text-slate-400 font-medium">No courses defined</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Second Semester */}
                                                        <div className="space-y-4">
                                                            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-3 mb-4">
                                                                <div className="h-px w-8 bg-[#579044]/30"></div> Second Semester
                                                            </h4>
                                                            <div className="grid gap-3">
                                                                {secondSem.map(course => (
                                                                    <CourseCard 
                                                                        key={course.id} 
                                                                        course={course} 
                                                                        onEdit={handleEditClick} 
                                                                        onDelete={handleDeleteClickModal} 
                                                                    />
                                                                ))}
                                                                {secondSem.length === 0 && (
                                                                    <div className="flex items-center justify-center w-full h-20 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                                                                        <span className="text-sm text-slate-400 font-medium">No courses defined</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}

            <ConfirmationDialog
                isOpen={isDeleteDialogOpen}
                title="Delete Course?"
                description="This action cannot be undone. All data associated with this course will be permanently removed from the system."
                onConfirm={confirmDelete}
                onCancel={() => setIsDeleteDialogOpen(false)}
                confirmText="Delete Course"
                cancelText="Keep Course"
            />
        </div >
    );
};

export default Courses;
