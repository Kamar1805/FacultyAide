import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Lock, Mail, CreditCard, ArrowRight, Loader2, AlertCircle, Calendar, LayoutGrid, FileText, School, Clock, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const LandingPage = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Auth States
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
        department: '',
    });

    useEffect(() => {
        // Parse Role from URL query if present
        const searchParams = new URLSearchParams(location.search);
        const roleParam = searchParams.get('role');
        if (roleParam && ['admin', 'coordinator'].includes(roleParam)) {
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

            const docRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const userData = docSnap.data();
                const userRole = userData.role;

                if (userRole === 'admin') navigate('/admin');
                else if (userRole === 'coordinator') navigate('/coordinator');
                else setError("Unauthorized access.");
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

        // Security Check
        if (role === 'admin' && formData.idNumber !== 'ADMIN2026') return setError("Invalid Admin Staff Key.");
        if (role === 'coordinator' && formData.idNumber !== 'COORD2026') return setError("Invalid Coordinator Staff Key.");

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            const user = userCredential.user;

            const userData = {
                uid: user.uid,
                email: formData.email,
                name: formData.name,
                role: role,
                department: formData.department,
                createdAt: new Date().toISOString(),
                staffId: formData.idNumber
            };

            await setDoc(doc(db, 'users', user.uid), userData);

            if (role === 'admin') navigate('/admin');
            else navigate('/coordinator');

        } catch (err) {
            console.error("Signup Error:", err);
            setError(err.message.replace('Firebase:', '').trim());
        } finally {
            setIsLoading(false);
        }
    };

    const isCoordinator = role === 'coordinator';

    return (
        <div className="min-h-screen flex flex-col lg:flex-row font-sans bg-white selection:bg-slate-100">

            {/* LEFT SIDE: Brand & Info */}
            <div className="lg:w-[45%] xl:w-[40%] bg-primary text-white p-8 lg:p-12 relative flex flex-col justify-between min-h-[400px] lg:min-h-screen border-r border-white/10">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none" />

                {/* Header / Logo Area */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="relative z-10 flex items-center gap-3"
                >
                    <div className="bg-white p-1.5 rounded-lg">
                        <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
                    </div>
                    <span className="text-xl font-bold tracking-tight text-white">FacultyAide</span>
                </motion.div>

                {/* Main Content */}
                <div className="relative z-10 flex-1 flex flex-col justify-center py-12 lg:py-0">
                    <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1, duration: 0.5 }}
                    >
                        <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight mb-6 text-white">
                            Academic Resource <br />
                            <span className="text-white/60">Management.</span>
                        </h1>
                        <p className="text-lg text-slate-300 mb-10 max-w-sm leading-relaxed font-medium">
                            Enterprise scheduling and facility management for modern universities.
                        </p>

                        <div className="space-y-4">
                            {[
                                { icon: Calendar, title: "Timetable Coordination", desc: "Conflict-free automatic scheduling." },
                                { icon: LayoutGrid, title: "Facility Administration", desc: "Manage venues, labs, and capacities." },
                                { icon: FileText, title: "Examination Planning", desc: "Exam logistics and invigilation." }
                            ].map((item, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 + (idx * 0.1) }}
                                    className="flex items-center gap-4 group"
                                >
                                    <div className="bg-white/10 p-2.5 rounded-lg text-white/80 group-hover:text-white group-hover:bg-white/20 transition-colors border border-white/5">
                                        <item.icon size={20} strokeWidth={1.5} />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-white text-sm">{item.title}</h3>
                                        <p className="text-xs text-white/50">{item.desc}</p>
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
                    transition={{ delay: 0.5 }}
                    className="relative z-10 text-xs font-medium text-white/30 w-full"
                >
                    <p>© 2026 FacultyAide System v2.0</p>
                </motion.div>
            </div>

            {/* RIGHT SIDE: Auth Form */}
            <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-24 bg-slate-50">
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                    className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-slate-200"
                >
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">
                            {mode === 'login' ? 'System Access' : 'Staff Registration'}
                        </h2>
                        <p className="text-slate-500 text-sm">
                            {mode === 'login'
                                ? 'Secure login for authorized personnel.'
                                : 'Create account for Administration or Coordination.'}
                        </p>
                    </div>

                    {error && (
                        <div className="mb-6 bg-red-50 text-red-700 text-sm p-3 rounded-lg flex items-center gap-3 border border-red-100">
                            <AlertCircle size={16} className="shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="space-y-5">
                        <AnimatePresence mode="wait">
                            {mode === 'signup' && (
                                <motion.div
                                    key="signup-fields"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="space-y-5 overflow-hidden"
                                >
                                    <div className="grid grid-cols-2 gap-3 p-1 bg-slate-100 rounded-xl">
                                        {['admin', 'coordinator'].map((r) => (
                                            <button
                                                key={r}
                                                type="button"
                                                onClick={() => { setRole(r); setError(null); }}
                                                className={`py-2 px-4 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${role === r ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                            >
                                                {r === 'coordinator' ? 'Coordinator' : 'Admin'}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Full Name</label>
                                        <Input
                                            className="h-11 bg-slate-50/50 border-slate-200 focus:bg-white transition-all"
                                            name="name" placeholder="Staff Name" value={formData.name} onChange={handleInputChange} required
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Staff Key</label>
                                        <div className="relative group">
                                            <CreditCard className="absolute left-3 top-3.5 h-4 w-4 text-slate-400 group-focus-within:text-slate-800 transition-colors" />
                                            <Input
                                                className="pl-10 h-11 bg-slate-50/50 border-slate-200 focus:bg-white transition-all"
                                                name="idNumber"
                                                placeholder="Enter Verification ID"
                                                value={formData.idNumber} onChange={handleInputChange} required
                                            />
                                        </div>
                                    </div>

                                    {role === 'coordinator' && (
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Department</label>
                                            <select
                                                name="department"
                                                className="flex h-11 w-full rounded-md border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus:bg-white transition-all disabled:cursor-not-allowed disabled:opacity-50"
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
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Email Address</label>
                            <div className="relative group">
                                <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-400 group-focus-within:text-slate-800 transition-colors" />
                                <Input
                                    className="pl-10 h-11 bg-slate-50/50 border-slate-200 focus:bg-white transition-all"
                                    type="email" name="email"
                                    placeholder="user@university.edu"
                                    value={formData.email} onChange={handleInputChange} required
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-400 group-focus-within:text-slate-800 transition-colors" />
                                <Input
                                    className="pl-10 h-11 bg-slate-50/50 border-slate-200 focus:bg-white transition-all"
                                    type="password" name="password" placeholder="••••••••"
                                    value={formData.password} onChange={handleInputChange} required
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-12 text-sm font-bold tracking-wide uppercase shadow-lg bg-slate-900 hover:bg-slate-800 text-white rounded-xl mt-2"
                            disabled={isLoading}
                        >
                            {isLoading ? <Loader2 className="animate-spin" /> : (mode === 'login' ? 'Login to Dashboard' : 'Create Account')}
                        </Button>
                    </form>

                    <div className="pt-6 mt-6 border-t border-slate-100 text-center">
                        <button
                            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}
                            className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-wide"
                        >
                            {mode === 'login' ? "Register New Account" : "Back to Login"}
                        </button>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default LandingPage;
