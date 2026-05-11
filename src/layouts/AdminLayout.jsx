import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import {
    LayoutDashboard,
    BookOpen,
    Building2,
    Users,
    LogOut,
    Menu,
    X,
    RefreshCw,
    UserSquare2,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';
import FcomBot from '../components/FcomBot';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

const AdminLayout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isPageLoading, setIsPageLoading] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    // Reset page loader on any navigation
    useEffect(() => {
        setIsPageLoading(true);
        const timer = setTimeout(() => setIsPageLoading(false), 600);
        return () => clearTimeout(timer);
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
        { name: 'Dashboard Overview', icon: LayoutDashboard, path: '/admin' },
        { name: 'Hall Management', icon: Building2, path: '/admin/classrooms' },
        { name: 'Lecturers', icon: Users, path: '/admin/lecturers' },
        { name: 'Course Management', icon: BookOpen, path: '/admin/courses' },
        { name: 'Coordinators', icon: UserSquare2, path: '/admin/coordinators' },
    ];

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden relative">
            {/* Mobile Backdrop */}
            {isSidebarOpen && (
                <div
                    className="absolute inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    "bg-gradient-to-b from-[#00008b] to-slate-900 border-r border-[#00008b]/20 text-white flex flex-col transition-all duration-300 z-50 h-full fixed md:relative shadow-2xl md:shadow-none",
                    isSidebarOpen ? "w-64 translate-x-0" : "-translate-x-full md:translate-x-0 md:w-20"
                )}
            >
                <div className="h-20 flex items-center justify-between px-4 mt-2 border-b border-white/10 mx-2">
                    {isSidebarOpen ? (
                        <div className="flex items-center gap-3">
                            <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain bg-white rounded-full p-1" />
                            <span className="font-bold text-lg tracking-wide">FacultyAide</span>
                        </div>
                    ) : (
                        <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain bg-white rounded-full p-1 mx-auto md:block hidden" />
                    )}
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className={`p-2 hover:bg-white/10 rounded-lg transition-colors ${isSidebarOpen ? 'ml-auto' : 'mx-auto'}`}
                    >
                        {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>

                <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === '/admin'}
                            onClick={() => window.innerWidth < 768 && setIsSidebarOpen(false)}
                            className={({ isActive }) => cn(
                                "flex items-center px-4 py-3.5 rounded-xl transition-all group",
                                isActive
                                    ? "bg-[#579044] text-white shadow-lg shadow-[#579044]/30 font-bold transform scale-[0.98]"
                                    : "text-blue-100 hover:bg-white/10 hover:text-white"
                            )}
                        >
                            <item.icon size={22} className={cn("shrink-0", isSidebarOpen ? "mr-4" : "mx-auto")} />
                            {isSidebarOpen && <span className="text-sm font-medium">{item.name}</span>}

                            {/* Tooltip for collapsed state (Desktop only) */}
                            {!isSidebarOpen && (
                                <div className="absolute left-16 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none whitespace-nowrap hidden md:block">
                                    {item.name}
                                </div>
                            )}
                        </NavLink>
                    ))}
                </nav>

                <div className="p-4 border-t border-white/10">
                    <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className={cn(
                            "flex items-center w-full rounded-lg px-3 py-2 text-blue-200 hover:text-white hover:bg-red-600/20 transition-colors disabled:opacity-50",
                            !isSidebarOpen && "justify-center"
                        )}
                    >
                        {isLoggingOut ? (
                            <RefreshCw size={20} className={cn("animate-spin", isSidebarOpen ? "mr-3" : "")} />
                        ) : (
                            <LogOut size={20} className={cn(isSidebarOpen ? "mr-3" : "")} />
                        )}
                        {isSidebarOpen && (isLoggingOut ? "Logging out..." : "Logout")}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto relative w-full flex flex-col">
                <header className="h-16 bg-white flex items-center justify-between px-4 sticky top-0 z-30 shrink-0">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 hover:bg-slate-100 rounded-lg text-slate-600 md:hidden">
                            <Menu size={24} />
                        </button>
                        <div>
                            {/* Mobile Title / Greeting */}
                            <h1 className="text-lg font-bold text-slate-800 md:hidden font-display italic">Admin</h1>
                            {/* Desktop Title */}
                            <h1 className="text-xl md:text-2xl font-bold text-slate-900 hidden md:block tracking-tight font-display">
                                Welcome back, <span className="text-[#00008b] italic">Admin</span> 👋
                            </h1>
                        </div>
                    </div>

                    {/* User Card - Visible on all screens */}
                    <div className="flex items-center">
                        <div className="bg-[#00008b]/5 border border-[#00008b]/10 rounded-xl px-4 py-2 flex flex-col items-center justify-center shadow-sm backdrop-blur-sm">
                            <span className="text-[10px] uppercase font-black text-[#579044] tracking-[0.2em] leading-none mb-1">Administrator</span>
                            <span className="text-xs font-black text-slate-900 leading-none">FA ADMIN</span>
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

                <div className="p-3 md:p-6">
                    <Outlet />
                </div>

                {/* Floating Fcom Bot */}
                <FcomBot />
            </main>
        </div>
    );
};

export default AdminLayout;
