import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Building2, Users, BookOpen, Activity, ArrowRight, ShieldCheck, School, Calendar, Radio } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { collection, getCountFromServer, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { motion } from 'framer-motion';

function formatWhen(val) {
    if (val == null || val === '') return '—';
    if (typeof val?.toDate === 'function') {
        try {
            const d = val.toDate();
            return d?.toLocaleString?.() ?? '—';
        } catch {
            return '—';
        }
    }
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? String(val).slice(0, 24) : d.toLocaleString();
}

const DashboardOverview = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        venues: 0,
        lecturers: 0,
        courses: 0
    });
    const [publishedLectures, setPublishedLectures] = useState([]);
    const [publishedExams, setPublishedExams] = useState([]);
    const [activityRows, setActivityRows] = useState([]);
    const [coordinators, setCoordinators] = useState([]);
    const [feedLoading, setFeedLoading] = useState(true);

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

    useEffect(() => {
        let cancelled = false;
        const loadFeed = async () => {
            setFeedLoading(true);
            try {
                const lectureSnap = await getDocs(collection(db, 'saved_timetables'));
                const examSnap = await getDocs(collection(db, 'exam_timetables'));
                let logs = [];
                try {
                    const logsQ = query(collection(db, 'activity_logs'), orderBy('createdAt', 'desc'), limit(50));
                    const logSnap = await getDocs(logsQ);
                    logs = logSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
                } catch {
                    const logSnap = await getDocs(collection(db, 'activity_logs'));
                    logs = logSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 50);
                }
                const coordSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'coordinator')));

                const lect = lectureSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
                    .filter((t) => t.published === true)
                    .sort((a, b) => String(b.publishedAt || b.updatedAt || '').localeCompare(String(a.publishedAt || a.updatedAt || '')))
                    .slice(0, 15);

                const exams = examSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
                    .filter((t) => t.published === true || !!t.publishedAt)
                    .sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')))
                    .slice(0, 10);

                const coordList = coordSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
                    .sort((a, b) => String(b.lastActiveAt || '').localeCompare(String(a.lastActiveAt || '')));

                if (!cancelled) {
                    setPublishedLectures(lect);
                    setPublishedExams(exams);
                    setActivityRows(logs);
                    setCoordinators(coordList);
                }
            } catch (e) {
                console.error('Admin feed load:', e);
                if (!cancelled) {
                    setPublishedLectures([]);
                    setPublishedExams([]);
                    setActivityRows([]);
                }
            } finally {
                if (!cancelled) setFeedLoading(false);
            }
        };
        loadFeed();
        return () => { cancelled = true; };
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
            <div className="relative overflow-hidden bg-slate-900 rounded-3xl p-6 md:p-12 text-white shadow-2xl">
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
                        desc="Activity log & admin settings"
                        icon={ShieldCheck}
                        color="bg-slate-100 text-slate-700"
                        onClick={() => navigate('/admin/settings')}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card className="border-slate-200 shadow-sm overflow-hidden" id="admin-published-timetables">
                    <CardHeader className="bg-slate-50 border-b border-slate-100">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Calendar size={20} className="text-indigo-600" /> Recently published timetables
                        </CardTitle>
                        <CardDescription>Live lecture &amp; exam releases from coordinators (requires `published` flags).</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 max-h-[340px] overflow-y-auto">
                        {feedLoading ? (
                            <div className="p-8 text-center text-slate-400 font-bold text-sm">Loading catalogue…</div>
                        ) : (
                            <table className="w-full text-left text-sm">
                                <thead className="bg-white border-b sticky top-0 z-10">
                                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        <th className="px-4 py-3">Type</th>
                                        <th className="px-4 py-3">Dept / title</th>
                                        <th className="px-4 py-3">Coordinator</th>
                                        <th className="px-4 py-3">When</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {[
                                        ...publishedLectures.map((t) => ({
                                            kind: 'Lecture',
                                            title: t.name || 'Untitled',
                                            dept: t.department,
                                            who: t.coordinatorName || '—',
                                            when: t.publishedAt || t.updatedAt || t.createdAt,
                                        })),
                                        ...publishedExams.map((t) => ({
                                            kind: 'Exam',
                                            title: t.name || 'Exam timetable',
                                            dept: t.department,
                                            who: t.coordinatorName || '—',
                                            when: t.publishedAt || t.createdAt?.toDate?.()?.toISOString?.() || t.createdAt,
                                        })),
                                    ]
                                        .sort((a, b) => String(b.when || '').localeCompare(String(a.when || '')))
                                        .slice(0, 16)
                                        .map((row, i) => (
                                            <tr key={`${row.kind}-${i}`} className="hover:bg-slate-50/80">
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${row.kind === 'Exam' ? 'bg-violet-100 text-violet-800' : 'bg-emerald-100 text-emerald-900'}`}>{row.kind}</span>
                                                </td>
                                                <td className="px-4 py-3 font-bold text-slate-800">{row.title}</td>
                                                <td className="px-4 py-3 text-slate-600 text-xs">{row.dept}<div className="text-[11px] text-slate-400 font-medium">{row.who}</div></td>
                                                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatWhen(row.when)}</td>
                                            </tr>
                                        ))}
                                    {publishedLectures.length === 0 && publishedExams.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-10 text-center text-slate-400 text-sm">No publications yet — coordinators publish from lecture or exam workspaces.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm overflow-hidden" id="admin-activity-feed">
                    <CardHeader className="bg-slate-50 border-b border-slate-100">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Radio size={20} className="text-amber-500" /> Coordinator activity
                        </CardTitle>
                        <CardDescription>Latest actions across publishing, saves, and profile updates.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 max-h-[340px] overflow-y-auto">
                        {feedLoading ? (
                            <div className="p-8 text-center text-slate-400 font-bold text-sm">Hydrating audits…</div>
                        ) : (
                            <table className="w-full text-left text-sm">
                                <thead className="bg-white border-b sticky top-0">
                                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        <th className="px-4 py-3">User</th>
                                        <th className="px-4 py-3">Action</th>
                                        <th className="px-4 py-3">Detail</th>
                                        <th className="px-4 py-3">Time</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {activityRows.map((row) => (
                                        <tr key={row.id} className="hover:bg-slate-50/80">
                                            <td className="px-4 py-3 font-bold text-slate-800 text-xs">{row.userName || '—'}<div className="text-[10px] text-slate-400">{row.userRole}</div></td>
                                            <td className="px-4 py-3 text-[11px] font-black uppercase text-indigo-600">{String(row.action || '').replace(/_/g, ' ')}</td>
                                            <td className="px-4 py-3 text-xs text-slate-500">{row.meta?.name || row.meta?.semester || row.department || '—'}</td>
                                            <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatWhen(row.createdAt)}</td>
                                        </tr>
                                    ))}
                                    {!activityRows.length && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-10 text-center text-slate-400 text-sm">No telemetry yet — interactions log after coordinators perform actions.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50 border-b border-slate-100">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Users size={20} className="text-sky-600" /> Coordinators pulse
                    </CardTitle>
                    <CardDescription>Last routed path &amp; ping from synced sessions.</CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[600px]">
                        <thead>
                            <tr className="text-[10px] font-black uppercase text-slate-400 border-b">
                                <th className="px-4 py-3">Coordinator</th>
                                <th className="px-4 py-3">Dept</th>
                                <th className="px-4 py-3">Email</th>
                                <th className="px-4 py-3">Last active</th>
                                <th className="px-4 py-3">Last route</th>
                                <th className="px-4 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {coordinators.map((c) => (
                                <tr key={c.id || c.uid} className="hover:bg-slate-50/70">
                                    <td className="px-4 py-3 font-bold text-slate-800">{c.name}</td>
                                    <td className="px-4 py-3 text-xs text-slate-600">{c.department}</td>
                                    <td className="px-4 py-3 text-xs text-slate-500">{c.email}</td>
                                    <td className="px-4 py-3 text-xs">{formatWhen(c.lastActiveAt)}</td>
                                    <td className="px-4 py-3 text-xs font-mono text-slate-500">{c.lastVisitedPath || '—'}</td>
                                    <td className="px-4 py-3"><span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${c.accessStatus === 'revoked' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-900'}`}>{c.accessStatus || 'active'}</span></td>
                                </tr>
                            ))}
                            {!coordinators.length && (
                                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">No coordinators on file.</td></tr>
                            )}
                        </tbody>
                    </table>
                </CardContent>
            </Card>

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
