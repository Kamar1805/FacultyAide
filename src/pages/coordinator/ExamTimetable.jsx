import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Play, Calendar, Download, RefreshCw, Filter, ShieldCheck, Users } from 'lucide-react';
import InstructionGuide from '../../components/InstructionGuide';

const ExamTimetable = () => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [timetable, setTimetable] = useState(null);

    const handleGenerate = () => {
        setIsGenerating(true);
        setTimeout(() => {
            setIsGenerating(false);
            setTimetable(true);
        }, 1500);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <InstructionGuide
                title="Exam Timetable Engine"
                steps={[
                    "Ensure all courses have 'Exam Required' flagged in Course Management.",
                    "Set exam duration and date range constraints.",
                    "Generate schedule to minimize student conflicts (same day exams).",
                    "Download invigilator assignment roster."
                ]}
            />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Exam Timetable Engine</h1>
                    <p className="text-slate-500 text-sm">Schedule end-of-semester examinations.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="gap-2">
                        <Users size={16} /> Invigilators
                    </Button>
                    <Button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className={`gap-2 ${isGenerating ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'} text-white shadow-lg shadow-indigo-200 transition-all`}
                    >
                        {isGenerating ? <RefreshCw className="animate-spin" size={16} /> : <Play size={16} />}
                        {isGenerating ? 'Scheduling...' : 'Generate Exam Schedule'}
                    </Button>
                </div>
            </div>

            {timetable ? (
                <Card className="border-slate-200 shadow-xl shadow-slate-200/50">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle className="text-lg font-bold text-slate-800">Final Exam Schedule</CardTitle>
                                <CardDescription>Period: May 12 - May 24 • Total Exams: 48</CardDescription>
                            </div>
                            <Button variant="outline" size="sm" className="gap-2">
                                <Download size={14} /> PDF
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {/* List View of Exams */}
                        <div className="divide-y divide-slate-100">
                            {[1, 2, 3, 4, 5].map((item) => (
                                <div key={item} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50 transition-colors gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 bg-indigo-50 text-indigo-700 rounded-lg flex flex-col items-center justify-center font-bold border border-indigo-100">
                                            <span className="text-[10px] uppercase">May</span>
                                            <span className="text-lg">12</span>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900">CSC 201: Data Structures</h4>
                                            <p className="text-xs text-slate-500 flex items-center gap-2">
                                                <Calendar size={12} /> 09:00 AM - 12:00 PM • Morning Session
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm">
                                        <div className="text-right">
                                            <span className="block font-bold text-slate-700">Hall E020</span>
                                            <span className="text-xs text-slate-400">Capacity: 80</span>
                                        </div>
                                        <div className="text-right border-l pl-4 border-slate-200">
                                            <span className="block font-bold text-slate-700">3 Invigilators</span>
                                            <span className="text-xs text-emerald-600 flex items-center justify-end gap-1">
                                                <ShieldCheck size={10} /> Assigned
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center bg-slate-50/30">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300 shadow-sm border border-slate-100">
                        <Users size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">Exam Schedule Pending</h3>
                    <p className="text-slate-500 max-w-sm mx-auto mt-2">
                        No active exam schedule found. Configure the engine and generate a new timetable.
                    </p>
                </div>
            )}
        </div>
    );
};

export default ExamTimetable;
