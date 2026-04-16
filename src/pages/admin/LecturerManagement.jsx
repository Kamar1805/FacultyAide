import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { UserPlus, Mail, Briefcase, GraduationCap, Trash2, Edit2, Search, X, Check } from 'lucide-react';
import InstructionGuide from '../../components/InstructionGuide';
import { db } from '../../firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc, query, orderBy, updateDoc } from 'firebase/firestore';

const LecturerManagement = () => {
    const [lecturers, setLecturers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);

    const [newLecturer, setNewLecturer] = useState({
        name: '',
        title: 'Dr.',
        email: '',
        department: '',
    });

    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const q = query(collection(db, 'lecturers'), orderBy('name', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setLecturers(list);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleSave = async () => {
        if (!newLecturer.name || !newLecturer.email || !newLecturer.department) {
            alert("Please fill in all fields.");
            return;
        }

        try {
            if (isEditing && editId) {
                await updateDoc(doc(db, 'lecturers', editId), {
                    ...newLecturer,
                    updatedAt: new Date().toISOString()
                });
            } else {
                await addDoc(collection(db, 'lecturers'), {
                    ...newLecturer,
                    createdAt: new Date().toISOString()
                });
            }
            setIsAdding(false);
            setIsEditing(false);
            setEditId(null);
            setNewLecturer({ name: '', title: 'Dr.', email: '', department: '' });
        } catch (error) {
            console.error("Error saving lecturer:", error);
            alert("Failed to save. check console.");
        }
    };

    const handleEdit = (lecturer) => {
        setNewLecturer({
            name: lecturer.name,
            title: lecturer.title,
            email: lecturer.email,
            department: lecturer.department
        });
        setEditId(lecturer.id);
        setIsEditing(true);
        setIsAdding(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm("Delete this lecturer?")) {
            await deleteDoc(doc(db, 'lecturers', id));
        }
    };

    const filteredLecturers = lecturers.filter(l =>
        l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.department.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <InstructionGuide
                title="Lecturer Directory"
                steps={[
                    "Catalog all faculty members participating in this semester.",
                    "Ensure correct department assignment for accurate timetable filtering.",
                    "Lecturers added here will be available for coordinators to assign to courses."
                ]}
            />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Lecturer Management</h2>
                    <p className="text-slate-500 text-sm">Central repository of faculty staff and affiliations.</p>
                </div>
                {!isAdding ? (
                    <Button onClick={() => setIsAdding(true)} className="bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/20 w-full sm:w-auto">
                        <UserPlus className="mr-2 h-4 w-4" /> Add Lecturer
                    </Button>
                ) : (
                    <Button variant="outline" onClick={() => { setIsAdding(false); setIsEditing(false); }} className="w-full sm:w-auto">
                        Cancel
                    </Button>
                )}
            </div>

            {isAdding && (
                <Card className="border border-indigo-100 bg-white shadow-xl shadow-indigo-100/50 rounded-xl overflow-hidden">
                    <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
                        <CardTitle className="text-lg font-bold text-slate-800">{isEditing ? "Edit Lecturer Profile" : "New Lecturer Profile"}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Title</label>
                                <select
                                    className="flex h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold bg-white"
                                    value={newLecturer.title}
                                    onChange={(e) => setNewLecturer({ ...newLecturer, title: e.target.value })}
                                >
                                    <option value="Prof.">Professor</option>
                                    <option value="Dr.">Doctor</option>
                                    <option value="Mr.">Mr.</option>
                                    <option value="Mrs.">Mrs.</option>
                                    <option value="Ms.">Ms.</option>
                                    <option value="Engr.">Engineer</option>
                                </select>
                            </div>
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Full Name</label>
                                <input
                                    className="flex h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold"
                                    placeholder="e.g. John Doe"
                                    value={newLecturer.name}
                                    onChange={(e) => setNewLecturer({ ...newLecturer, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Department</label>
                                <select
                                    className="flex h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold bg-white"
                                    value={newLecturer.department}
                                    onChange={(e) => setNewLecturer({ ...newLecturer, department: e.target.value })}
                                >
                                    <option value="">Select Dept</option>
                                    <option value="Software Engineering">Software Engineering</option>
                                    <option value="Computer Science">Computer Science</option>
                                    <option value="Information Technology">Information Technology</option>
                                    <option value="Cyber Security">Cyber Security</option>
                                    <option value="Data Science">Data Science</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Work Email</label>
                            <input
                                type="email"
                                className="flex h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold"
                                placeholder="j.doe@nileuniversity.edu.ng"
                                value={newLecturer.email}
                                onChange={(e) => setNewLecturer({ ...newLecturer, email: e.target.value })}
                            />
                        </div>

                        <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12 rounded-lg" onClick={handleSave}>
                            {isEditing ? "Update Profile" : "Create Record"}
                        </Button>
                    </CardContent>
                </Card>
            )}

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex-1 flex gap-2 w-full">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <input
                                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                placeholder="Search by name, email, or department..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Button className="bg-slate-800 text-white px-4 h-10 shadow-sm">
                            <Search size={16} className="mr-2" /> Search
                        </Button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Lecturer</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Department</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Contact</th>
                                <th className="p-4 text-center text-xs font-bold text-slate-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredLecturers.map((l) => (
                                <tr key={l.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold">
                                                {l.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-900">{l.title} {l.name}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                                            <span className="text-sm font-medium text-slate-600">{l.department}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <Mail className="h-3.5 w-3.5 text-slate-400" />
                                            <span className="text-sm text-slate-500">{l.email}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center justify-center gap-2">
                                            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-indigo-600" onClick={() => handleEdit(l)}>
                                                <Edit2 size={16} />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-500" onClick={() => handleDelete(l.id)}>
                                                <Trash2 size={16} />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredLecturers.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="p-10 text-center text-slate-400 italic">No lecturers found matching your search.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default LecturerManagement;
