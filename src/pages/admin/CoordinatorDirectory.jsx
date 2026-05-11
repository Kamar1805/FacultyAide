import React, { useState, useEffect, useMemo } from "react";
import {
    collection,
    query,
    where,
    onSnapshot,
    doc,
    updateDoc,
    setDoc,
} from "firebase/firestore";
import {
    createUserWithEmailAndPassword,
    signOut as signOutProvision,
} from "firebase/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { db, auth, provisionAuth } from "../../firebase";
import { FCOM_DEPARTMENTS } from "../../constants/departments";
import InstructionGuide from "../../components/InstructionGuide";
import {
    Users,
    Building2,
    ShieldOff,
    ShieldCheck,
    Plus,
    Mail,
    RefreshCw,
    Clock,
    MapPin,
    Pencil,
    X,
    Search,
    Activity,
} from "lucide-react";

const formatTs = (iso) => {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
        });
    } catch {
        return String(iso);
    }
};

const CoordinatorDirectory = () => {
    const [coordinators, setCoordinators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [busyId, setBusyId] = useState(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [createForm, setCreateForm] = useState({
        name: "",
        email: "",
        password: "",
        department: FCOM_DEPARTMENTS[0],
    });
    const [createError, setCreateError] = useState("");
    const [creating, setCreating] = useState(false);
    const [editOpen, setEditOpen] = useState(null);
    const [editDepartment, setEditDepartment] = useState("");

    useEffect(() => {
        const q = query(collection(db, "users"), where("role", "==", "coordinator"));
        const unsub = onSnapshot(
            q,
            (snap) => {
                const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                setCoordinators(rows);
                setLoading(false);
            },
            (err) => {
                console.error(err);
                setLoading(false);
            }
        );
        return () => unsub();
    }, []);

    const filtered = useMemo(() => {
        const s = search.trim().toLowerCase();
        if (!s) return coordinators;
        return coordinators.filter(
            (c) =>
                (c.name || "").toLowerCase().includes(s) ||
                (c.email || "").toLowerCase().includes(s) ||
                (c.department || "").toLowerCase().includes(s)
        );
    }, [coordinators, search]);

    const byDept = useMemo(() => {
        const map = {};
        for (const c of filtered) {
            const dept = c.department || "Unassigned";
            if (!map[dept]) map[dept] = [];
            map[dept].push(c);
        }
        const order = [...FCOM_DEPARTMENTS, "Unassigned"];
        return order.filter((d) => map[d]?.length).map((d) => ({ department: d, people: map[d] }));
    }, [filtered]);

    const stats = useMemo(() => {
        const active = coordinators.filter((c) => c.accessStatus !== "revoked").length;
        const revoked = coordinators.filter((c) => c.accessStatus === "revoked").length;
        return { total: coordinators.length, active, revoked };
    }, [coordinators]);

    const revoke = async (row) => {
        if (!window.confirm(`Revoke access for ${row.name || row.email}? They will be signed out on next load.`))
            return;
        setBusyId(row.id);
        try {
            await updateDoc(doc(db, "users", row.id), {
                accessStatus: "revoked",
                revokedAt: new Date().toISOString(),
                revokedBy: auth.currentUser?.uid || null,
            });
        } catch (e) {
            console.error(e);
            alert("Could not revoke. Check Firestore rules allow admin updates to user documents.");
        } finally {
            setBusyId(null);
        }
    };

    const reactivate = async (row) => {
        setBusyId(row.id);
        try {
            await updateDoc(doc(db, "users", row.id), {
                accessStatus: "active",
                revokedAt: null,
                revokedBy: null,
            });
        } catch (e) {
            console.error(e);
            alert("Could not reactivate.");
        } finally {
            setBusyId(null);
        }
    };

    const saveDepartment = async (row) => {
        setBusyId(row.id);
        try {
            await updateDoc(doc(db, "users", row.id), {
                department: editDepartment,
                departmentUpdatedAt: new Date().toISOString(),
                departmentUpdatedBy: auth.currentUser?.uid || null,
            });
            setEditOpen(null);
        } catch (e) {
            console.error(e);
            alert("Could not update department.");
        } finally {
            setBusyId(null);
        }
    };

    const handleCreateCoordinator = async (e) => {
        e.preventDefault();
        setCreateError("");
        const { name, email, password, department } = createForm;
        if (!name.trim() || !email.trim() || password.length < 6) {
            setCreateError("Name and email are required; password must be at least 6 characters.");
            return;
        }
        setCreating(true);
        try {
            const cred = await createUserWithEmailAndPassword(
                provisionAuth,
                email.trim(),
                password
            );
            const uid = cred.user.uid;
            await setDoc(doc(db, "users", uid), {
                uid,
                email: email.trim(),
                name: name.trim(),
                role: "coordinator",
                department,
                accessStatus: "active",
                createdAt: new Date().toISOString(),
                staffId: "ADMIN_PROVISIONED",
                provisionedBy: auth.currentUser?.uid || null,
            });
            await signOutProvision(provisionAuth);
            setCreateOpen(false);
            setCreateForm({
                name: "",
                email: "",
                password: "",
                department: FCOM_DEPARTMENTS[0],
            });
        } catch (err) {
            console.error(err);
            setCreateError(err.message?.replace("Firebase: ", "") || "Failed to create account.");
            try {
                await signOutProvision(provisionAuth);
            } catch (_) {
                /* ignore */
            }
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-24 max-w-7xl mx-auto">
            <InstructionGuide
                title="Central coordinator control"
                steps={[
                    "View every timetable coordinator grouped by department, with last activity and account state.",
                    "Create coordinators with email + password — they can sign in on the landing page immediately.",
                    "Revoke access to block sign-in; restore access when a coordinator should return.",
                    "If listing or updates fail, adjust Firestore security rules so admin users can read/write all `users` documents.",
                ]}
            />

            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-slate-200 pb-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Coordinators</h1>
                    <p className="text-slate-500 font-medium mt-1">
                        Faculty-wide oversight of department timetable coordinators.
                    </p>
                </div>
                <Button
                    className="bg-[#00008b] hover:bg-[#000060] text-white font-bold shadow-lg"
                    onClick={() => setCreateOpen(true)}
                >
                    <Plus className="mr-2 h-4 w-4" />
                    New coordinator
                </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    { label: "Total accounts", value: stats.total, icon: Users, bg: "bg-slate-900 text-white" },
                    { label: "Active access", value: stats.active, icon: ShieldCheck, bg: "bg-emerald-600 text-white" },
                    { label: "Revoked", value: stats.revoked, icon: ShieldOff, bg: "bg-amber-600 text-white" },
                ].map((s) => (
                    <Card key={s.label} className="border-slate-200 shadow-sm overflow-hidden">
                        <CardContent className="p-5 flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${s.bg}`}>
                                <s.icon size={22} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    {s.label}
                                </p>
                                <p className="text-2xl font-black text-slate-900">{s.value}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <Building2 className="text-indigo-600" size={20} />
                                By department
                            </CardTitle>
                            <CardDescription>Search filters the list below.</CardDescription>
                        </div>
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                className="pl-9 h-10 rounded-xl bg-slate-50 border-slate-200"
                                placeholder="Search name, email, department…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="py-20 flex justify-center">
                            <RefreshCw className="animate-spin text-indigo-600" size={32} />
                        </div>
                    ) : byDept.length === 0 ? (
                        <p className="text-center text-slate-500 py-16 font-medium">
                            No coordinators match your search.
                        </p>
                    ) : (
                        <div className="space-y-10">
                            {byDept.map(({ department, people }) => (
                                <div key={department}>
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className="text-sm font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">
                                            {department}
                                        </span>
                                        <span className="text-xs font-bold text-slate-400">{people.length} coordinator(s)</span>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100 bg-white">
                                        {people.map((row) => {
                                            const revoked = row.accessStatus === "revoked";
                                            return (
                                                <div
                                                    key={row.id}
                                                    className={`p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center gap-4 ${
                                                        revoked ? "bg-amber-50/40" : ""
                                                    }`}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="font-black text-slate-900 truncate">{row.name || "—"}</p>
                                                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                                                                Timetable coordinator
                                                            </span>
                                                            {revoked && (
                                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-200 text-amber-900">
                                                                    Access revoked
                                                                </span>
                                                            )}
                                                            {!row.provisionedBy && (
                                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-50 text-slate-500 border border-slate-200">
                                                                    Self-registered
                                                                </span>
                                                            )}
                                                            {row.provisionedBy && (
                                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-100">
                                                                    Admin provisioned
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500 font-medium">
                                                            <span className="flex items-center gap-1">
                                                                <Mail size={12} />
                                                                {row.email || "—"}
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <Clock size={12} />
                                                                Last active: {formatTs(row.lastActiveAt)}
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <MapPin size={12} />
                                                                Last page: {row.lastVisitedPath || "—"}
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <Activity size={12} />
                                                                Joined: {formatTs(row.createdAt)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2 lg:justify-end shrink-0">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="font-bold rounded-xl"
                                                            onClick={() => {
                                                                setEditOpen(row.id);
                                                                setEditDepartment(row.department || FCOM_DEPARTMENTS[0]);
                                                            }}
                                                        >
                                                            <Pencil size={14} className="mr-1" />
                                                            Dept
                                                        </Button>
                                                        {revoked ? (
                                                            <Button
                                                                size="sm"
                                                                className="font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                                                                disabled={busyId === row.id}
                                                                onClick={() => reactivate(row)}
                                                            >
                                                                {busyId === row.id ? (
                                                                    <RefreshCw size={14} className="animate-spin mr-1" />
                                                                ) : (
                                                                    <ShieldCheck size={14} className="mr-1" />
                                                                )}
                                                                Restore access
                                                            </Button>
                                                        ) : (
                                                            <Button
                                                                size="sm"
                                                                variant="destructive"
                                                                className="font-bold rounded-xl"
                                                                disabled={busyId === row.id}
                                                                onClick={() => revoke(row)}
                                                            >
                                                                {busyId === row.id ? (
                                                                    <RefreshCw size={14} className="animate-spin mr-1" />
                                                                ) : (
                                                                    <ShieldOff size={14} className="mr-1" />
                                                                )}
                                                                Revoke access
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Create modal */}
            {createOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <Card className="w-full max-w-md shadow-2xl border-slate-200 animate-in zoom-in-95">
                        <CardHeader className="border-b border-slate-100 flex flex-row items-center justify-between">
                            <CardTitle className="text-lg font-black">Create coordinator</CardTitle>
                            <button
                                type="button"
                                className="p-2 hover:bg-slate-100 rounded-lg"
                                onClick={() => !creating && setCreateOpen(false)}
                            >
                                <X size={18} />
                            </button>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <form onSubmit={handleCreateCoordinator} className="space-y-4">
                                {createError && (
                                    <p className="text-sm text-red-600 font-medium bg-red-50 p-3 rounded-xl border border-red-100">
                                        {createError}
                                    </p>
                                )}
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400">Full name</label>
                                    <Input
                                        className="mt-1 h-11 rounded-xl"
                                        value={createForm.name}
                                        onChange={(e) =>
                                            setCreateForm((f) => ({ ...f, name: e.target.value }))
                                        }
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400">Email</label>
                                    <Input
                                        type="email"
                                        className="mt-1 h-11 rounded-xl"
                                        value={createForm.email}
                                        onChange={(e) =>
                                            setCreateForm((f) => ({ ...f, email: e.target.value }))
                                        }
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400">
                                        Initial password
                                    </label>
                                    <Input
                                        type="password"
                                        className="mt-1 h-11 rounded-xl"
                                        value={createForm.password}
                                        onChange={(e) =>
                                            setCreateForm((f) => ({ ...f, password: e.target.value }))
                                        }
                                        minLength={6}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400">Department</label>
                                    <select
                                        className="mt-1 w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium"
                                        value={createForm.department}
                                        onChange={(e) =>
                                            setCreateForm((f) => ({ ...f, department: e.target.value }))
                                        }
                                    >
                                        {FCOM_DEPARTMENTS.map((d) => (
                                            <option key={d} value={d}>
                                                {d}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <Button
                                    type="submit"
                                    className="w-full h-12 font-bold bg-[#00008b] hover:bg-[#000060] rounded-xl"
                                    disabled={creating}
                                >
                                    {creating ? (
                                        <>
                                            <RefreshCw className="animate-spin mr-2 h-4 w-4" />
                                            Creating…
                                        </>
                                    ) : (
                                        "Create account"
                                    )}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Edit department modal */}
            {editOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <Card className="w-full max-w-sm shadow-2xl">
                        <CardHeader>
                            <CardTitle className="text-base font-black">Change department</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <select
                                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold"
                                value={editDepartment}
                                onChange={(e) => setEditDepartment(e.target.value)}
                            >
                                {FCOM_DEPARTMENTS.map((d) => (
                                    <option key={d} value={d}>
                                        {d}
                                    </option>
                                ))}
                            </select>
                            <div className="flex gap-2">
                                <Button variant="outline" className="flex-1 font-bold" onClick={() => setEditOpen(null)}>
                                    Cancel
                                </Button>
                                <Button
                                    className="flex-1 font-bold bg-[#579044] hover:bg-[#4a7a3a]"
                                    disabled={busyId === editOpen}
                                    onClick={() => {
                                        const row = coordinators.find((c) => c.id === editOpen);
                                        if (row) saveDepartment(row);
                                    }}
                                >
                                    Save
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default CoordinatorDirectory;
