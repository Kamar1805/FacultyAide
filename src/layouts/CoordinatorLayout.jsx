import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Calendar, Settings, FileText, LogOut, LayoutGrid, Menu, X, User, BookOpen } from 'lucide-react';
import { Button } from '../components/ui/button';
import { auth, db } from '../firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const CoordinatorLayout = () => {
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [userData, setUserData] = useState({ name: 'Coordinator', department: 'General', role: 'Timetable Coordinator' });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const docRef = doc(db, 'users', user.uid);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        setUserData(docSnap.data());
                    }
                } catch (error) {
                    console.error("Error fetching user data:", error);
                }
            } else {
                navigate('/');
            }
        });
        return () => unsubscribe();
    }, [navigate]);

    const handleLogout = async () => {
        await signOut(auth);
        navigate('/');
    };

    const navItems = [
        { path: '/coordinator', icon: LayoutGrid, label: 'Dashboard' },
        { path: '/coordinator/courses', icon: BookOpen, label: 'Courses' },
        { path: '/coordinator/lecture-timetable', icon: Calendar, label: 'Lecture Timetable' },
        { path: '/coordinator/exam-timetable', icon: FileText, label: 'Exam Timetable' },
        { path: '/coordinator/constraints', icon: Settings, label: 'Constraints' },
    ];

    return (
        <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 shadow-xl lg:shadow-none transition-transform duration-300 ease-in-out
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100">
                    <div className="flex items-center gap-2 font-bold text-xl text-slate-900">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">FA</div>
                        <span>FacultyAide</span>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-500">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-4">
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6">
                        <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">Your Role</p>
                        <p className="font-bold text-indigo-900 leading-tight">{userData.role.replace('Coordinator', '')} Coordinator</p>
                    </div>

                    <nav className="space-y-1">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                end={item.path === '/coordinator'}
                                onClick={() => setIsSidebarOpen(false)}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 group ${isActive
                                        ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20 translate-x-1'
                                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                                    }`
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <item.icon size={20} className={isActive ? "text-indigo-400" : "text-slate-400 group-hover:text-indigo-600"} />
                                        {item.label}
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </nav>
                </div>

                <div className="mt-auto p-4 border-t border-slate-100">
                    <Button
                        variant="ghost"
                        className="w-full justify-start text-slate-500 hover:text-red-600 hover:bg-red-50 font-bold"
                        onClick={handleLogout}
                    >
                        <LogOut size={18} className="mr-3" />
                        Sign Out
                    </Button>
                </div>
            </aside>

            {/* Main Content Wrapper */}
            <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
                {/* Header */}
                <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-8 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                            <Menu size={24} />
                        </button>
                        <h1 className="text-lg font-bold text-slate-900 hidden sm:block">FacultyAide Analysis Dashboard</h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-bold text-slate-900">{userData.name || 'Coordinator'}</p>
                            <p className="text-xs font-medium text-slate-500">{userData.department} Dept.</p>
                        </div>
                        <div className="h-10 w-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold shadow-md ring-2 ring-white">
                            {userData.name ? userData.name.charAt(0) : 'C'}
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 p-4 sm:p-8 overflow-x-hidden">
                    <div className="max-w-6xl mx-auto animate-in fade-in duration-500">
                        <Outlet context={{ userData }} />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default CoordinatorLayout;
