import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Plus, Users, BookOpen, Layers, X, Check, Trash2, Clock, Search, Edit2, ChevronRight, Filter } from 'lucide-react';
import InstructionGuide from '../../components/InstructionGuide';
import ConfirmationDialog from '../../components/ConfirmationDialog';
import { db } from '../../firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc, query, orderBy, updateDoc } from 'firebase/firestore';

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
    });

    // Delete confirmation state
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [courseToDelete, setCourseToDelete] = useState(null);

    // Filter and Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDept, setSelectedDept] = useState('All');
    const [selectedLevel, setSelectedLevel] = useState('All');
    const [selectedSemester, setSelectedSemester] = useState('All');

    // Lecturer Filter State
    const [lecturerSearch, setLecturerSearch] = useState('');

    // Filter Courses logic
    const filteredCourses = courses.filter(course => {
        const matchesSearch = course.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            course.title.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDept = selectedDept === 'All' || course.department === selectedDept;
        const matchesLevel = selectedLevel === 'All' || course.level === selectedLevel;
        const matchesSemester = selectedSemester === 'All' || course.semester === selectedSemester;
        return matchesSearch && matchesDept && matchesLevel && matchesSemester;
    });

    const handleEditClick = (course) => {
        setNewCourse({
            code: course.code,
            title: course.title,
            department: course.department || '',
            level: course.level,
            semester: course.semester || 'First',
            creditUnit: course.creditUnit || '2'
        });
        setLecturerSearch(course.lecturer); // Pre-fill search with current lecturer
        setEditId(course.id);
        setIsEditing(true);
        setIsAdding(true);
    };

    const handleAddCourse = async () => {
        if (!newCourse.code || !newCourse.title || !newCourse.department) return alert("Please fill in Code, Title, and Department.");

        try {
            const courseData = {
                code: newCourse.code,
                title: newCourse.title,
                department: newCourse.department,
                level: newCourse.level,
                semester: newCourse.semester,
                creditUnit: newCourse.creditUnit,
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
            }

            setIsAdding(false);
            setNewCourse({
                code: '', title: '', department: '', level: '100', semester: 'First', creditUnit: '2'
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
        <div ref={topRef} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            <InstructionGuide
                title="Curriculum Overview"
                steps={[
                    "Define the course catalog with Code, Title, Department, and Level.",
                    "Set the Semester (First/Second) for each course.",
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
                        onClick={() => { setIsAdding(true); setIsEditing(false); setNewCourse({ code: '', title: '', department: '', level: '100', semester: 'First' }); }}
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
                        <option value="General Course">General Course</option>
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
                                            <option value="General Course">General Course</option>
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
                    {/* Header for Desktop */}
                    <div className="hidden md:grid grid-cols-12 gap-6 px-4 py-3 bg-slate-100/50 rounded-xl border border-slate-200 text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
                        <div className="col-span-1 text-center">Level</div>
                        <div className="col-span-11 grid grid-cols-2 gap-6">
                            <div>First Semester</div>
                            <div>Second Semester</div>
                        </div>
                    </div>

                    <div className="space-y-12">
                        {courses.length === 0 ? (
                            <div className="text-center py-24 bg-white/50 rounded-3xl border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-white transition-all group cursor-pointer" onClick={() => setIsAdding(true)}>
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-indigo-50 group-hover:scale-110 transition-transform">
                                    <BookOpen className="text-slate-300 group-hover:text-indigo-400" size={32} />
                                </div>
                                <p className="text-slate-900 font-bold text-lg">No courses found</p>
                                <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">Get started by defining the academic courses for your faculty.</p>
                                <Button variant="link" className="text-indigo-600 font-bold mt-2">Add your first course &rarr;</Button>
                            </div>
                        ) : (
                            sortedDepts.map(dept => (
                                <div key={dept} className="space-y-6">
                                    <div className="flex items-center gap-4">
                                        <div className="h-2 w-2 rounded-full bg-slate-900"></div>
                                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                                            {dept}
                                        </h3>
                                        <div className="h-px flex-1 bg-slate-200/60"></div>
                                    </div>

                                    <div className="space-y-4">
                                        {['100', '200', '300', '400'].map(level => {
                                            const levelCourses = groupedCourses[dept].filter(c => c.level === level);
                                            const firstSem = levelCourses.filter(c => !c.semester || c.semester === 'First');
                                            const secondSem = levelCourses.filter(c => c.semester === 'Second');

                                            if (levelCourses.length === 0) return null;

                                            return (
                                                <div key={level} className="flex flex-col md:grid md:grid-cols-12 gap-6 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">

                                                    {/* Level Column */}
                                                    <div className="md:col-span-1 flex md:flex-col items-center justify-center md:justify-start gap-3 md:gap-1">
                                                        <div className="flex flex-col items-center justify-center bg-indigo-50/50 border border-indigo-100 rounded-lg py-2 w-16 h-16">
                                                            <span className="text-lg font-black text-indigo-600">{level}</span>
                                                            <span className="text-[9px] font-bold text-indigo-400 uppercase">Level</span>
                                                        </div>
                                                        <div className="md:hidden h-px flex-1 bg-slate-100"></div>
                                                    </div>

                                                    {/* Semesters Container */}
                                                    <div className="md:col-span-11 grid grid-cols-1 md:grid-cols-2 gap-6 w-full">

                                                        {/* First Semester */}
                                                        <div className="space-y-3">
                                                            <div className="flex items-center gap-2 md:hidden">
                                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">First Semester</span>
                                                                <div className="h-px flex-1 bg-slate-100"></div>
                                                            </div>
                                                            <div className="grid grid-cols-1 gap-3">
                                                                {firstSem.map(course => (
                                                                    <div
                                                                        key={course.id}
                                                                        onClick={() => handleEditClick(course)}
                                                                        className="group relative flex items-start gap-4 bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:border-indigo-300 hover:shadow-[0_4px_12px_-4px_rgba(79,70,229,0.2)] hover:-translate-y-0.5 transition-all cursor-pointer w-full"
                                                                    >
                                                                        <div className="mt-1 min-w-[4px] h-8 rounded-full bg-indigo-500/20 group-hover:bg-indigo-500 transition-colors"></div>
                                                                        <div className="flex flex-col flex-1 min-w-0">
                                                                            <div className="flex justify-between items-start gap-2">
                                                                                <span className="text-sm font-black text-slate-800 tracking-tight">{course.code}</span>

                                                                                <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                    {course.creditUnit && (
                                                                                        <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded mr-1 uppercase">
                                                                                            {course.creditUnit} U
                                                                                        </span>
                                                                                    )}
                                                                                    <button onClick={(e) => { e.stopPropagation(); handleEditClick(course); }} className="p-1 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-md transition-colors">
                                                                                        <Edit2 size={14} />
                                                                                    </button>
                                                                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteClickModal(course.id); }} className="p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-md transition-colors">
                                                                                        <Trash2 size={14} />
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                            <span className="text-xs text-slate-500 font-medium leading-relaxed mt-0.5 break-words">{course.title}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                                {firstSem.length === 0 && (
                                                                    <div className="flex items-center justify-center w-full h-16 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                                                        <span className="text-xs text-slate-400 font-medium italic">No 1st sem courses</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Second Semester */}
                                                        <div className="space-y-3">
                                                            <div className="flex items-center gap-2 md:hidden">
                                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Second Semester</span>
                                                                <div className="h-px flex-1 bg-slate-100"></div>
                                                            </div>
                                                            <div className="grid grid-cols-1 gap-3">
                                                                {secondSem.map(course => (
                                                                    <div
                                                                        key={course.id}
                                                                        onClick={() => handleEditClick(course)}
                                                                        className="group relative flex items-start gap-4 bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:border-indigo-300 hover:shadow-[0_4px_12px_-4px_rgba(79,70,229,0.2)] hover:-translate-y-0.5 transition-all cursor-pointer w-full"
                                                                    >
                                                                        <div className="mt-1 min-w-[4px] h-8 rounded-full bg-pink-500/20 group-hover:bg-pink-500 transition-colors"></div>
                                                                        <div className="flex flex-col flex-1 min-w-0">
                                                                            <div className="flex justify-between items-start gap-2">
                                                                                <span className="text-sm font-black text-slate-800 tracking-tight">{course.code}</span>

                                                                                <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                    {course.creditUnit && (
                                                                                        <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded mr-1 uppercase">
                                                                                            {course.creditUnit} U
                                                                                        </span>
                                                                                    )}
                                                                                    <button onClick={(e) => { e.stopPropagation(); handleEditClick(course); }} className="p-1 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-md transition-colors">
                                                                                        <Edit2 size={14} />
                                                                                    </button>
                                                                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteClickModal(course.id); }} className="p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-md transition-colors">
                                                                                        <Trash2 size={14} />
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                            <span className="text-xs text-slate-500 font-medium leading-relaxed mt-0.5 break-words">{course.title}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                                {secondSem.length === 0 && (
                                                                    <div className="flex items-center justify-center w-full h-16 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                                                        <span className="text-xs text-slate-400 font-medium italic">No 2nd sem courses</span>
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
