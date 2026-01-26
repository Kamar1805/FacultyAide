import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { QrCode, MapPin, CalendarClock, Printer, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import InstructionGuide from '../../components/InstructionGuide';

const StudentDashboard = () => {
    const navigate = useNavigate();
    // Mock exam time: 5 seconds from now for demo purposes
    const [revealTime] = useState(new Date(Date.now() + 5000));
    const [now, setNow] = useState(new Date());
    const [isRevealed, setIsRevealed] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => {
            const currentTime = new Date();
            setNow(currentTime);
            if (currentTime >= revealTime) {
                setIsRevealed(true);
                clearInterval(timer);
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [revealTime]);

    const timeLeft = revealTime - now;

    // Format Countdown
    const formatTime = (ms) => {
        if (ms <= 0) return "00:00:00";
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / 1000 / 60) % 60);
        const hours = Math.floor((ms / 1000 / 60 / 60));
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute top-20 left-6 z-40 w-80 hidden md:block">
                <InstructionGuide
                    title="Exam Tips"
                    steps={[
                        "Wait for the countdown to reveal your seat.",
                        "Your seat location is encrypted for fairness.",
                        "Once revealed, proceed to the venue immediately."
                    ]}
                />
            </div>

            <Button variant="ghost" className="absolute top-6 left-6" onClick={() => navigate('/')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>

            <div className="absolute top-4 right-4 md:top-6 md:right-6 flex items-center gap-3 z-30 pointer-events-none">
                <div className="flex items-center gap-2 bg-white/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 shadow-sm">
                    <img src="/logo.png" alt="Logo" className="w-8 h-8 md:w-12 md:h-12 object-contain" />
                    <span className="font-bold text-slate-900 tracking-tight text-sm md:text-lg">FacultyAide</span>
                </div>
            </div>

            {/* Background Decor */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-green-50 rounded-full blur-3xl opacity-50 translate-x-1/3 -translate-y-1/3"></div>
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-50 rounded-full blur-3xl opacity-50 -translate-x-1/3 translate-y-1/3"></div>
            </div>

            <div className="max-w-md w-full relative z-10">
                <div className="text-center mb-10">
                    <div className="inline-block px-3 py-1 bg-slate-100 rounded-full text-sm font-medium text-slate-600 mb-4">
                        <CalendarClock className="inline-block w-4 h-4 mr-2 mb-0.5" />
                        SEN203 • Introduction to Software Engineering
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900">Final Examination</h1>
                    <p className="text-slate-500 mt-2">Friday, Jan 19 • 10:00 AM</p>
                </div>

                <AnimatePresence mode="wait">
                    {!isRevealed ? (
                        <motion.div
                            key="countdown"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9, y: -20 }}
                            className="text-center"
                        >
                            <div className="relative w-64 h-64 mx-auto flex items-center justify-center mb-8">
                                {/* Animated Rings */}
                                <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-t-[#579044] rounded-full animate-spin [animation-duration:3s]"></div>

                                <div className="text-center">
                                    <p className="text-sm uppercase tracking-widest text-[#579044] mb-1 font-bold">Reveals In</p>
                                    <div className="text-5xl font-mono font-bold text-slate-800 tracking-tighter">
                                        {formatTime(timeLeft)}
                                    </div>
                                </div>
                            </div>
                            <p className="text-slate-500 text-sm max-w-xs mx-auto">
                                Seat details are encrypted and will decrypt automatically 45 minutes before the exam starts.
                            </p>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="ticket"
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ type: "spring", bounce: 0.5 }}
                        >
                            <Card className="border-t-8 border-t-[#579044] shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-[#579044]/10 rounded-bl-full -mr-4 -mt-4"></div>

                                <CardContent className="p-8 text-center space-y-6">
                                    <div>
                                        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Your Seat Assignment</h2>
                                        <div className="text-6xl font-bold text-[#00008b] mb-1">E125</div>
                                        <div className="text-xl font-medium text-slate-600">Row 3 • Seat 14</div>
                                    </div>

                                    <div className="bg-slate-50 p-6 rounded-lg border border-dashed border-slate-300 mx-auto w-fit">
                                        <QrCode className="h-32 w-32 text-slate-800" />
                                    </div>

                                    <div className="space-y-3">
                                        <Button className="w-full bg-[#579044] hover:bg-[#4a7a3a] h-12 text-lg">
                                            <MapPin className="mr-2" /> Open in Maps
                                        </Button>
                                        <Button variant="outline" className="w-full">
                                            <Printer className="mr-2 h-4 w-4" /> Print Exam Slip
                                        </Button>
                                    </div>

                                    <div className="pt-4 border-t flex items-center justify-center gap-2 text-sm text-green-600 font-medium">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                        Checked-in by Invigilator
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default StudentDashboard;
