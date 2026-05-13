import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Bell, Clock, Globe, Loader2, Save, UserRound, FileDown } from 'lucide-react';
import { auth, db } from '../../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

const DEFAULT_PREFS = {
    phone: '',
    officeRoom: '',
    timezone: 'Africa/Lagos',
    bio: '',
    notifyEmailCoordinator: true,
    notifyWeeklyDigest: false,
    defaultExportFormat: 'pdf',
};

const CoordinatorSettings = () => {
    const { userData } = useOutletContext();
    const uid = userData?.uid || auth.currentUser?.uid;
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ name: '', ...DEFAULT_PREFS });

    useEffect(() => {
        let cancelled = false;
        async function load() {
            if (!uid) return;
            setLoading(true);
            try {
                const snap = await getDoc(doc(db, 'users', uid));
                if (cancelled) return;
                const d = snap.exists() ? snap.data() : {};
                const p = typeof d.prefs === 'object' && d.prefs ? d.prefs : {};
                setForm({
                    name: d.name || userData?.name || '',
                    phone: p.phone ?? DEFAULT_PREFS.phone,
                    officeRoom: p.officeRoom ?? DEFAULT_PREFS.officeRoom,
                    timezone: p.timezone ?? DEFAULT_PREFS.timezone,
                    bio: p.bio ?? DEFAULT_PREFS.bio,
                    notifyEmailCoordinator: p.notifyEmailCoordinator ?? DEFAULT_PREFS.notifyEmailCoordinator,
                    notifyWeeklyDigest: p.notifyWeeklyDigest ?? DEFAULT_PREFS.notifyWeeklyDigest,
                    defaultExportFormat: p.defaultExportFormat ?? DEFAULT_PREFS.defaultExportFormat,
                });
            } catch (e) {
                console.error(e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, [uid, userData?.name]);

    const setField = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

    const handleSave = async () => {
        if (!uid) return;
        setSaving(true);
        try {
            const prefs = {
                phone: form.phone.trim(),
                officeRoom: form.officeRoom.trim(),
                timezone: form.timezone,
                bio: form.bio.trim(),
                notifyEmailCoordinator: !!form.notifyEmailCoordinator,
                notifyWeeklyDigest: !!form.notifyWeeklyDigest,
                defaultExportFormat: form.defaultExportFormat,
            };
            await updateDoc(doc(db, 'users', uid), {
                name: form.name.trim(),
                prefs,
                settingsUpdatedAt: new Date().toISOString(),
            });
        } catch (e) {
            console.error(e);
            alert('Could not save settings. Check Firestore permissions.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24 text-slate-500 gap-3 font-bold">
                <Loader2 className="animate-spin" /> Loading preferences…
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500 pb-16">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Profile &amp; Settings</h1>
                <p className="text-slate-500 mt-1">Details used across exports and for admin visibility.</p>
            </div>

            <Card className="border-slate-200 shadow-sm overflow-hidden ring-1 ring-slate-900/5">
                <CardHeader className="border-b bg-slate-50/80">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <UserRound size={22} className="text-indigo-600" /> Academic profile
                    </CardTitle>
                    <CardDescription>Your name appears on dashboards and timetable exports.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 pt-6">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Display name</label>
                        <Input value={form.name} onChange={(e) => setField('name', e.target.value)} className="rounded-xl border-slate-200" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Institutional email</label>
                        <Input value={auth.currentUser?.email || ''} readOnly className="rounded-xl bg-slate-50 text-slate-500" />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Phone</label>
                            <Input value={form.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="+234 …" className="rounded-xl border-slate-200" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Office / room</label>
                            <Input value={form.officeRoom} onChange={(e) => setField('officeRoom', e.target.value)} placeholder="e.g. B12-204" className="rounded-xl border-slate-200" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Bio / notes</label>
                        <textarea
                            value={form.bio}
                            onChange={(e) => setField('bio', e.target.value)}
                            rows={3}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20"
                            placeholder="Short title lines, liaison scope, committees…"
                        />
                    </div>
                </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm overflow-hidden ring-1 ring-slate-900/5">
                <CardHeader className="border-b bg-slate-50/80">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <FileDown size={22} className="text-emerald-600" /> Defaults
                    </CardTitle>
                    <CardDescription>Preferred timetable export behaviour.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 pt-6">
                    <div className="flex items-center gap-3">
                        <Globe size={18} className="text-slate-400 shrink-0" />
                        <div className="flex-1 space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Timezone label</label>
                            <select
                                value={form.timezone}
                                onChange={(e) => setField('timezone', e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium"
                            >
                                <option value="Africa/Lagos">Africa / Lagos</option>
                                <option value="UTC">UTC</option>
                                <option value="Europe/London">Europe / London</option>
                            </select>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Default export format</label>
                        <select
                            value={form.defaultExportFormat}
                            onChange={(e) => setField('defaultExportFormat', e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium"
                        >
                            <option value="pdf">PDF snapshot</option>
                            <option value="json">JSON (machine-readable)</option>
                            <option value="csv">CSV spreadsheet</option>
                        </select>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm overflow-hidden ring-1 ring-slate-900/5">
                <CardHeader className="border-b bg-slate-50/80">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Bell size={22} className="text-amber-500" /> Notifications
                    </CardTitle>
                    <CardDescription>Signals we may use for reminders (stored on your profile).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                    <ToggleRow label="Operational email nudges" desc="Publishing, clashes, approvals — when emailing is wired." checked={form.notifyEmailCoordinator} onCheckedChange={(v) => setField('notifyEmailCoordinator', v)} />
                    <ToggleRow label="Weekly briefing" desc="Optional digest of departmental scheduling changes." checked={form.notifyWeeklyDigest} onCheckedChange={(v) => setField('notifyWeeklyDigest', v)} />
                    <div className="flex items-start gap-2 text-xs text-slate-400">
                        <Clock size={14} className="mt-0.5 shrink-0" />
                        Preference changes sync to Firestore and appear in coordinator activity summaries for admins.
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end gap-3">
                <Button onClick={handleSave} disabled={saving} className="bg-[#00008b] hover:bg-[#000060] text-white rounded-xl px-8 font-black">
                    {saving ? <><Loader2 className="animate-spin mr-2 h-4 w-4 inline" /> Saving…</> : <><Save className="inline mr-2 h-4 w-4" /> Save settings</>}
                </Button>
            </div>

            <p className="text-xs text-center text-slate-400 pb-8">
                Department stays tied to account registration. Contact Faculty IT to change departmental scope.
            </p>
        </div>
    );
};

function ToggleRow({ label, desc, checked, onCheckedChange }) {
    return (
        <button
            type="button"
            className={`w-full flex items-center justify-between p-4 rounded-2xl border text-left transition-all ${checked ? 'border-indigo-200 bg-indigo-50/50' : 'border-slate-100 bg-white hover:border-slate-200'}`}
            onClick={() => onCheckedChange(!checked)}
        >
            <div>
                <div className="font-bold text-slate-800 text-sm">{label}</div>
                <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
            </div>
            <div className={`h-8 w-[52px] rounded-full relative shrink-0 transition-colors ${checked ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                <div className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? 'right-1' : 'left-1'}`} />
            </div>
        </button>
    );
}

export default CoordinatorSettings;
