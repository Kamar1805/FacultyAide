import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Plus, Users, BookOpen, Layers, X, Check, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import InstructionGuide from '../../components/InstructionGuide';

const Courses = () => {
    const [courses, setCourses] = useState([
        { id: 1, code: 'CSC 101', title: 'Intro to CS', level: '100', students: 850, sections: 4, lecturer: 'Dr. Smith' },
        { id: 2, code: 'SEN 202', title: 'Software Rqmts', level: '200', students: 120, sections: 1, lecturer: 'Prof. Ade' },
    ]);

    const [isAdding, setIsAdding] = useState(false);
    const [newCourse, setNewCourse] = useState({
        code: '',
        title: '',
        level: '100',
        students: '',
        isSectioned: false,
        sectionsCount: 2,
        maxPerSection: 150,
        lecturers: ['']
    });

    const handleAddCourse = () => {
        if (!newCourse.code || !newCourse.title) return;

        const sections = newCourse.isSectioned ? newCourse.sectionsCount : 1;
        const mainLecturer = newCourse.lecturers[0] || 'Pending';

        setCourses([...courses, {
            id: Date.now(),
            code: newCourse.code,
            title: newCourse.title,
            level: newCourse.level,
            students: parseInt(newCourse.students) || 0,
            sections: sections,
            lecturer: mainLecturer
        }]);

        setIsAdding(false);
        setNewCourse({
            code: '', title: '', level: '100', students: '',
            isSectioned: false, sectionsCount: 2, maxPerSection: 150, lecturers: ['']
        });
    };

    const updateLecturer = (index, value) => {
        const updated = [...newCourse.lecturers];
        updated[index] = value;
        setNewCourse({ ...newCourse, lecturers: updated });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <InstructionGuide
                title="Course Management"
                steps={[
                    "Manage the department's course catalog.",
                    "Use 'Add New Course' to define course properties.",
                    "Enable 'Divided into sections' for large classes to assign multiple lecturers and splits."
                ]}
            />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Courses</h2>
                    <p className="text-slate-500 text-sm">Manage curriculum and student enrollment.</p>
                </div>
                {!isAdding && (
                    <Button onClick={() => setIsAdding(true)} className="bg-primary hover:bg-primary/90 shadow-lg shadow-blue-900/20 w-full sm:w-auto">
                        <Plus className="mr-2 h-4 w-4" /> Add New Course
                    </Button>
                )}
            </div>

            {isAdding && (
                <Card className="border-2 border-primary/20 bg-slate-50/50">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-primary">Add Course Details</CardTitle>
                        <Button variant="ghost" size="icon" onClick={() => setIsAdding(false)}><X size={18} /></Button>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Basic Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Course Code</label>
                                <input
                                    className="flex h-10 w-full rounded-md border border-slate-200 px-3 py-2 text-sm bg-white"
                                    placeholder="CSC 101"
                                    value={newCourse.code}
                                    onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value })}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Course Title</label>
                                <input
                                    className="flex h-10 w-full rounded-md border border-slate-200 px-3 py-2 text-sm bg-white"
                                    placeholder="Introduction to..."
                                    value={newCourse.title}
                                    onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Level</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-slate-200 px-3 py-2 text-sm bg-white"
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

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Registered Students</label>
                                <input
                                    type="number"
                                    className="flex h-10 w-full rounded-md border border-slate-200 px-3 py-2 text-sm bg-white"
                                    placeholder="0"
                                    value={newCourse.students}
                                    onChange={(e) => setNewCourse({ ...newCourse, students: e.target.value })}
                                />
                            </div>

                            {/* Section Toggle */}
                            <div className="md:col-span-2 bg-white p-4 rounded-lg border border-slate-200">
                                <div className="flex items-center gap-3 mb-4">
                                    <input
                                        type="checkbox"
                                        id="sectionToggle"
                                        className="w-5 h-5 text-primary rounded focus:ring-primary"
                                        checked={newCourse.isSectioned}
                                        onChange={(e) => setNewCourse({ ...newCourse, isSectioned: e.target.checked })}
                                    />
                                    <label htmlFor="sectionToggle" className="font-bold text-slate-700 select-none cursor-pointer">
                                        Is this course divided into sections?
                                    </label>
                                </div>

                                {newCourse.isSectioned && (
                                    <div className="pl-8 space-y-4 animate-in fade-in slide-in-from-top-2">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs text-slate-500 mb-1 block">Number of Sections (Max 4)</label>
                                                <select
                                                    className="flex h-9 w-full rounded-md border border-slate-200 px-3 py-1 text-sm"
                                                    value={newCourse.sectionsCount}
                                                    onChange={(e) => setNewCourse({ ...newCourse, sectionsCount: parseInt(e.target.value) })}
                                                >
                                                    <option value={2}>2 Sections</option>
                                                    <option value={3}>3 Sections</option>
                                                    <option value={4}>4 Sections</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 mb-1 block">Max Students / Section</label>
                                                <input
                                                    type="number"
                                                    className="flex h-9 w-full rounded-md border border-slate-200 px-3 py-1 text-sm"
                                                    value={newCourse.maxPerSection}
                                                    onChange={(e) => setNewCourse({ ...newCourse, maxPerSection: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Lecturers per Section</label>
                                            {Array.from({ length: newCourse.sectionsCount }).map((_, i) => (
                                                <div key={i} className="flex items-center gap-2">
                                                    <span className="text-xs font-mono font-bold bg-slate-100 px-2 py-1.5 rounded text-slate-500">SEC {i + 1}</span>
                                                    <input
                                                        className="flex-1 h-9 rounded-md border border-slate-200 px-3 text-sm placeholder:text-slate-300"
                                                        placeholder={`Lecturer for Section ${i + 1}`}
                                                        value={newCourse.lecturers[i] || ''}
                                                        onChange={(e) => updateLecturer(i, e.target.value)}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {!newCourse.isSectioned && (
                                    <div className="pl-8">
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Course Lecturer</label>
                                        <input
                                            className="flex h-10 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                                            placeholder="Enter Lecturer Name"
                                            value={newCourse.lecturers[0] || ''}
                                            onChange={(e) => updateLecturer(0, e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <Button className="w-full bg-slate-900 text-white hover:bg-slate-800" onClick={handleAddCourse}>
                            <Check className="mr-2 h-4 w-4" /> Save Course
                        </Button>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-4">
                {courses.map((course) => (
                    <Card key={course.id} className="hover:shadow-md transition-all border-slate-200">
                        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-4">
                                <div className="bg-blue-50 text-primary px-3 py-2 rounded-lg font-bold text-lg min-w-[5rem] text-center border border-blue-100">
                                    {course.code}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-lg">{course.title}</h3>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{course.level} Level</span>
                                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><Users size={12} /> {course.students} Students</span>
                                        {course.sections > 1 && (
                                            <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border border-amber-100"><Layers size={12} /> {course.sections} Sections</span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">Lecturer: <span className="font-medium text-slate-700">{course.lecturer}</span></p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={18} /></Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default Courses;
