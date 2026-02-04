import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Building2, Users, BookOpen, Activity, ArrowRight, ShieldCheck, School } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { collection, getCountFromServer } from 'firebase/firestore';
import { motion } from 'framer-motion';

const DashboardOverview = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        venues: 0,
        lecturers: 0,
        courses: 0
    });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const venuesSnap = await getCountFromServer(collection(db, 'venues'));
                const lecturersSnap = await getCountFromServer(collection(db, 'lecturers'));
                const coursesSnap = await getCountFromServer(collection(db, 'courses'));

                setStats({
                    venues: venuesSnap.data().count,
                    lecturers: lecturersSnap.data().count,
                    courses: coursesSnap.data().count
                });
            } catch (error) {
                console.error("Error fetching stats:", error);
            }
        };
        fetchStats();
    }, []);

    const QuickAction = ({ title, desc, icon: Icon, onClick, color }) => (
        <button
            onClick={onClick}
            className="group flex flex-col items-start p-6 bg-white border border-slate-200 rounded-xl hover:shadow-lg hover:border-indigo-100 transition-all text-left w-full relative overflow-hidden"
        >
            <div className={`p-3 rounded-lg ${color} mb-4 group-hover:scale-110 transition-transform`}>
                <Icon size={24} />
            </div>
            <h3 className="font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">{title}</h3>
            <p className="text-xs text-slate-500 mt-1">{desc}</p>
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300">
                <ArrowRight size={20} />
            </div>
        </button>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Hero Section */}
            <div className="relative overflow-hidden bg-slate-900 rounded-3xl p-8 md:p-12 text-white shadow-2xl">
                <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-indigo-500/20 to-transparent pointer-events-none" />
                <div className="relative z-10 max-w-2xl">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="px-3 py-1 bg-indigo-500 text-[10px] font-black uppercase tracking-widest rounded-full">Admin Control</span>
                        <div className="h-1 w-1 rounded-full bg-slate-500" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 leading-tight">
                        Command Center <br />
                        <span className="text-indigo-400">Institutional Infrastructure.</span>
                    </h1>
                    <p className="text-slate-400 font-medium text-sm md:text-base leading-relaxed">
                        Welcome back, Administrator. You have full oversight of Nile University's academic assets.
                        Configure halls, manage faculty staff, and oversee curriculum distribution across 6 active departments.
                    </p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: 'Academic Venues', value: stats.venues, icon: Building2, color: 'text-blue-500', bg: 'bg-blue-50' },
                    { label: 'Faculty Staff', value: stats.lecturers, icon: Users, color: 'text-indigo-500', bg: 'bg-indigo-50' },
                    { label: 'Active Courses', value: stats.courses, icon: BookOpen, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                ].map((stat, i) => (
                    <Card key={i} className="border-slate-200 shadow-sm hover:shadow-md transition-all group overflow-hidden">
                        <CardContent className="p-6 relative">
                            <div className={`absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 group-hover:opacity-10 transition-all ${stat.color}`}>
                                <stat.icon size={120} strokeWidth={1} />
                            </div>
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color}`}>
                                    <stat.icon size={24} />
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                                    <h3 className="text-3xl font-black text-slate-900 mt-1">{stat.value}</h3>
                                </div>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <motion.div
                                    className={`h-full ${stat.color.replace('text', 'bg')}`}
                                    initial={{ width: 0 }}
                                    animate={{ width: '70%' }}
                                    transition={{ duration: 1, delay: i * 0.2 }}
                                />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Critical Modules */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Management Modules</h2>
                    <Button variant="ghost" size="sm" className="text-xs font-bold text-indigo-600">View All Systems</Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <QuickAction
                        title="Hall Management"
                        desc="Configure rooms & capacities"
                        icon={Building2}
                        color="bg-blue-100 text-blue-700"
                        onClick={() => navigate('/admin/classrooms')}
                    />
                    <QuickAction
                        title="Lecturer Directory"
                        desc="Academic staff repository"
                        icon={Users}
                        color="bg-indigo-100 text-indigo-700"
                        onClick={() => navigate('/admin/lecturers')}
                    />
                    <QuickAction
                        title="Curriculum Mapping"
                        desc="Global course catalog"
                        icon={School}
                        color="bg-purple-100 text-purple-700"
                        onClick={() => navigate('/admin/courses')}
                    />
                    <QuickAction
                        title="Security Audit"
                        desc="System logs & permissions"
                        icon={ShieldCheck}
                        color="bg-slate-100 text-slate-700"
                        onClick={() => { }}
                    />
                </div>
            </div>

            {/* System Status Footer */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
                        <Activity size={24} />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900">System Infrastructure: <span className="text-emerald-600">Optimal</span></h4>
                        <p className="text-xs text-slate-500 font-medium">All database shards and AI models are operational.</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {['Auth', 'DB', 'Engine'].map(svc => (
                        <div key={svc} className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-slate-600">{svc}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default DashboardOverview;
