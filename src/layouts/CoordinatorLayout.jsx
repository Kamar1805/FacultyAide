import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Calendar, Settings, FileText, LogOut, LayoutGrid, Menu, X, User, BookOpen, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { auth, db } from '../firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import FcomBot from '../components/FcomBot';

const CoordinatorLayout = () => {
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isPageLoading, setIsPageLoading] = useState(false);
    const [userData, setUserData] = useState({ name: 'Coordinator', department: 'General', role: 'Timetable Coordinator' });
    const location = useLocation();

    // Reset page loader on any navigation
    useEffect(() => {
        setIsPageLoading(true);
        const timer = setTimeout(() => setIsPageLoading(false), 500);
        return () => clearTimeout(timer);
    }, [location.pathname]);

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
        setIsLoggingOut(true);
        try {
            await signOut(auth);
            navigate('/');
        } catch (error) {
            console.error("Logout error:", error);
            setIsLoggingOut(false);
        }
    };

    const navItems = [
        { path: '/coordinator', icon: LayoutGrid, label: 'Dashboard' },
        { path: '/coordinator/courses', icon: BookOpen, label: 'Courses' },
        { path: '/coordinator/lecture-timetable', icon: Calendar, label: 'Lecture Timetable' },
        { path: '/coordinator/exam-timetable', icon: FileText, label: 'Exam Timetable' },
        { path: '/coordinator/constraints', icon: Settings, label: 'Constraints' },
    ];

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden relative font-sans">
            {/* Mobile Backdrop */}
            {isSidebarOpen && (
                <div
                    className="absolute inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
                    bg-primary text-white flex flex-col transition-all duration-300 z-50 h-full fixed lg:relative shadow-2xl lg:shadow-none
                    ${isSidebarOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-20'}
                `}
            >
                <div className="h-20 flex items-center justify-between px-4 mt-2 border-b border-white/10 mx-2">
                    {isSidebarOpen ? (
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-primary font-bold shadow-sm">FA</div>
                            <span className="font-bold text-lg tracking-wide whitespace-nowrap">FacultyAide</span>
                        </div>
                    ) : (
                        <div className="mx-auto w-8 h-8 bg-white rounded-lg flex items-center justify-center text-primary font-bold shadow-sm lg:flex hidden">FA</div>
                    )}
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className={`p-2 hover:bg-white/10 rounded-lg transition-colors ${isSidebarOpen ? 'ml-auto' : 'mx-auto'}`}
                    >
                        {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>

                <div className="px-3 py-6">
                    {(isSidebarOpen || window.innerWidth < 1024) && (
                        <div className="bg-white/10 rounded-xl p-4 mb-6 border border-white/5">
                            <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest mb-1">Coordinator Role</p>
                            <p className="font-bold text-white leading-tight truncate">{userData.department}</p>
                        </div>
                    )}

                    <nav className="space-y-2">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                end={item.path === '/coordinator'}
                                onClick={() => window.innerWidth < 1024 && setIsSidebarOpen(false)}
                                className={({ isActive }) => `
                                    flex items-center rounded-xl transition-all group relative
                                    ${isSidebarOpen ? 'px-4 py-3.5' : 'p-3.5 justify-center'}
                                    ${isActive
                                        ? "bg-white text-primary shadow-lg font-bold transform scale-[0.98]"
                                        : "text-blue-100 hover:bg-white/10 hover:text-white"
                                    }
                                `}
                            >
                                <item.icon size={22} className={`${isSidebarOpen ? "mr-4" : ""} shrink-0`} />
                                {isSidebarOpen && <span className="text-sm font-medium">{item.label}</span>}

                                {!isSidebarOpen && (
                                    <div className="absolute left-16 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none whitespace-nowrap hidden lg:block">
                                        {item.label}
                                    </div>
                                )}
                            </NavLink>
                        ))}
                    </nav>
                </div>

                <div className="mt-auto p-4 border-t border-white/10">
                    <button
                        onClick={handleLogout}
                        className={`
                            flex items-center w-full rounded-lg px-3 py-2 text-blue-200 hover:text-white hover:bg-red-600/20 transition-colors
                            ${!isSidebarOpen && 'justify-center'}
                            ${isLoggingOut && 'opacity-50 pointer-events-none'}
                        `}
                        disabled={isLoggingOut}
                    >
                        {isLoggingOut ? (
                            <RefreshCw size={20} className={`animate-spin ${isSidebarOpen ? "mr-3" : ""}`} />
                        ) : (
                            <LogOut size={20} className={isSidebarOpen ? "mr-3" : ""} />
                        )}
                        {isSidebarOpen && <span className="font-bold">{isLoggingOut ? 'Logging out...' : 'Logout'}</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content Wrapper */}
            <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
                {/* Header */}
                <header className="h-16 bg-white sticky top-0 z-30 px-4 sm:px-8 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                            <Menu size={24} />
                        </button>
                        <div>
                            <h1 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight font-display">
                                Welcome, <span className="text-primary italic">{userData.name || 'Coordinator'}</span> 👋
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="bg-primary/5 border border-primary/10 rounded-xl px-4 py-2 flex flex-col items-center justify-center shadow-sm backdrop-blur-sm hidden sm:flex">
                            <span className="text-[10px] uppercase font-black text-primary tracking-[0.2em] leading-none mb-1">Coordinator</span>
                            <span className="text-xs font-black text-slate-900 leading-none uppercase">{userData.department}</span>
                        </div>
                        <div className="h-12 w-12 bg-gradient-to-br from-primary to-indigo-600 rounded-xl flex items-center justify-center text-white font-black shadow-lg ring-2 ring-white shrink-0">
                            {userData.name ? userData.name.charAt(0) : 'C'}
                        </div>
                    </div>
                </header>

                {/* Global Navigation Loader */}
                {isPageLoading && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-[2px]">
                        <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-2xl shadow-xl border border-slate-100">
                            <RefreshCw size={32} className="animate-spin text-primary" />
                            <span className="text-sm font-bold text-slate-600 animate-pulse">Switching sections...</span>
                        </div>
                    </div>
                )}

                {/* Page Content */}
                <main className="flex-1 p-3 sm:p-6 md:p-8 overflow-y-auto bg-slate-50/50">
                    <div className="max-w-7xl mx-auto animate-in fade-in duration-500 pb-20">
                        <Outlet context={{ userData }} />
                    </div>
                </main>

                {/* Floating Fcom Bot */}
                <FcomBot />
            </div>
        </div>
    );
};

export default CoordinatorLayout;
