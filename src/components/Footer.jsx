import React from 'react';

const Footer = () => {
    return (
        <footer className="bg-slate-900 text-slate-300 py-12 border-t border-slate-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-3">
                        <img src="/logo.png" alt="FacultyAide Logo" className="h-10 w-10 object-contain" />
                        <div>
                            <span className="block text-white font-bold text-lg tracking-wide">FacultyAide</span>
                            <span className="text-xs text-slate-400">Smart Classroom & Seat Allocation</span>
                        </div>
                    </div>

                    <div className="text-sm text-slate-500">
                        &copy; {new Date().getFullYear()} FacultyAide. All rights reserved.
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
