import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { User, Shield, Lock, Mail, CreditCard, School, ArrowRight, Loader2, AlertCircle, Zap, CheckCircle2, Users, LayoutDashboard, Globe, Bot, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const LandingPage = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Auth States
    const [mode, setMode] = useState('login'); // 'login' or 'signup'
    const [role, setRole] = useState('student'); // 'student', 'invigilator', 'admin'
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Form States
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: '',
        idNumber: '', // Matric/Staff Key
        department: 'Software Engineering',
        level: '100',
    });

    useEffect(() => {
        // Parse Role from URL query if present (optional fallback)
        const searchParams = new URLSearchParams(location.search);
        const roleParam = searchParams.get('role');
        if (roleParam && ['student', 'invigilator', 'admin'].includes(roleParam)) {
            setRole(roleParam);
            setError(null);
        }
    }, [location]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setError(null);
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
            const user = userCredential.user;

            // Fetch User Data from Firestore to verify role
            const docRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const userData = docSnap.data();
                const userRole = userData.role;

                if (userRole === 'admin') navigate('/admin');
                else if (userRole === 'invigilator') navigate('/invigilator');
                else if (userRole === 'student') navigate('/student');
                else setError("Unknown user role.");
            } else {
                setError("User profile not found in database.");
            }
        } catch (err) {
            console.error("Login Error:", err);
            setError("Invalid email or password.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        // Security Check
        if (role === 'admin' && formData.idNumber !== 'ADMIN2026') return setError("Invalid Admin Staff Key.");
        if (role === 'invigilator' && formData.idNumber !== 'INVIGILATOR2026') return setError("Invalid Invigilator Staff Key.");

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            const user = userCredential.user;

            const userData = {
                uid: user.uid,
                email: formData.email,
                name: formData.name,
                role: role,
                department: formData.department,
                createdAt: new Date().toISOString()
            };

            if (role === 'student') {
                userData.idNumber = formData.idNumber;
                userData.level = formData.level;
            } else {
                userData.staffId = formData.idNumber;
            }

            await setDoc(doc(db, 'users', user.uid), userData);

            if (role === 'admin') navigate('/admin');
            else if (role === 'invigilator') navigate('/invigilator');
            else navigate('/student');

        } catch (err) {
            console.error("Signup Error:", err);
            setError(err.message.replace('Firebase:', '').trim());
        } finally {
            setIsLoading(false);
        }
    };

    // Generic display for Login
    const currentTheme = mode === 'login' ? 'bg-[#00008b]' :
        role === 'invigilator' ? 'bg-green-600' :
            role === 'admin' ? 'bg-slate-900' : 'bg-[#00008b]';

    const currentTextTheme = mode === 'login' ? 'text-blue-600' :
        role === 'invigilator' ? 'text-green-600' :
            role === 'admin' ? 'text-slate-900' : 'text-blue-600';

    return (
        <div className="min-h-screen flex flex-col lg:flex-row font-sans overflow-x-hidden">

            {/* LEFT SIDE: Brand & Info (Dark Gradient) */}
            <div className="lg:w-[45%] xl:w-[40%] bg-gradient-to-br from-[#00004b] via-[#00008b] to-[#1e3a8a] text-white p-8 lg:p-12 relative overflow-hidden flex flex-col justify-between min-h-[400px] lg:min-h-screen">

                {/* Decorative Background Elements */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-500/20 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/3 pointer-events-none"></div>

                {/* Header / Logo Area */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="relative z-10 flex justify-between items-center"
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md border border-white/10">
                            <img src="/logo.png" alt="Logo" className="w-8 h-8 md:w-10 md:h-10 object-contain brightness-0 invert" />
                        </div>
                        <span className="text-xl md:text-2xl font-bold tracking-tight text-white">FacultyAide</span>
                    </div>

                    {/* Mobile Only 'Get Started' Button */}
                    <Button
                        onClick={() => document.getElementById('auth-card')?.scrollIntoView({ behavior: 'smooth' })}
                        className="lg:hidden bg-white text-blue-900 hover:bg-blue-50 font-semibold text-xs px-4 h-9 rounded-full shadow-lg"
                    >
                        Get Started
                    </Button>
                </motion.div>

                {/* Main Content */}
                <div className="relative z-10 flex-1 flex flex-col justify-center py-12 lg:py-0">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2, duration: 0.8 }}
                    >
                        <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold leading-tight mb-4 md:mb-6 text-white/95">
                            Automating <br />
                            <span className="text-[#89CFF0]">Academic Operations.</span>
                        </h1>
                        <p className="text-base md:text-lg text-blue-100/90 mb-8 md:mb-10 max-w-md leading-relaxed">
                            From <strong>timetable generation</strong> to <strong>smart seating arrangements</strong>. Experience automated classroom allocation and instant AI assistance.
                        </p>

                        <div className="space-y-3 md:space-y-4">
                            {[
                                { icon: Calendar, title: "Timetable & Scheduling", desc: "Auto-generate lecture & exam schedules." },
                                { icon: LayoutDashboard, title: "Smart Allocation", desc: "Classroom assignment & seating plans." },
                                { icon: Bot, title: "AI Assistant", desc: "Instant query support for staff & students." }
                            ].map((item, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.4 + (idx * 0.1) }}
                                    className="flex items-center gap-4 p-3 md:p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors backdrop-blur-sm"
                                >
                                    <div className="bg-blue-500/20 p-2 md:p-2.5 rounded-lg text-blue-200">
                                        <item.icon size={18} className="md:w-5 md:h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-white/95 text-xs md:text-sm">{item.title}</h3>
                                        <p className="text-[10px] md:text-xs text-blue-200/70">{item.desc}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </div>

                {/* Footer Info */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="relative z-10 text-sm font-medium text-blue-100/90 w-full text-center"
                >
                    <p>© 2025 FacultyAide. </p>
                    <p>Designed for Nile University, Faculty of Computing.</p>
                </motion.div>
            </div>

            <div id="auth-card" className="flex-1 flex flex-col justify-center items-center p-4 md:p-6 lg:p-12 xl:p-24 relative bg-slate-50">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="w-full max-w-lg lg:max-w-2xl space-y-5 sm:space-y-8 bg-white p-5 sm:p-14 rounded-2xl sm:rounded-3xl lg:rounded-[2.5rem] shadow-xl md:shadow-2xl shadow-indigo-900/10 border border-slate-100"
                >
                    <div className="text-center">
                        <h2 className="text-2xl md:text-4xl font-extrabold text-slate-900 mb-2 md:mb-3 tracking-tight">
                            {mode === 'login' ? 'Welcome Back' : 'Get Started'}
                        </h2>
                        <p className="text-slate-500 text-xs md:text-lg font-medium">
                            {mode === 'login'
                                ? 'Sign in to access your secure dashboard.'
                                : `Joining as a ${role}. Fill in your details below.`}
                        </p>
                    </div>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="bg-red-50 text-red-600 text-xs md:text-sm p-3 md:p-4 rounded-xl flex items-center gap-3 border border-red-100"
                        >
                            <AlertCircle size={16} className="shrink-0" />
                            <span>{error}</span>
                        </motion.div>
                    )}

                    <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="space-y-4 md:space-y-6">

                        <AnimatePresence mode="wait">
                            {mode === 'signup' && (
                                <motion.div
                                    key="signup-fields"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="space-y-4 md:space-y-5 overflow-hidden"
                                >
                                    {/* Role Selector INSIDE signup form */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Choose your account type</label>
                                        <div className="bg-slate-50/80 p-1.5 md:p-2 rounded-xl md:rounded-2xl flex relative border border-slate-100">
                                            {['student', 'invigilator', 'admin'].map((r) => (
                                                <button
                                                    key={r}
                                                    type="button"
                                                    onClick={() => { setRole(r); setError(null); }}
                                                    className={`flex-1 relative z-10 py-2 md:py-3 text-[10px] md:text-sm font-bold uppercase tracking-widest rounded-lg md:rounded-xl transition-all duration-300 ${role === r ? 'text-slate-900 shadow-sm bg-white ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600'
                                                        }`}
                                                >
                                                    {r}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-4 md:space-y-5">
                                        <div className="relative group">
                                            <User className="absolute left-4 top-3.5 md:top-4 h-4 w-4 md:h-5 md:w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                                            <Input
                                                className="pl-10 md:pl-12 h-11 md:h-14 bg-slate-50 border-transparent focus:bg-white focus:border-blue-200 transition-all rounded-xl md:rounded-2xl text-sm md:text-base"
                                                name="name" placeholder="Full Name" value={formData.name} onChange={handleInputChange} required
                                            />
                                        </div>

                                        <div className="relative group">
                                            <CreditCard className="absolute left-4 top-3.5 md:top-4 h-4 w-4 md:h-5 md:w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                                            <Input
                                                className="pl-10 md:pl-12 h-11 md:h-14 bg-slate-50 border-transparent focus:bg-white focus:border-blue-200 transition-all rounded-xl md:rounded-2xl text-sm md:text-base"
                                                name="idNumber"
                                                placeholder={role === 'student' ? "ID Number" : "Staff Verification Key"}
                                                value={formData.idNumber} onChange={handleInputChange} required
                                            />
                                        </div>

                                        <div className="relative group">
                                            <School className="absolute left-4 top-3.5 md:top-4 h-4 w-4 md:h-5 md:w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                                            <select
                                                className="w-full pl-10 md:pl-12 h-11 md:h-14 bg-slate-50 border-transparent focus:bg-white focus:border-blue-200 transition-all rounded-xl md:rounded-2xl text-xs md:text-base text-slate-700 outline-none cursor-pointer appearance-none"
                                                name="department" value={formData.department} onChange={handleInputChange}
                                            >
                                                {['Software Engineering', 'Cyber Security', 'Computer Science', 'Information Technology', 'Information Systems', 'Data Science'].map(dept => (
                                                    <option key={dept} value={dept}>{dept}</option>
                                                ))}
                                            </select>
                                            <div className="absolute right-4 md:right-5 top-4 md:top-5 pointer-events-none text-slate-400 text-[10px] md:text-xs">▼</div>
                                        </div>

                                        {role === 'student' && (
                                            <div className="relative group">
                                                <School className="absolute left-4 top-3.5 md:top-4 h-4 w-4 md:h-5 md:w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                                                <select
                                                    className="w-full pl-10 md:pl-12 h-11 md:h-14 bg-slate-50 border-transparent focus:bg-white focus:border-blue-200 transition-all rounded-xl md:rounded-2xl text-xs md:text-base text-slate-700 outline-none cursor-pointer appearance-none"
                                                    name="level" value={formData.level} onChange={handleInputChange}
                                                >
                                                    {['100', '200', '300', '400'].map(lvl => <option key={lvl} value={lvl}>{lvl} Level</option>)}
                                                </select>
                                                <div className="absolute right-4 md:right-5 top-4 md:top-5 pointer-events-none text-slate-400 text-[10px] md:text-xs">▼</div>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="relative group">
                            <Mail className="absolute left-4 top-3.5 md:top-4 h-4 w-4 md:h-5 md:w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                            <Input
                                className="pl-10 md:pl-12 h-11 md:h-14 bg-slate-50 border-transparent focus:bg-white focus:border-blue-200 transition-all rounded-xl md:rounded-2xl text-sm md:text-base"
                                type="email" name="email"
                                placeholder="Email Address"
                                value={formData.email} onChange={handleInputChange} required
                            />
                        </div>

                        <div className="relative group">
                            <Lock className="absolute left-4 top-3.5 md:top-4 h-4 w-4 md:h-5 md:w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                            <Input
                                className="pl-10 md:pl-12 h-11 md:h-14 bg-slate-50 border-transparent focus:bg-white focus:border-blue-200 transition-all rounded-xl md:rounded-2xl text-sm md:text-base"
                                type="password" name="password" placeholder="••••••••"
                                value={formData.password} onChange={handleInputChange} required
                            />
                        </div>

                        <Button
                            type="submit"
                            className={`w-full h-11 md:h-14 text-sm md:text-lg font-bold shadow-xl shadow-blue-500/10 rounded-xl md:rounded-2xl transition-all duration-300 mt-4 md:mt-6 text-white ${currentTheme}`}
                            disabled={isLoading}
                        >
                            {isLoading ? <Loader2 className="animate-spin text-white" /> : (
                                <span className="flex items-center justify-center gap-2 md:gap-3">
                                    {mode === 'login' ? 'Sign In' : 'Create Account'}
                                    <ArrowRight size={18} className="md:w-5 md:h-5" />
                                </span>
                            )}
                        </Button>
                    </form>

                    {/* Sign In / Sign Up Toggle INSIDE Card */}
                    <div className="pt-4 md:pt-6 border-t border-slate-100 flex items-center justify-center gap-2 text-xs md:text-sm">
                        <p className="text-slate-500 font-medium">
                            {mode === 'login' ? "Don't have an account?" : "Already have an account?"}
                        </p>
                        <button
                            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}
                            className={`font-bold transition-colors hover:underline ${currentTextTheme}`}
                        >
                            {mode === 'login' ? 'Create Account' : 'Sign In'}
                        </button>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default LandingPage;
