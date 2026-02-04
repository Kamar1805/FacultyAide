import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Plus, Users, BookOpen, Layers, X, Check, Trash2, Clock, Search, Edit2 } from 'lucide-react';
import InstructionGuide from '../../components/InstructionGuide';
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
        students: '',
        lecturer: '',
        duration: '2h',
        type: 'Theory',
        isSectioned: false,
        sectionsCount: 2,
    });




    // Lecturer Filter State
    const [lecturerSearch, setLecturerSearch] = useState('');

    const filteredLecturers = lecturers.filter(l =>
        l.name.toLowerCase().includes(lecturerSearch.toLowerCase()) ||
        l.email.toLowerCase().includes(lecturerSearch.toLowerCase())
    );

    const handleEditClick = (course) => {
        setNewCourse({
            code: course.code,
            title: course.title,
            department: course.department || '',
            level: course.level,
            students: course.students,
            lecturer: course.lecturer,
            duration: course.duration,
            type: course.type,
            isSectioned: course.sections > 1,
            sectionsCount: course.sections > 1 ? course.sections : 2
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
                students: parseInt(newCourse.students) || 0,
                sections: newCourse.isSectioned ? newCourse.sectionsCount : 1,
                lecturer: newCourse.lecturer || 'Pending',
                type: newCourse.type,
                duration: newCourse.duration,
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
                code: '', title: '', department: '', level: '100', students: '', lecturer: '',
                duration: '2h', type: 'Theory', isSectioned: false, sectionsCount: 2
            });
            setLecturerSearch('');
            setIsEditing(false);
            setEditId(null);
        } catch (error) {
            console.error("Error saving course:", error);
            alert("Failed to save course. Please try again.");
        }
    };

    const handleDeleteCourse = async (id) => {
        if (window.confirm("Are you sure you want to delete this course?")) {
            await deleteDoc(doc(db, 'courses', id));
        }
    };

    // Group courses by department for the list view
    const groupedCourses = courses.reduce((acc, course) => {
        const dept = course.department || 'Unassigned';
        if (!acc[dept]) acc[dept] = [];
        acc[dept].push(course);
        return acc;
    }, {});

    const sortedDepts = Object.keys(groupedCourses).sort();

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <InstructionGuide
                title="Curriculum Management"
                steps={[
                    "Define course parameters including credit load, duration, and type (Theory/Practical).",
                    "Assign primary lecturers.",
                    "Manage multi-section courses for large cohorts."
                ]}
            />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Course Management</h2>
                    <p className="text-slate-500 text-sm">Manage academic curriculum across all departments.</p>
                </div>
                {!isAdding ? (
                    <Button onClick={() => { setIsAdding(true); setIsEditing(false); setNewCourse({ code: '', title: '', department: '', level: '100', students: '', lecturer: '', duration: '2h', type: 'Theory', isSectioned: false, sectionsCount: 2 }); }} className="bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/20 w-full sm:w-auto">
                        <Plus className="mr-2 h-4 w-4" /> Add Course
                    </Button>
                ) : (
                    <Button variant="outline" onClick={() => { setIsAdding(false); setIsEditing(false); setEditId(null); }} className="w-full sm:w-auto">
                        Cancel
                    </Button>
                )}
            </div>

            {/* Quick Stats Summary */}
            {!isAdding && !loading && courses.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {sortedDepts.map(dept => (
                        <div key={dept} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
                            <span className="text-lg font-black text-slate-800">{groupedCourses[dept].length}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter truncate w-full">{dept}</span>
                        </div>
                    ))}
                </div>
            )}

            {isAdding && (
                <Card className="border border-indigo-100 bg-white shadow-xl shadow-indigo-100/50 rounded-xl overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between bg-slate-50 border-b border-slate-100 py-4">
                        <div>
                            <CardTitle className="text-lg font-bold text-slate-900">
                                {isEditing ? "Edit Course" : "Add New Course"}
                            </CardTitle>
                            <CardDescription>Enter course details for timetable allocation.</CardDescription>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setIsAdding(false)} className="hover:bg-slate-200 rounded-full"><X size={18} /></Button>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6 p-6">

                        {/* Row 1: Basic Info */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Course Code</label>
                                <input
                                    className="flex h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    placeholder="CSC 101"
                                    value={newCourse.code}
                                    onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value })}
                                />
                            </div>
                            <div className="md:col-span-1 space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Course Title</label>
                                <input
                                    className="flex h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    placeholder="Introduction to Computing"
                                    value={newCourse.title}
                                    onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Department</label>
                                <select
                                    className="flex h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    value={newCourse.department}
                                    onChange={(e) => setNewCourse({ ...newCourse, department: e.target.value })}
                                >
                                    <option value="" disabled>Select Dept</option>
                                    <option value="Software Engineering">Software Engineering</option>
                                    <option value="Computer Science">Computer Science</option>
                                    <option value="Information Technology">Information Technology</option>
                                    <option value="Cyber Security">Cyber Security</option>
                                    <option value="Data Science">Data Science</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Level</label>
                                <select
                                    className="flex h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    value={newCourse.level}
                                    onChange={(e) => setNewCourse({ ...newCourse, level: e.target.value })}
                                >
                                    <option value="100">100 Level</option>
                                    <option value="200">200 Level</option>
                                    <option value="300">300 Level</option>
                                    <option value="400">400 Level</option>
                                </select>
                            </div>
                        </div>

                        {/* Row 2: Logistics */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2 relative">
                                <label className="text-xs font-bold text-slate-500 uppercase">Primary Lecturer</label>
                                {/* Searchable Dropdown Implementation */}
                                <input
                                    className="flex h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 mb-1"
                                    placeholder="Type to search lecturers..."
                                    value={newCourse.lecturer || lecturerSearch}
                                    onChange={(e) => {
                                        setLecturerSearch(e.target.value);
                                        setNewCourse({ ...newCourse, lecturer: e.target.value });
                                    }}
                                    list="lecturer-options"
                                />
                                <datalist id="lecturer-options">
                                    {filteredLecturers.map(l => (
                                        <option key={l.id} value={`${l.title} ${l.name}`}>
                                            {l.department}
                                        </option>
                                    ))}
                                </datalist>
                                {newCourse.lecturer && (
                                    <div className="absolute right-3 top-9 text-green-500">
                                        <Check size={16} />
                                    </div>
                                )}
                            </div>


                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Duration</label>
                                <select
                                    className="flex h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    value={newCourse.duration}
                                    onChange={(e) => setNewCourse({ ...newCourse, duration: e.target.value })}
                                >
                                    <option value="1h">1 Hour</option>
                                    <option value="2h">2 Hours</option>
                                    <option value="3h">3 Hours</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Type</label>
                                <div className="flex bg-slate-100 p-1 rounded-lg">
                                    <button
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${newCourse.type === 'Theory' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                                        onClick={() => setNewCourse({ ...newCourse, type: 'Theory' })}
                                    >Theory</button>
                                    <button
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${newCourse.type === 'Practical' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                                        onClick={() => setNewCourse({ ...newCourse, type: 'Practical' })}
                                    >Practical</button>
                                </div>
                            </div>
                        </div>

                        {/* Row 3: Sections & Enrollment */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Total Enrollment</label>
                                <div className="relative">
                                    <Users className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                    <input
                                        type="number"
                                        className="flex h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                                        placeholder="0"
                                        value={newCourse.students}
                                        onChange={(e) => setNewCourse({ ...newCourse, students: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="md:col-span-2 flex flex-col justify-center space-y-3">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="sectionToggle"
                                        className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                                        checked={newCourse.isSectioned}
                                        onChange={(e) => setNewCourse({ ...newCourse, isSectioned: e.target.checked })}
                                    />
                                    <label htmlFor="sectionToggle" className="font-bold text-slate-700 select-none cursor-pointer">
                                        Enable Multiple Sections (Cohort Split)
                                    </label>
                                </div>
                                {newCourse.isSectioned && (
                                    <div className="flex items-center gap-4 animate-in fade-in slide-in-from-top-1 pl-8">
                                        <span className="text-sm font-medium text-slate-500">Split into:</span>
                                        <select
                                            className="h-9 rounded-md border border-slate-200 px-3 py-1 text-sm font-bold bg-white focus:outline-none"
                                            value={newCourse.sectionsCount}
                                            onChange={(e) => setNewCourse({ ...newCourse, sectionsCount: parseInt(e.target.value) })}
                                        >
                                            <option value={2}>2 Sections (A, B)</option>
                                            <option value={3}>3 Sections (A, B, C)</option>
                                            <option value={4}>4 Sections (A, B, C, D)</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="pt-2">
                            <Button className={`w-full text-white font-bold h-12 rounded-lg ${isEditing ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'}`} onClick={handleAddCourse}>
                                <Check className="mr-2 h-5 w-5" /> {isEditing ? "Update Course" : "Save Course Configuration"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {loading ? (
                <div className="text-center py-20 bg-white rounded-xl border border-slate-100">
                    <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-slate-500 font-medium">Loading courses...</p>
                </div>
            ) : (
                <div className="space-y-12">
                    {courses.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                            <p className="text-slate-500 font-medium">No courses added yet.</p>
                            <p className="text-slate-400 text-sm mt-1">Click "Add Course" to start building the curriculum.</p>
                        </div>
                    ) : (
                        sortedDepts.map(dept => (
                            <div key={dept} className="space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="h-px flex-1 bg-slate-200"></div>
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] bg-slate-50 px-4 py-1.5 rounded-full border border-slate-100">
                                        {dept} <span className="ml-2 text-indigo-500">{groupedCourses[dept].length}</span>
                                    </h3>
                                    <div className="h-px flex-1 bg-slate-200"></div>
                                </div>
                                <div className="grid gap-4">
                                    {groupedCourses[dept].map((course) => (
                                        <Card key={course.id} className="hover:shadow-md transition-all border-slate-200 group">
                                            <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                                <div className="flex items-start gap-5">
                                                    <div className="bg-slate-50 text-slate-700 px-4 py-3 rounded-xl font-bold text-lg min-w-[5.5rem] text-center border border-slate-200">
                                                        {course.code}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                                                            {course.title}
                                                            <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full border ${course.type === 'Theory' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-purple-50 text-purple-700 border-purple-100'}`}>
                                                                {course.type}
                                                            </span>
                                                        </h3>
                                                        <p className="text-xs text-indigo-600 font-medium">{course.department}</p>
                                                        <div className="flex flex-wrap items-center gap-y-1 gap-x-4 mt-2">
                                                            <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5"><Users size={14} className="text-slate-400" /> {course.students} Enrolled</span>
                                                            <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5"><Clock size={14} className="text-slate-400" /> {course.duration}</span>
                                                            <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5"><BookOpen size={14} className="text-slate-400" /> {course.lecturer}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-6 self-end md:self-center">
                                                    {course.sections > 1 && (
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-2xl font-black text-slate-800">{course.sections}</span>
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sections</span>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                            onClick={() => handleEditClick(course)}
                                                        >
                                                            <Edit2 size={20} />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            onClick={() => handleDeleteCourse(course.id)}
                                                        >
                                                            <Trash2 size={20} />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default Courses;
