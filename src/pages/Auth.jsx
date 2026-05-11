import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Lock, Mail, CreditCard, ArrowRight, ArrowLeft, Loader2, AlertCircle, CalendarClock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const Auth = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [mode, setMode] = useState('login'); // 'login' or 'signup'
    const [role, setRole] = useState('admin'); // 'admin', 'coordinator'
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Form States
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: '',
        idNumber: '', // Staff Key
        department: '', // Default empty to force selection
    });

    useEffect(() => {
        // Parse Role from URL query if present
        const searchParams = new URLSearchParams(location.search);
        const roleParam = searchParams.get('role');
        if (roleParam && ['admin', 'coordinator'].includes(roleParam)) {
            setRole(roleParam);
            setMode('signup');
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

            const docRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const userData = docSnap.data();
                const userRole = userData.role;

                if (userData.accessStatus === 'revoked') {
                    await signOut(auth);
                    setError('This account has been deactivated. Contact the faculty administrator.');
                    setIsLoading(false);
                    return;
                }

                if (userRole === 'admin') navigate('/admin');
                else if (userRole === 'coordinator') navigate('/coordinator');
                else {
                    setError("Unauthorized role. Please contact support.");
                }
            } else {
                setError("User profile not found.");
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

        // Security Check: Validate Staff Keys
        if (role === 'admin' && formData.idNumber !== 'ADMIN2026') {
            setError("Invalid Admin Staff Key.");
            setIsLoading(false);
            return;
        }
        if (role === 'coordinator' && formData.idNumber !== 'COORD2026') {
            setError("Invalid Coordinator Staff Key.");
            setIsLoading(false);
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            const user = userCredential.user;

            // Prepare Data for Firestore
            const userData = {
                uid: user.uid,
                email: formData.email,
                name: formData.name,
                role: role,
                department: formData.department,
                createdAt: new Date().toISOString(),
                staffId: formData.idNumber,
                accessStatus: 'active',
            };

            // Save to Firestore
            await setDoc(doc(db, 'users', user.uid), userData);

            // Redirect
            if (role === 'admin') navigate('/admin');
            else navigate('/coordinator');

        } catch (err) {
            console.error("Signup Error:", err);
            setError(err.message.replace('Firebase:', '').trim());
        } finally {
            setIsLoading(false);
        }
    };

    const roleColors = {
        admin: 'bg-slate-900',
        coordinator: 'bg-indigo-600'
    };

    const roleText = {
        admin: 'text-slate-900',
        coordinator: 'text-indigo-600'
    };

    // Generic display for Login
    const currentTheme = mode === 'login' ? 'bg-primary' : roleColors[role];
    const currentTextTheme = mode === 'login' ? 'text-primary' : roleText[role];

    return (
        <div className="min-h-screen flex w-full font-sans bg-slate-50">
            {/* Left Panel - Branding (Hidden on mobile) */}
            <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between overflow-hidden bg-[#00008b]">
                {/* Modern Mesh Gradient Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#00008b] via-[#000060] to-[#579044] opacity-90 z-0"></div>
                <div className="absolute top-[-20%] left-[-10%] w-[140%] h-[140%] rounded-full bg-gradient-to-b from-white/10 to-transparent blur-3xl transform -rotate-12 pointer-events-none"></div>

                <div className="relative z-10 p-12">
                     <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-2xl w-fit p-3 shadow-xl border border-white/20">
                         <img src="/logo.png" alt="FacultyAide" className="w-8 h-8 object-contain bg-white rounded-xl p-1" />
                         <span className="text-xl font-bold text-white tracking-widest">FacultyAide</span>
                     </div>
                </div>

                <div className="relative z-10 p-12 pb-20">
                    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
                        <h1 className="text-5xl font-black text-white leading-tight mt-10">
                            Orchestrating <br/> <span className="text-[#a7f3d0]">Academic Excellence</span>
                        </h1>
                        <p className="mt-6 text-xl text-blue-100 font-medium max-w-lg leading-relaxed">
                            The intelligent platform for institutional scheduling, faculty management, and curriculum workflows.
                        </p>
                    </motion.div>
                </div>
            </div>

            {/* Right Panel - Auth Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative overflow-hidden bg-slate-50">
                {/* Mobile Back button */}
                <Button variant="ghost" className="absolute top-6 left-6 z-20 text-slate-500 hover:text-slate-900 font-bold" onClick={() => navigate('/')}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>

                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="w-full max-w-md z-10 mt-12 lg:mt-0"
                >
                    <div className="text-center mb-8 lg:hidden">
                        <div className="w-16 h-16 mx-auto mb-4 bg-white rounded-2xl shadow-xl flex items-center justify-center border border-slate-100">
                            <img src="/logo.png" alt="FA" className="w-10 h-10 object-contain" />
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">FacultyAide</h1>
                    </div>

                    <div className="mb-10 text-center lg:text-left">
                        <h2 className="text-3xl font-black tracking-tight text-slate-900 capitalize">
                            {mode === 'login' ? 'Welcome Back' : 'Join FacultyAide'}
                        </h2>
                        <p className="text-slate-500 font-medium mt-2">
                             {mode === 'login'
                                ? 'Sign in to access your dashboard'
                                : `Register your ${role} account to continue`}
                        </p>
                    </div>

                    <Card className="border-0 shadow-2xl overflow-hidden bg-white/80 backdrop-blur-xl ring-1 ring-slate-900/5 rounded-3xl">
                        <CardContent className="p-8">
                            {error && (
                                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-50 text-red-600 text-sm font-bold p-4 rounded-xl flex items-center gap-2 mb-6 border border-red-100">
                                    <AlertCircle size={18} /> {error}
                                </motion.div>
                            )}

                            <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="space-y-5">
                                <AnimatePresence mode="wait">
                                    {mode === 'signup' && (
                                        <motion.div
                                            key="signup-fields"
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className="space-y-5 overflow-hidden"
                                        >
                                            <div className="space-y-2">
                                                <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                                                    {['admin', 'coordinator'].map((r) => (
                                                        <button
                                                            key={r}
                                                            type="button"
                                                            onClick={() => { setRole(r); setError(null); }}
                                                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all duration-300 ${role === r ? 'bg-white shadow-sm text-[#00008b]' : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                                                                }`}
                                                        >
                                                            {r}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Staff Name</label>
                                                <Input name="name" className="h-12 bg-slate-50 border-slate-200 focus-visible:ring-[#00008b]/20 font-medium rounded-xl" placeholder="e.g. Dr. John Doe" value={formData.name} onChange={handleInputChange} required />
                                            </div>

                                            {role === 'coordinator' && (
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Department</label>
                                                    <select
                                                        name="department"
                                                        className="flex h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#00008b]/20"
                                                        value={formData.department}
                                                        onChange={handleInputChange}
                                                        required
                                                    >
                                                        <option value="" disabled>Select Department</option>
                                                        <option value="Software Engineering">Software Engineering</option>
                                                        <option value="Computer Science">Computer Science</option>
                                                        <option value="Information Technology">Information Technology</option>
                                                        <option value="Cyber Security">Cyber Security</option>
                                                        <option value="Data Science">Data Science</option>
                                                    </select>
                                                </div>
                                            )}

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Verification Key</label>
                                                <div className="relative">
                                                    <CreditCard className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                                                    <Input className="pl-12 h-12 bg-slate-50 border-slate-200 focus-visible:ring-[#00008b]/20 font-medium rounded-xl" name="idNumber" placeholder="Enter Staff Key" value={formData.idNumber} onChange={handleInputChange} required />
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                                        <Input
                                            className="pl-12 h-12 bg-slate-50 border-slate-200 focus-visible:ring-[#00008b]/20 font-medium rounded-xl"
                                            type="email" name="email" placeholder="staff@university.edu" value={formData.email} onChange={handleInputChange} required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                                        <Input
                                            className="pl-12 h-12 bg-slate-50 border-slate-200 focus-visible:ring-[#00008b]/20 font-medium rounded-xl"
                                            type="password" name="password" placeholder="••••••••" value={formData.password} onChange={handleInputChange} required
                                        />
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full bg-[#00008b] hover:bg-[#000060] text-white font-bold h-12 rounded-xl shadow-lg shadow-[#00008b]/20 transition-all hover:-translate-y-0.5 active:translate-y-0 mt-6"
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Verifying...</>
                                    ) : (
                                        <>{mode === 'login' ? 'Sign In' : 'Create Account'} <ArrowRight className="ml-2 h-5 w-5" /></>
                                    )}
                                </Button>
                            </form>
                        </CardContent>

                        <div className="bg-slate-50/80 backdrop-blur-sm border-t border-slate-100 p-5 flex justify-center">
                            <p className="text-sm font-medium text-slate-500">
                                {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
                                <button
                                    onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}
                                    className="font-bold text-[#579044] hover:text-[#427033] ml-1 transition-colors underline-offset-4 hover:underline"
                                >
                                    {mode === 'login' ? 'Request Access' : 'Sign In'}
                                </button>
                            </p>
                        </div>
                    </Card>
                </motion.div>
                
                {/* Bottom right subtle decoration */}
                <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-[#579044]/5 blur-3xl pointer-events-none"></div>
            </div>
        </div>
    );
};

export default Auth;
