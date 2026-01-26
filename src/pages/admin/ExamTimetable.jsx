import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Calendar as CalendarIcon, Filter, Search, MoreHorizontal, Clock, MapPin } from 'lucide-react';
import InstructionGuide from '../../components/InstructionGuide';

const exams = [
    { id: 1, code: 'CSC 301', title: 'Data Structures', date: 'Oct 14', time: '09:00 AM', venue: 'Hall E020', students: 120 },
    { id: 2, code: 'SEN 402', title: 'Software Testing', date: 'Oct 14', time: '02:00 PM', venue: 'Lab D1', students: 45 },
    { id: 3, code: 'MTH 201', title: 'Linear Algebra', date: 'Oct 15', time: '09:00 AM', venue: 'Hall A1', students: 300 },
    { id: 4, code: 'GNS 101', title: 'Use of English', date: 'Oct 16', time: '11:00 AM', venue: 'Multipurpose', students: 850 },
];

const ExamTimetable = () => {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <InstructionGuide
                title="Exam Scheduling"
                steps={[
                    "View the finalized exam timetable for the semester.",
                    "Use search to find specific exams by course code.",
                    "Filter exams by level or venue (feature coming soon)."
                ]}
            />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Exam Timetable</h2>
                    <p className="text-slate-500 text-sm">Manage examination schedules and invigilation.</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="outline" className="flex-1 sm:flex-none"><Filter className="mr-2 h-4 w-4" /> Filter</Button>
                    <Button className="bg-primary flex-1 sm:flex-none"><CalendarIcon className="mr-2 h-4 w-4" /> New Exam</Button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                <input
                    type="text"
                    placeholder="Search courses or venues..."
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
            </div>

            {/* List View (Mobile Optimized) */}
            <div className="grid gap-4">
                {exams.map((exam) => (
                    <Card key={exam.id} className="hover:shadow-md transition-shadow border-slate-200 group">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col items-center bg-blue-50 text-primary border border-blue-100 rounded-lg p-2 min-w-[3.5rem]">
                                    <span className="text-xs font-bold uppercase">{exam.date.split(' ')[0]}</span>
                                    <span className="text-xl font-bold">{exam.date.split(' ')[1]}</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900">{exam.code}</h3>
                                    <p className="text-sm text-slate-500 truncate max-w-[150px] sm:max-w-xs">{exam.title}</p>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                        <span className="flex items-center gap-1"><Clock size={12} /> {exam.time}</span>
                                        <span className="flex items-center gap-1"><MapPin size={12} /> {exam.venue}</span>
                                    </div>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600">
                                <MoreHorizontal className="h-5 w-5" />
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default ExamTimetable;
