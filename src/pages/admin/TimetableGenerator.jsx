import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Save, Sparkles, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import InstructionGuide from '../../components/InstructionGuide';

const TimetableGenerator = () => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [generated, setGenerated] = useState(false);
    const [constraints, setConstraints] = useState({
        level: '200',
        semester: 'Alpha',
        avoidFridayPrayer: true,
        maxDailyHours: 6,
    });

    const [events, setEvents] = useState([]);

    const handleGenerate = () => {
        setIsGenerating(true);
        // Simulate Algo
        setTimeout(() => {
            setIsGenerating(false);
            setGenerated(true);
            setEvents([
                { id: 1, title: 'CSC 201 (Lecture)', day: 'Mon', time: '9', color: 'bg-blue-100 text-blue-700 border-blue-200' },
                { id: 2, title: 'MTH 201 (Tut)', day: 'Mon', time: '12', color: 'bg-green-100 text-green-700 border-green-200' },
                { id: 3, title: 'GNS 202', day: 'Tue', time: '10', color: 'bg-amber-100 text-amber-700 border-amber-200' },
                { id: 4, title: 'SEN 204', day: 'Wed', time: '9', color: 'bg-purple-100 text-purple-700 border-purple-200' },
                { id: 5, title: 'CSC 202 (Lab)', day: 'Thu', time: '2', color: 'bg-red-100 text-red-700 border-red-200' },
            ]);
        }, 2000);
    };

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col relative animate-in fade-in duration-500">
            <InstructionGuide
                title="Automated Timetable Generator"
                steps={[
                    "Select the academic Level and Semester you want to schedule.",
                    "Apply constraints like 'Avoid Friday Prayer' to guide the algorithm.",
                    "Click 'Generate Timetable' to let the AI create an optimal schedule.",
                    "Review the generated grid below. You can regenerate if needed."
                ]}
            />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Timetable Creator</h2>
                    <p className="text-slate-500 text-sm">AI-powered scheduling system.</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    {generated && <Button variant="outline" onClick={() => setGenerated(false)}><RefreshCw className="mr-2 h-4 w-4" /> Reset</Button>}
                    <Button className="bg-primary flex-1 sm:flex-none shadow-lg shadow-blue-900/20" disabled={!generated}><Save className="mr-2 h-4 w-4" /> Publish to Students</Button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 h-full overflow-hidden">
                {/* Configuration Panel */}
                <Card className="w-full lg:w-80 flex flex-col border-slate-200 shadow-lg h-auto lg:h-full overflow-y-auto shrink-0">
                    <CardHeader className="py-4 bg-slate-50 border-b border-slate-100">
                        <CardTitle className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                            <Sparkles size={16} /> Configuration
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-6">
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-slate-700">Academic Level</label>
                            <select
                                className="flex h-10 w-full rounded-md border border-slate-200 bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary"
                                value={constraints.level}
                                onChange={(e) => setConstraints({ ...constraints, level: e.target.value })}
                            >
                                <option value="100">100 Level</option>
                                <option value="200">200 Level</option>
                                <option value="300">300 Level</option>
                                <option value="400">400 Level</option>
                            </select>
                        </div>

                        <div className="space-y-3">
                            <label className="text-sm font-medium text-slate-700">Semester</label>
                            <select
                                className="flex h-10 w-full rounded-md border border-slate-200 bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary"
                                value={constraints.semester}
                                onChange={(e) => setConstraints({ ...constraints, semester: e.target.value })}
                            >
                                <option value="Alpha">Alpha (1st)</option>
                                <option value="Omega">Omega (2nd)</option>
                            </select>
                        </div>

                        <div className="space-y-3">
                            <label className="text-sm font-medium text-slate-700">Daily Constraints</label>
                            <div className="flex items-center gap-2 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer" onClick={() => setConstraints({ ...constraints, avoidFridayPrayer: !constraints.avoidFridayPrayer })}>
                                <div className={cn("w-4 h-4 rounded border flex items-center justify-center transition-colors", constraints.avoidFridayPrayer ? "bg-primary border-primary" : "border-slate-300")}>
                                    {constraints.avoidFridayPrayer && <CheckCircle2 size={10} className="text-white" />}
                                </div>
                                <span className="text-sm text-slate-600">Avoid Friday 1PM-2PM</span>
                            </div>
                        </div>

                        <Button
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white shadow-lg h-12 text-sm font-bold"
                            onClick={handleGenerate}
                            disabled={isGenerating}
                        >
                            {isGenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Optimizing...</> : <><Sparkles className="mr-2 h-4 w-4" /> Generate Timetable</>}
                        </Button>
                    </CardContent>
                </Card>

                {/* Grid Output */}
                <Card className="flex-1 bg-white border-slate-200 shadow-lg overflow-hidden flex flex-col relative h-[500px] lg:h-full">
                    {!generated ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                <Sparkles size={32} className="text-slate-300" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-700">Ready to Schedule</h3>
                            <p className="max-w-xs mx-auto text-sm mt-2">Configure the parameters on the left and click Generate to create an optimized timetable.</p>
                        </div>
                    ) : (
                        <div className="absolute inset-0 overflow-auto">
                            <div className="min-w-[800px] h-full">
                                {/* Sticky Header */}
                                <div className="grid grid-cols-6 sticky top-0 z-10 bg-white border-b shadow-sm">
                                    <div className="col-span-1 p-4 bg-slate-50 border-r border-slate-100"></div>
                                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(d => (
                                        <div key={d} className="font-bold text-center text-slate-700 uppercase text-xs tracking-widest py-4 bg-slate-50 border-r border-slate-100 last:border-0">{d}</div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-6">
                                    {/* Times slots */}
                                    {['9AM', '10AM', '11AM', '12PM', '1PM', '2PM', '3PM', '4PM'].map(time => {
                                        // Simple normalization for mapped Events (e.g. 9AM matches "9")
                                        const standardTime = time.replace('AM', '').replace('PM', '');

                                        return (
                                            <React.Fragment key={time}>
                                                <div className="text-xs text-slate-400 font-bold text-right pr-4 pt-4 border-r border-b border-slate-100 h-28 bg-slate-50/30 sticky left-0">{time}</div>
                                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => (
                                                    <div
                                                        key={`${day}-${time}`}
                                                        className="border-b border-r border-slate-100 bg-white h-28 relative p-1.5"
                                                    >
                                                        {/* Render Mock Events */}
                                                        {events.filter(e => e.day === day && e.time === standardTime).map(ev => (
                                                            <div key={ev.id} className={cn("text-[10px] p-2 rounded-md border shadow-sm font-semibold h-full flex flex-col justify-center", ev.color)}>
                                                                <span className="truncate">{ev.title}</span>
                                                                <span className="opacity-75 text-[8px] mt-1">E125</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ))}
                                            </React.Fragment>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};

export default TimetableGenerator;
