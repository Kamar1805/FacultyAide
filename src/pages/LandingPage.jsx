import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Lock, Mail, CreditCard, ArrowRight, Loader2, AlertCircle, Calendar, LayoutGrid, GraduationCap, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const LandingPage = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const [mode, setMode] = useState('login');
    const [role, setRole] = useState('admin');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: '',
        idNumber: '',
        department: '',
    });

    useEffect(() => {
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

                if (userData.accessStatus === 'revoked') {
                    await signOut(auth);
                    setError('This account has been deactivated. Contact the faculty administrator.');
                    setIsLoading(false);
                    return;
                }

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
                staffId: formData.idNumber,
                accessStatus: 'active',
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

    return (
        <div className="min-h-screen flex flex-col lg:flex-row font-sans bg-slate-50 selection:bg-indigo-100 selection:text-indigo-900">

            {/* Brand panel */}
            <div className="lg:w-[46%] xl:w-[42%] relative overflow-hidden bg-slate-950 text-white min-h-[380px] lg:min-h-screen">
                <div
                    className="absolute inset-0 opacity-[0.07]"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                    }}
                />
                <div className="absolute top-0 right-0 w-[min(100%,520px)] h-[min(100%,520px)] bg-indigo-600/25 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

                <div className="relative z-10 flex flex-col h-full p-8 lg:p-12 xl:p-14">
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3"
                    >
                        <div className="rounded-xl bg-white/10 p-2 ring-1 ring-white/15 backdrop-blur-sm">
                            <img src="/logo.png" alt="" className="w-9 h-9 object-contain" />
                        </div>
                        <div>
                            <span className="text-lg font-bold tracking-tight block leading-none">FacultyAide</span>
                            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Teaching operations</span>
                        </div>
                    </motion.div>

                    <div className="flex-1 flex flex-col justify-center py-10 lg:py-0 max-w-lg">
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05, duration: 0.45 }}
                        >
                            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-indigo-200 ring-1 ring-white/10 mb-6">
                                <Sparkles size={12} className="text-amber-300" />
                                Built for coordinators & admins
                            </div>
                            <h1 className="text-4xl sm:text-5xl xl:text-[3.25rem] font-extrabold leading-[1.08] tracking-tight text-white">
                                Smarter timetables.
                                <span className="block text-white/55 font-semibold mt-2 text-[0.92em]">
                                    Clear venues. One source of truth.
                                </span>
                            </h1>
                            <p className="mt-6 text-base sm:text-lg text-slate-400 leading-relaxed max-w-md">
                                Coordinate lecture schedules, venue capacity, and delivery modes (theory, labs, and online) in one place.
                            </p>

                            <div className="mt-10 space-y-3">
                                {[
                                    { icon: Calendar, title: 'Timetable generation', desc: 'OR-Tools powered scheduling with clash rules you control.' },
                                    { icon: LayoutGrid, title: 'Venue intelligence', desc: 'Match halls, labs, and virtual rooms to how each course is taught.' },
                                    { icon: GraduationCap, title: 'Department workflows', desc: 'Coordinators work within their curriculum; admins keep the map current.' },
                                ].map((item, idx) => (
                                    <motion.div
                                        key={item.title}
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.15 + idx * 0.06 }}
                                        className="flex gap-4 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/[0.08] hover:bg-white/[0.06] transition-colors"
                                    >
                                        <div className="shrink-0 rounded-xl bg-indigo-500/20 p-2.5 text-indigo-200">
                                            <item.icon size={20} strokeWidth={1.75} />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-white text-sm">{item.title}</h3>
                                            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.desc}</p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    </div>

                    <p className="relative z-10 text-[11px] font-medium text-white/35">
                        © {new Date().getFullYear()} FacultyAide
                    </p>
                </div>
            </div>

            {/* Auth */}
            <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-16 xl:p-20">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md"
                >
                    <div className="rounded-3xl bg-white p-8 sm:p-10 shadow-[0_25px_60px_-15px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/80">
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                                {mode === 'login' ? 'Sign in' : 'Create staff account'}
                            </h2>
                            <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                                {mode === 'login'
                                    ? 'Use your institutional email to access the dashboard.'
                                    : 'Registration requires a valid staff verification key.'}
                            </p>
                        </div>

                        {error && (
                            <div className="mb-6 bg-red-50 text-red-800 text-sm p-4 rounded-xl flex gap-3 border border-red-100">
                                <AlertCircle size={18} className="shrink-0 mt-0.5" />
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
                                        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                                            {['admin', 'coordinator'].map((r) => (
                                                <button
                                                    key={r}
                                                    type="button"
                                                    onClick={() => { setRole(r); setError(null); }}
                                                    className={`py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${role === r ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80' : 'text-slate-500 hover:text-slate-800'}`}
                                                >
                                                    {r === 'coordinator' ? 'Coordinator' : 'Admin'}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Full name</label>
                                            <Input
                                                className="h-11 rounded-xl bg-slate-50/80 border-slate-200 focus:bg-white transition-all"
                                                name="name" placeholder="Staff name" value={formData.name} onChange={handleInputChange} required
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Staff key</label>
                                            <div className="relative group">
                                                <CreditCard className="absolute left-3 top-3.5 h-4 w-4 text-slate-400 group-focus-within:text-slate-700 transition-colors" />
                                                <Input
                                                    className="pl-10 h-11 rounded-xl bg-slate-50/80 border-slate-200 focus:bg-white transition-all"
                                                    name="idNumber"
                                                    placeholder="Verification ID"
                                                    value={formData.idNumber} onChange={handleInputChange} required
                                                />
                                            </div>
                                        </div>

                                        {role === 'coordinator' && (
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Department</label>
                                                <select
                                                    name="department"
                                                    className="flex h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus:bg-white transition-all disabled:cursor-not-allowed disabled:opacity-50"
                                                    value={formData.department}
                                                    onChange={handleInputChange}
                                                    required
                                                >
                                                    <option value="" disabled>Select department</option>
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
                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Email</label>
                                <div className="relative group">
                                    <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-400 group-focus-within:text-slate-700 transition-colors" />
                                    <Input
                                        className="pl-10 h-11 rounded-xl bg-slate-50/80 border-slate-200 focus:bg-white transition-all"
                                        type="email" name="email"
                                        placeholder="you@university.edu"
                                        value={formData.email} onChange={handleInputChange} required
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-400 group-focus-within:text-slate-700 transition-colors" />
                                    <Input
                                        className="pl-10 h-11 rounded-xl bg-slate-50/80 border-slate-200 focus:bg-white transition-all"
                                        type="password" name="password" placeholder="••••••••"
                                        value={formData.password} onChange={handleInputChange} required
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-12 text-sm font-bold tracking-wide rounded-xl mt-2 bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/15"
                                disabled={isLoading}
                            >
                                {isLoading ? <Loader2 className="animate-spin h-5 w-5 mx-auto" /> : (
                                    <span className="flex items-center justify-center gap-2">
                                        {mode === 'login' ? 'Continue' : 'Register'}
                                        <ArrowRight size={18} />
                                    </span>
                                )}
                            </Button>
                        </form>

                        <div className="pt-8 mt-8 border-t border-slate-100 text-center">
                            <button
                                type="button"
                                onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}
                                className="text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors uppercase tracking-wide"
                            >
                                {mode === 'login' ? 'Need an account? Register' : 'Already registered? Sign in'}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default LandingPage;
