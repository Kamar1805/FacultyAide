import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Lock, Mail, CreditCard, ArrowRight, ArrowLeft, Loader2, AlertCircle, CalendarClock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
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
                staffId: formData.idNumber
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
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">

            {/* Background Decorations */}
            <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-white to-slate-50 z-0"></div>
            <div className="absolute top-[-100px] right-[-100px] w-[500px] h-[500px] bg-indigo-100/30 rounded-full blur-[100px]"></div>

            <Button variant="ghost" className="absolute top-6 left-6 z-10 text-slate-500 hover:text-slate-900" onClick={() => navigate('/')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
            </Button>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md z-10"
            >
                <div className="text-center mb-8">
                    <div className="w-16 h-16 mx-auto mb-4 bg-white rounded-2xl shadow-lg flex items-center justify-center">
                        <img src="/logo.png" alt="FA" className="w-10 h-10 object-contain" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">FacultyAide</h1>
                    <p className="text-slate-500 mt-2">Administrative & Scheduling System</p>
                </div>

                <Card className="border-0 shadow-2xl overflow-hidden backdrop-blur-sm bg-white/90">
                    <CardHeader className="pb-0 pt-6 px-6">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <CardTitle className="text-2xl font-bold capitalize">{mode === 'login' ? 'Staff Login' : 'New Staff Account'}</CardTitle>
                                <CardDescription>
                                    {mode === 'login'
                                        ? 'Sign in to access the portal'
                                        : `Register as ${role === 'admin' ? 'an Administrator' : 'a Coordinator'}`}
                                </CardDescription>
                            </div>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${currentTheme} shadow-lg transition-colors duration-300`}>
                                {mode === 'login' ? <Lock size={20} /> : (
                                    <>
                                        {role === 'admin' && <Lock size={20} />}
                                        {role === 'coordinator' && <CalendarClock size={20} />}
                                    </>
                                )}
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="px-6 py-4 space-y-4">
                        {error && (
                            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                                <AlertCircle size={16} /> {error}
                            </div>
                        )}

                        <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="space-y-4">

                            {/* Inputs for Sign Up */}
                            <AnimatePresence mode="wait">
                                {mode === 'signup' && (
                                    <motion.div
                                        key="signup-fields"
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="space-y-4 overflow-hidden"
                                    >
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Select Role</label>
                                            <div className="flex bg-slate-100 p-1 rounded-lg">
                                                {['admin', 'coordinator'].map((r) => (
                                                    <button
                                                        key={r}
                                                        type="button"
                                                        onClick={() => { setRole(r); setError(null); }}
                                                        className={`flex-1 py-1.5 text-xs font-bold rounded-md capitalize transition-all duration-300 ${role === r ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
                                                            }`}
                                                    >
                                                        {r}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Staff Name</label>
                                            <Input
                                                name="name"
                                                placeholder="e.g. Dr. John Doe"
                                                value={formData.name}
                                                onChange={handleInputChange}
                                                required
                                            />
                                        </div>

                                        {role === 'coordinator' && (
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase">Department</label>
                                                <select
                                                    name="department"
                                                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
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

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Verification Key</label>
                                            <div className="relative">
                                                <CreditCard className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                                <Input
                                                    className="pl-10"
                                                    name="idNumber"
                                                    placeholder="Enter Staff Key"
                                                    value={formData.idNumber}
                                                    onChange={handleInputChange}
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Common Inputs */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">
                                    Email Address
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                    <Input
                                        className="pl-10"
                                        type="email"
                                        name="email"
                                        placeholder="staff@university.edu"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                    <Input
                                        className="pl-10"
                                        type="password"
                                        name="password"
                                        placeholder="••••••••"
                                        value={formData.password}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className={`w-full ${currentTheme} hover:opacity-90 transition-all h-11 text-base shadow-lg mt-4`}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Please wait...
                                    </>
                                ) : (
                                    <>
                                        {mode === 'login' ? 'Sign In' : 'Create Account'} <ArrowRight className="ml-2 h-4 w-4" />
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>

                    <CardFooter className="bg-slate-50 border-t p-4 flex justify-center">
                        <p className="text-sm text-slate-600">
                            {mode === 'login' ? "New staff member? " : "Already registered? "}
                            <button
                                onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}
                                className={`font-bold ${currentTextTheme} hover:underline focus:outline-none`}
                            >
                                {mode === 'login' ? 'Register' : 'Log In'}
                            </button>
                        </p>
                    </CardFooter>
                </Card>
            </motion.div>
        </div>
    );
};

export default Auth;
