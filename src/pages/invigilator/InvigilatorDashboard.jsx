import React, { useState } from 'react';
import Chatbot from '../../components/Chatbot';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input'; // Assuming Input component exists
import { Download, Filter, Search, ArrowLeft, Clock, UserCheck, UserX, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { cn } from '../../lib/utils';
import InstructionGuide from '../../components/InstructionGuide';

const InvigilatorDashboard = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('active');

    const students = [
        { id: '020220296', name: 'Ahmed Musa', seat: 'A-01', status: 'verified', image: null },
        { id: '020231568', name: 'Sarah Johnson', seat: 'A-02', status: 'pending', image: null },
        { id: '24212956', name: 'Chidi Okonkwo', seat: 'A-03', status: 'absent', image: null },
        { id: '020220300', name: 'Fatima Ali', seat: 'A-04', status: 'verified', image: null },
        { id: '020220301', name: 'John Doe', seat: 'B-01', status: 'pending', image: null },
        { id: '020220302', name: 'Jane Smith', seat: 'B-02', status: 'pending', image: null },
    ];

    const filteredStudents = students.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.id.includes(searchQuery)
    );

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Top Bar */}
            <header className="bg-white border-b px-4 py-3 md:px-6 md:py-4 flex flex-row items-center justify-between sticky top-0 z-10 shadow-sm gap-2">
                <div className="flex items-center gap-3 w-auto">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="-ml-2">
                        <ArrowLeft />
                    </Button>
                    <div>
                        {/* Desktop Brand */}
                        <div className="hidden md:flex items-center gap-3 mb-1">
                            <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
                            <span className="font-bold text-slate-900 text-xl tracking-tight">FacultyAide Invigilator</span>
                        </div>

                        {/* Title Section */}
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg md:text-xl font-bold text-slate-700">Exam Hall E125</h1>
                            <span className="text-[10px] md:text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium animate-pulse">LIVE</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 w-auto justify-end">
                    <div className="flex items-center gap-2 bg-slate-50 md:bg-slate-100 rounded-lg px-2 py-1 md:px-3 md:py-2 border border-slate-200">
                        <Clock size={16} className="text-slate-500" />
                        <span className="font-mono font-bold text-slate-800 text-base md:text-lg">01:45</span>
                        <span className="hidden md:inline text-xs text-slate-400 font-medium ml-1">REMAINING</span>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-4 md:p-6 overflow-auto bg-slate-50">
                <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <InstructionGuide
                        title="Invigilation Assistant Guide"
                        steps={[
                            "Use the Search bar to quickly find students by Name or ID Number.",
                            "Verify students as they enter by checking their ID card against the displayed details.",
                            "Mark students as 'Absent' if they do not show up relative to the exam start time.",
                            "Use the 'Report Incident' tab (placeholder) to log any malpractice or issues."
                        ]}
                    />

                    {/* Stats Overview */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="border-l-4 border-l-blue-500 shadow-sm">
                            <CardContent className="p-4">
                                <p className="text-xs font-bold text-slate-500 uppercase">Expected</p>
                                <p className="text-2xl font-bold text-slate-900">120</p>
                            </CardContent>
                        </Card>
                        <Card className="border-l-4 border-l-green-500 shadow-sm">
                            <CardContent className="p-4">
                                <p className="text-xs font-bold text-slate-500 uppercase">Verified</p>
                                <p className="text-2xl font-bold text-green-600">45</p>
                            </CardContent>
                        </Card>
                        <Card className="border-l-4 border-l-amber-500 shadow-sm">
                            <CardContent className="p-4">
                                <p className="text-xs font-bold text-slate-500 uppercase">Pending</p>
                                <p className="text-2xl font-bold text-amber-600">74</p>
                            </CardContent>
                        </Card>
                        <Card className="border-l-4 border-l-red-500 shadow-sm">
                            <CardContent className="p-4">
                                <p className="text-xs font-bold text-slate-500 uppercase">Absent</p>
                                <p className="text-2xl font-bold text-red-600">1</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Search & Filter */}
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                            <Input
                                placeholder="Search by Student Name or ID Number (e.g. 02022...)"
                                className="pl-10"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1 md:flex-none"><Filter className="mr-2 h-4 w-4" /> Filter Status</Button>
                            <Button variant="outline" className="flex-1 md:flex-none"><Download className="mr-2 h-4 w-4" /> Attendance Sheet</Button>
                        </div>
                    </div>

                    {/* Student List Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredStudents.map((student) => (
                            <Card key={student.id} className={cn(
                                "border transition-all duration-300 hover:shadow-md",
                                student.status === 'verified' ? "border-green-200 bg-green-50/30" :
                                    student.status === 'absent' ? "border-red-200 bg-red-50/30" : "border-slate-200"
                            )}>
                                <CardContent className="p-4 flex items-start gap-4">
                                    <div className="h-16 w-16 bg-slate-200 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                                        <Users size={32} className="text-slate-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-bold text-slate-900 truncate">{student.name}</h3>
                                                <p className="text-sm text-slate-500 font-mono">{student.id}</p>
                                            </div>
                                            <div className="bg-slate-100 px-2 py-1 rounded text-xs font-bold text-slate-600">
                                                {student.seat}
                                            </div>
                                        </div>

                                        <div className="mt-4 flex gap-2">
                                            {student.status === 'verified' ? (
                                                <div className="flex items-center text-green-600 text-sm font-bold w-full bg-green-100 py-1.5 px-3 rounded-md justify-center">
                                                    <CheckCircle2 size={16} className="mr-2" /> Verified
                                                </div>
                                            ) : student.status === 'absent' ? (
                                                <div className="flex items-center text-red-600 text-sm font-bold w-full bg-red-100 py-1.5 px-3 rounded-md justify-center">
                                                    <UserX size={16} className="mr-2" /> Absent
                                                </div>
                                            ) : (
                                                <>
                                                    <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 h-8 text-xs">
                                                        <UserCheck size={14} className="mr-2" /> Verify
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="flex-1 border-red-200 text-red-600 hover:bg-red-50 h-8 text-xs">
                                                        <UserX size={14} className="mr-2" /> Absent
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                </div>
            </main>

            {/* Chatbot Overlay */}
            <Chatbot />
        </div>
    );
};

export default InvigilatorDashboard;
