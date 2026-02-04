import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Plus, Users, BookOpen, X, Check, Trash2, Clock, Edit2 } from 'lucide-react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import InstructionGuide from '../../components/InstructionGuide';
import { db } from '../../firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc, query, orderBy, updateDoc, where } from 'firebase/firestore';

const CourseManager = () => {
    const { userData } = useOutletContext();
    const navigate = useNavigate();

    const [courses, setCourses] = useState([]);
    const [lecturers, setLecturers] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch Courses (Filtered by Dept) & Lecturers (Filtered by Dept)
    useEffect(() => {
        if (!userData?.department) return;

        // Fetch Courses for this Dept
        const qCourses = query(
            collection(db, 'courses'),
            where('department', '==', userData.department)
        );
        const unsubscribeCourses = onSnapshot(qCourses, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Firestore 'where' might mess with 'orderBy' if no index, so we sort in JS for now
            const sortedList = list.sort((a, b) => a.code.localeCompare(b.code));
            setCourses(sortedList);
            setLoading(false);
        });

        // Fetch Lecturers for this Dept
        const qLecturers = query(
            collection(db, 'lecturers'),
            where('department', '==', userData.department)
        );
        const unsubscribeLecturers = onSnapshot(qLecturers, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setLecturers(list);
        });

        return () => {
            unsubscribeCourses();
            unsubscribeLecturers();
        };
    }, [userData]);

    const [isAdding, setIsAdding] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);

    const [newCourse, setNewCourse] = useState({
        code: '',
        title: '',
        level: '100',
        students: '',
        lecturer: '',
        duration: '2h',
        type: 'Theory',
        isSectioned: false,
        sectionsCount: 2,
    });

    const [lecturerSearch, setLecturerSearch] = useState('');

    const handleEditClick = (course) => {
        setNewCourse({
            code: course.code,
            title: course.title,
            level: course.level,
            students: course.students,
            lecturer: course.lecturer,
            duration: course.duration,
            type: course.type,
            isSectioned: course.sections > 1,
            sectionsCount: course.sections > 1 ? course.sections : 2
        });
        setLecturerSearch(course.lecturer);
        setEditId(course.id);
        setIsEditing(true);
        setIsAdding(true);
    };

    const handleSave = async () => {
        if (!newCourse.code || !newCourse.title) return alert("Please fill in Code and Title.");

        try {
            const courseData = {
                code: newCourse.code,
                title: newCourse.title,
                department: userData.department, // Locked to their department
                level: newCourse.level,
                students: parseInt(newCourse.students) || 0,
                sections: newCourse.isSectioned ? newCourse.sectionsCount : 1,
                lecturer: newCourse.lecturer || 'Pending',
                type: newCourse.type,
                duration: newCourse.duration,
                updatedAt: new Date().toISOString()
            };

            if (isEditing && editId) {
                await updateDoc(doc(db, 'courses', editId), courseData);
            } else {
                await addDoc(collection(db, 'courses'), {
                    ...courseData,
                    createdAt: new Date().toISOString()
                });
            }

            setIsAdding(false);
            setNewCourse({
                code: '', title: '', level: '100', students: '', lecturer: '',
                duration: '2h', type: 'Theory', isSectioned: false, sectionsCount: 2
            });
            setLecturerSearch('');
            setIsEditing(false);
            setEditId(null);
        } catch (error) {
            console.error("Error saving course:", error);
            alert("Failed to save course.");
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Delete this course?")) {
            await deleteDoc(doc(db, 'courses', id));
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <InstructionGuide
                title={`${userData?.department} Curriculum`}
                steps={[
                    "Manage courses specific to your department.",
                    "Ensure enrollment numbers are accurate for room capacity matching.",
                    "Select lecturers from the verified faculty list."
                ]}
            />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Department Courses</h2>
                    <p className="text-slate-500 text-sm">Review and configure courses for the upcoming timetable.</p>
                </div>
                {!isAdding && (
                    <Button onClick={() => setIsAdding(true)} className="bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 w-full sm:w-auto font-bold">
                        <Plus className="mr-2 h-4 w-4" /> New Course
                    </Button>
                )}
            </div>

            {isAdding && (
                <Card className="border-indigo-100 shadow-xl rounded-xl">
                    <CardHeader className="bg-slate-50 py-4 border-b">
                        <CardTitle className="text-lg font-bold">{isEditing ? "Modify Course" : "Register Course"}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500">Course Code</label>
                                <input
                                    className="flex h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold"
                                    placeholder="CSC 202"
                                    value={newCourse.code}
                                    onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value })}
                                />
                            </div>
                            <div className="md:col-span-1 space-y-2">
                                <label className="text-xs font-bold text-slate-500">Course Title</label>
                                <input
                                    className="flex h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold"
                                    placeholder="Data Structures"
                                    value={newCourse.title}
                                    onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500">Academic Level</label>
                                <select
                                    className="flex h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold bg-white"
                                    value={newCourse.level}
                                    onChange={(e) => setNewCourse({ ...newCourse, level: e.target.value })}
                                >
                                    {[100, 200, 300, 400].map(l => <option key={l} value={l}>{l} Level</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500">Assign Lecturer</label>
                                <input
                                    className="flex h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                    placeholder="Search lecturers..."
                                    value={newCourse.lecturer || lecturerSearch}
                                    onChange={(e) => {
                                        setLecturerSearch(e.target.value);
                                        setNewCourse({ ...newCourse, lecturer: e.target.value });
                                    }}
                                    list="dept-lecturers"
                                />
                                <datalist id="dept-lecturers">
                                    {lecturers.map(l => (
                                        <option key={l.id} value={`${l.title} ${l.name}`} />
                                    ))}
                                </datalist>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500">Duration</label>
                                    <select
                                        className="h-11 w-full rounded-lg border border-slate-200 px-2 text-sm font-bold"
                                        value={newCourse.duration}
                                        onChange={(e) => setNewCourse({ ...newCourse, duration: e.target.value })}
                                    >
                                        <option value="1h">1 Hour</option>
                                        <option value="2h">2 Hours</option>
                                        <option value="3h">3 Hours</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500">Type</label>
                                    <select
                                        className="h-11 w-full rounded-lg border border-slate-200 px-2 text-sm font-bold"
                                        value={newCourse.type}
                                        onChange={(e) => setNewCourse({ ...newCourse, type: e.target.value })}
                                    >
                                        <option value="Theory">Theory</option>
                                        <option value="Practical">Practical</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-6 p-4 bg-slate-50 rounded-xl border">
                            <div className="flex-1 space-y-2">
                                <label className="text-xs font-bold text-slate-500">Expected Enrollment</label>
                                <div className="relative">
                                    <Users className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                    <input
                                        type="number"
                                        className="h-10 w-full pl-9 rounded-lg border border-slate-200 text-sm font-bold"
                                        value={newCourse.students}
                                        onChange={(e) => setNewCourse({ ...newCourse, students: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex-1 flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="isSec"
                                    className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                                    checked={newCourse.isSectioned}
                                    onChange={(e) => setNewCourse({ ...newCourse, isSectioned: e.target.checked })}
                                />
                                <label htmlFor="isSec" className="text-sm font-bold text-slate-700">Split into Sections?</label>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" className="flex-1" onClick={() => setIsAdding(false)}>Cancel</Button>
                            <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold" onClick={handleSave}>
                                {isEditing ? "Update" : "Save"} Course
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-4">
                {courses.map(course => (
                    <Card key={course.id} className="border-slate-200 hover:shadow-md transition-shadow">
                        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-black text-xs border border-indigo-100">
                                    {course.code}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900">{course.title}</h3>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{course.level}Lvl</span>
                                        <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">{course.type}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{course.duration}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-6">
                                <div className="text-right hidden sm:block">
                                    <div className="text-sm font-bold text-slate-700">{course.lecturer}</div>
                                    <div className="text-[10px] text-slate-400 font-medium">Assigned Lecturer</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => handleEditClick(course)}>
                                        <Edit2 size={16} />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(course.id)}>
                                        <Trash2 size={16} />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {!loading && courses.length === 0 && (
                    <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-200">
                        <BookOpen className="mx-auto h-12 w-12 text-slate-200 mb-4" />
                        <p className="text-slate-500 font-bold">No courses yet in your department.</p>
                        <p className="text-slate-400 text-sm">Add your first course to begin scheduling.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CourseManager;
