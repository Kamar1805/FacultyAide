import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Progress } from '../../components/ui/progress';
import { BookOpen, MapPin, AlertTriangle, Users } from 'lucide-react';
import InstructionGuide from '../../components/InstructionGuide';

const DashboardOverview = () => {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <InstructionGuide
                title="Admin Dashboard Guide"
                steps={[
                    "Monitor real-time system stats and capacity metrics.",
                    "Review recent alerts regarding capacity overflows or scheduling conflicts.",
                    "Quickly access key management tools from the summary cards."
                ]}
            />
            <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Overview</h2>
                <p className="text-slate-500">Here's what's happening in your department today.</p>
            </div>

            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {/* Courses stats */}
                <Card className="hover:shadow-lg transition-all duration-300 border-slate-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">Courses Scheduled</CardTitle>
                        <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                            <BookOpen className="h-4 w-4 text-primary" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900">127<span className="text-slate-400 text-lg font-normal">/150</span></div>
                        <p className="text-xs text-green-600 font-medium mt-1 inline-flex items-center gap-1">
                            ↑ 12 since last hour
                        </p>
                        <Progress value={84} className="h-1.5 mt-3 bg-blue-100" indicatorClassName="bg-primary" />
                    </CardContent>
                </Card>

                {/* Halls stats */}
                <Card className="hover:shadow-lg transition-all duration-300 border-slate-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">Available Halls</CardTitle>
                        <div className="h-8 w-8 rounded-lg bg-green-50 flex items-center justify-center">
                            <MapPin className="h-4 w-4 text-green-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900">18<span className="text-slate-400 text-lg font-normal">/22</span></div>
                        <p className="text-xs text-amber-600 font-medium mt-1">
                            4 under maintenance
                        </p>
                        <Progress value={81} className="h-1.5 mt-3 bg-green-100" indicatorClassName="bg-green-600" />
                    </CardContent>
                </Card>

                {/* Conflicts stats */}
                <Card className="hover:shadow-lg transition-all duration-300 border-slate-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">Conflicts </CardTitle>
                        <div className="h-8 w-8 rounded-lg bg-red-50 flex items-center justify-center">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900">0</div>
                        <p className="text-xs text-slate-500 mt-1">System healthy</p>
                    </CardContent>
                </Card>

                {/* Students stats */}
                <Card className="hover:shadow-lg transition-all duration-300 border-slate-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">Students</CardTitle>
                        <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                            <Users className="h-4 w-4 text-indigo-500" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900">2,847</div>
                        <p className="text-xs text-green-600 font-medium mt-1">
                            +180 new today
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 grid-cols-1 lg:grid-cols-7">
                <Card className="col-span-1 lg:col-span-4 hover:shadow-md transition-shadow duration-300 border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-lg">Recent Activity</CardTitle>
                        <CardDescription>Latest system commands and automated actions</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            {[1, 2, 3].map((_, i) => (
                                <div key={i} className="flex items-start group">
                                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mr-4 group-hover:bg-blue-50 transition-colors">
                                        <span className="text-xs font-bold text-slate-600 group-hover:text-blue-600">SYS</span>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-slate-900 leading-none">Timetable automatically generated for <span className="font-bold">CSC 300L</span></p>
                                        <p className="text-xs text-slate-500">2 minutes ago • Automated Strategy</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
                <Card className="col-span-1 lg:col-span-3 hover:shadow-md transition-shadow duration-300 border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-lg">Quick Actions</CardTitle>
                        <CardDescription>Common administrative tasks</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="p-4 border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 cursor-pointer flex justify-between items-center transition-all group">
                            <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">Generate Report</span>
                            <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500 group-hover:bg-white">PDF</span>
                        </div>
                        <div className="p-4 border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 cursor-pointer flex justify-between items-center transition-all group">
                            <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">Notify All Students</span>
                            <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500 group-hover:bg-white">Email</span>
                        </div>
                        <div className="p-4 border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 cursor-pointer flex justify-between items-center transition-all group">
                            <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">System Diagnostics</span>
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-medium">Run</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default DashboardOverview;
