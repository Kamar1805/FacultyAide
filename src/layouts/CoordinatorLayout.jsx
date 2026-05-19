import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Calendar, Settings, FileText, LogOut, LayoutGrid, Menu, X, BookOpen, RefreshCw, SlidersHorizontal, MessageSquare } from 'lucide-react';
import { Button } from '../components/ui/button';
import { auth, db } from '../firebase';
import { subscribeCoordinatorThreads } from '../services/timetableReviews';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import FcomBot from '../components/FcomBot';
import { initialsFromName } from '../utils/coordinatorProfile';

const CoordinatorLayout = () => {
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isPageLoading, setIsPageLoading] = useState(false);
    const [userData, setUserData] = useState({ name: 'Coordinator', department: 'General', role: 'Timetable Coordinator' });
    const [feedbackUnread, setFeedbackUnread] = useState(0);
    const location = useLocation();

    // Reset page loader on any navigation
    useEffect(() => {
        setIsPageLoading(true);
        const timer = setTimeout(() => setIsPageLoading(false), 500);
        return () => clearTimeout(timer);
    }, [location.pathname]);

    useEffect(() => {
        let unsubDoc = () => {};
        const unsubAuth = onAuthStateChanged(auth, (user) => {
            unsubDoc();
            unsubDoc = () => {};
            if (!user) {
                navigate('/');
                return;
            }
            const docRef = doc(db, 'users', user.uid);
            unsubDoc = onSnapshot(
                docRef,
                async (docSnap) => {
                    if (!docSnap.exists()) return;
                    const data = docSnap.data();
                    if (data.role === 'coordinator' && data.accessStatus === 'revoked') {
                        await signOut(auth);
                        navigate('/auth?reason=revoked');
                        return;
                    }
                    setUserData({ ...data, uid: user.uid });
                },
                (error) => console.error('User profile subscription:', error)
            );
        });
        return () => {
            unsubAuth();
            unsubDoc();
        };
    }, [navigate]);

    useEffect(() => {
        if (!userData?.uid) return undefined;
        const unsub = subscribeCoordinatorThreads(userData.uid, (list) => {
            setFeedbackUnread(list.filter((t) => t.pendingCoordinatorAttention).length);
        });
        return () => unsub && unsub();
    }, [userData?.uid]);

    useEffect(() => {
        const u = auth.currentUser;
        if (!u) return;
        const ref = doc(db, 'users', u.uid);
        updateDoc(ref, {
            lastActiveAt: new Date().toISOString(),
            lastVisitedPath: location.pathname,
        }).catch(() => {});
    }, [location.pathname]);

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
        { path: '/coordinator/constraints', icon: Settings, label: 'Dept constraints' },
        { path: '/coordinator/feedback', icon: MessageSquare, label: 'Admin feedback', badge: feedbackUnread },
        { path: '/coordinator/settings', icon: SlidersHorizontal, label: 'Profile & Settings' },
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
                    bg-gradient-to-b from-[#00008b] to-slate-900 border-r border-[#00008b]/20 text-white flex flex-col transition-all duration-300 z-50 h-full fixed lg:relative shadow-2xl lg:shadow-none
                    ${isSidebarOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-20'}
                `}
            >
                <div className="h-20 flex items-center justify-between px-4 mt-2 border-b border-white/10 mx-2">
                    {isSidebarOpen ? (
                        <div className="flex items-center gap-3">
                            <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain bg-white rounded-xl p-1 shadow-sm" />
                            <span className="font-bold text-lg tracking-wide whitespace-nowrap">FacultyAide</span>
                        </div>
                    ) : (
                        <div className="mx-auto flex lg:flex hidden"><img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain bg-white rounded-xl p-1 shadow-sm" /></div>
                    )}
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className={`p-2 hover:bg-white/10 rounded-lg transition-colors ${isSidebarOpen ? 'ml-auto' : 'mx-auto'}`}
                    >
                        {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>

                <div className="px-3 py-6">
                    {(isSidebarOpen || (typeof window !== 'undefined' && window.innerWidth < 1024)) && (
                        <div className="relative overflow-hidden rounded-2xl p-4 mb-6 border border-white/10 bg-gradient-to-br from-white/[0.14] to-white/[0.04] backdrop-blur-sm shadow-lg shadow-black/10">
                            <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[#579044]/25 blur-2xl pointer-events-none" />
                            <div className="absolute -left-6 bottom-0 h-16 w-16 rounded-full bg-indigo-400/20 blur-xl pointer-events-none" />
                            <div className="relative flex items-center gap-3">
                                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-100 to-white flex items-center justify-center text-[#00008b] font-black text-sm shadow-md ring-2 ring-white/30 shrink-0">
                                    {initialsFromName(userData.name)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-bold text-blue-100/90 uppercase tracking-[0.15em]">Signed in</p>
                                    <p className="font-black text-white leading-tight truncate text-[15px]">{userData.name || 'Coordinator'}</p>
                                    <p className="text-xs font-semibold text-blue-100/85 truncate">{userData.department || 'Department'}</p>
                                </div>
                            </div>
                            {isSidebarOpen && (userData.prefs?.phone || userData.prefs?.officeRoom) && (
                                <div className="relative mt-4 pt-3 border-t border-white/10 space-y-1.5 text-[11px] text-blue-50/95">
                                    {userData.prefs?.phone ? (
                                        <p className="flex items-center gap-2 truncate">
                                            <span className="text-blue-200/80 shrink-0">Phone</span>
                                            <span className="font-semibold truncate">{userData.prefs.phone}</span>
                                        </p>
                                    ) : null}
                                    {userData.prefs?.officeRoom ? (
                                        <p className="flex items-center gap-2 truncate">
                                            <span className="text-blue-200/80 shrink-0">Office</span>
                                            <span className="font-semibold truncate">{userData.prefs.officeRoom}</span>
                                        </p>
                                    ) : null}
                                </div>
                            )}
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
                                        ? "bg-[#579044] text-white shadow-lg shadow-[#579044]/30 font-bold transform scale-[0.98]"
                                        : "text-blue-100 hover:bg-white/10 hover:text-white"
                                    }
                                `}
                            >
                                <item.icon size={22} className={`${isSidebarOpen ? "mr-4" : ""} shrink-0`} />
                                {isSidebarOpen && (
                                    <span className="text-sm font-medium flex-1 flex items-center gap-2 min-w-0">
                                        {item.label}
                                        {item.badge > 0 && (
                                            <span className="ml-auto text-[10px] font-black bg-amber-300 text-amber-950 px-2 py-0.5 rounded-full shrink-0">
                                                {item.badge > 9 ? '9+' : item.badge}
                                            </span>
                                        )}
                                    </span>
                                )}
                                {!isSidebarOpen && item.badge > 0 && (
                                    <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-[#00008b]" aria-hidden />
                                )}

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
                            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight font-display">
                                Faculty<span className="text-[#00008b]">Aide</span>
                            </h1>
                            <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate max-w-[10rem] sm:max-w-xs">
                                {userData.name || 'Coordinator'}
                                {userData.prefs?.phone ? (
                                    <span className="text-slate-400"> · {userData.prefs.phone}</span>
                                ) : null}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="bg-[#00008b]/5 border border-[#00008b]/10 rounded-xl px-4 py-2 flex flex-col items-center justify-center shadow-sm backdrop-blur-sm hidden sm:flex">
                            <span className="text-[10px] uppercase font-black text-[#579044] tracking-[0.2em] leading-none mb-1">Coordinator</span>
                            <span className="text-xs font-black text-slate-900 leading-none uppercase">{userData.department}</span>
                        </div>
                        <div className="h-12 w-12 bg-gradient-to-br from-[#00008b] to-[#579044] rounded-xl flex items-center justify-center text-white text-sm font-black shadow-lg ring-2 ring-white shrink-0">
                            {initialsFromName(userData.name)}
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
