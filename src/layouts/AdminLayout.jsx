import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    CalendarDays,
    BookOpen,
    Building2,
    Users,
    Settings,
    LogOut,
    Menu,
    X
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

const AdminLayout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const navigate = useNavigate();

    const handleLogout = () => {
        navigate('/');
    };

    const navItems = [
        { name: 'Dashboard Overview', icon: LayoutDashboard, path: '/admin' },
        { name: 'Hall Management', icon: Building2, path: '/admin/classrooms' },
        { name: 'Lecturers', icon: Users, path: '/admin/lecturers' },
        { name: 'Course Management', icon: BookOpen, path: '/admin/courses' },
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
                    "bg-primary text-white flex flex-col transition-all duration-300 z-50 h-full fixed md:relative shadow-2xl md:shadow-none",
                    isSidebarOpen ? "w-64 translate-x-0" : "-translate-x-full md:translate-x-0 md:w-20"
                )}
            >
                <div className="h-20 flex items-center justify-between px-4 mt-2 border-b border-white/10 mx-2">
                    {(isSidebarOpen || window.innerWidth < 768) && (
                        <div className="flex items-center gap-3">
                            <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain bg-white rounded-full p-1" />
                            <span className="font-bold text-lg tracking-wide">FacultyAide</span>
                        </div>
                    )}
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-2 hover:bg-white/10 rounded-lg ml-auto md:block hidden"
                    >
                        {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="p-2 hover:bg-white/10 rounded-lg ml-auto md:hidden"
                    >
                        <X size={24} />
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
                                    ? "bg-white text-primary shadow-lg font-bold transform scale-[0.98]"
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
                        className={cn(
                            "flex items-center w-full rounded-lg px-3 py-2 text-blue-200 hover:text-white hover:bg-red-600/20 transition-colors",
                            !isSidebarOpen && "justify-center"
                        )}
                    >
                        <LogOut size={20} className={cn(isSidebarOpen ? "mr-3" : "")} />
                        {isSidebarOpen && "Logout"}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto relative w-full flex flex-col">
                <header className="h-16 bg-white border-b flex items-center justify-between px-4 sticky top-0 z-30 shadow-sm shrink-0">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 hover:bg-slate-100 rounded-lg text-slate-600 md:hidden">
                            <Menu size={24} />
                        </button>
                        <div>
                            {/* Mobile Title / Greeting */}
                            <h1 className="text-lg font-bold text-slate-800 md:hidden">Good Day! 👋</h1>
                            {/* Desktop Title */}
                            <h1 className="text-xl md:text-2xl font-bold text-slate-800 hidden md:block truncate">Department Administration</h1>
                        </div>
                    </div>

                    {/* User Card - Visible on all screens */}
                    <div className="flex items-center">
                        <div className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 flex flex-col items-center justify-center min-w-[3.5rem]">
                            <span className="text-xs font-bold text-slate-800 leading-none mb-0.5">SEN</span>
                            <span className="text-[10px] uppercase font-bold text-primary tracking-wider leading-none">Admin</span>
                        </div>
                    </div>
                </header>

                <div className="p-6">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;
