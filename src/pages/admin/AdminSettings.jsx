import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Shield, Loader2, Save, Bell, Building2 } from 'lucide-react';
import { auth, db } from '../../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { logActivity } from '../../utils/activityLog';

const AdminSettings = () => {
    const uid = auth.currentUser?.uid;
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [email, setEmail] = useState('');
    const [form, setForm] = useState({
        name: '',
        institutionLabel: 'Nile University',
        escalationPhone: '',
        notifyPublishing: true,
        notifySecurityAlerts: true,
        retentionWeeksAudit: '8',
        themeAccent: '#00008b',
    });

    useEffect(() => {
        let cancelled = false;
        async function load() {
            const u = auth.currentUser;
            if (!uid || !u) return;
            setEmail(u.email || '');
            setLoading(true);
            try {
                const snap = await getDoc(doc(db, 'users', uid));
                const d = snap.exists() ? snap.data() : {};
                const prefs = typeof d.prefs === 'object' ? d.prefs : {};
                if (cancelled) return;
                setForm({
                    name: d.name || 'Administrator',
                    institutionLabel: prefs.institutionLabel || 'Nile University',
                    escalationPhone: prefs.escalationPhone || '',
                    notifyPublishing: prefs.notifyPublishing ?? true,
                    notifySecurityAlerts: prefs.notifySecurityAlerts ?? true,
                    retentionWeeksAudit: String(prefs.retentionWeeksAudit ?? '8'),
                    themeAccent: prefs.themeAccent || '#00008b',
                });
            } catch (e) {
                console.error(e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, [uid]);

    const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const handleSave = async () => {
        if (!uid) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, 'users', uid), {
                name: form.name.trim(),
                prefs: {
                    institutionLabel: form.institutionLabel.trim(),
                    escalationPhone: form.escalationPhone.trim(),
                    notifyPublishing: !!form.notifyPublishing,
                    notifySecurityAlerts: !!form.notifySecurityAlerts,
                    retentionWeeksAudit: Number(form.retentionWeeksAudit) || 8,
                    themeAccent: form.themeAccent,
                },
                settingsUpdatedAt: new Date().toISOString(),
            });
            await logActivity(db, {
                uid,
                userName: form.name,
                userRole: 'admin',
                action: 'admin_settings_saved',
                path: '/admin/settings',
                meta: { institutionLabel: form.institutionLabel },
            });
        } catch (e) {
            console.error(e);
            alert('Could not save admin settings.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24 text-slate-500 gap-3 font-bold">
                <Loader2 className="animate-spin" /> Loading…
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Administrator settings</h1>
                <p className="text-slate-500 mt-1">Institution labels, signalling preferences, and profile details.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Building2 size={22} /> Profile &amp; organisation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Display name</label>
                        <Input className="mt-1 rounded-xl" value={form.name} onChange={(e) => setField('name', e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Email</label>
                        <Input className="mt-1 rounded-xl bg-slate-50" readOnly value={email} />
                    </div>
                    <div>
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Institution banner label</label>
                        <Input className="mt-1 rounded-xl" placeholder="Shown in admin overview copy" value={form.institutionLabel} onChange={(e) => setField('institutionLabel', e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Duty phone (escalation)</label>
                        <Input className="mt-1 rounded-xl" value={form.escalationPhone} onChange={(e) => setField('escalationPhone', e.target.value)} />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Bell size={22} /> Signal preferences</CardTitle>
                    <CardDescription>Reserved for integrations (email/Pager). Stored for future rollout.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <label className="flex items-start gap-3 cursor-pointer rounded-xl border p-4">
                        <input type="checkbox" className="mt-1 accent-indigo-600" checked={form.notifyPublishing} onChange={(e) => setField('notifyPublishing', e.target.checked)} />
                        <span>
                            <span className="font-bold block">Coordinator publishing</span>
                            <span className="text-sm text-slate-500">When timetables are published to the catalogue.</span>
                        </span>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer rounded-xl border p-4">
                        <input type="checkbox" className="mt-1 accent-indigo-600" checked={form.notifySecurityAlerts} onChange={(e) => setField('notifySecurityAlerts', e.target.checked)} />
                        <span>
                            <span className="font-bold block">Account anomaly hints</span>
                            <span className="text-sm text-slate-500">Synthetic toggles mapped to SSO webhooks later.</span>
                        </span>
                    </label>
                    <div>
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Audit horizon (weeks)</label>
                        <Input type="number" min="1" className="mt-1 max-w-[120px] rounded-xl" value={form.retentionWeeksAudit} onChange={(e) => setField('retentionWeeksAudit', e.target.value)} />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Shield size={22} /> Brand tint</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4">
                        <input type="color" value={form.themeAccent} onChange={(e) => setField('themeAccent', e.target.value)} className="h-12 w-16 rounded-xl border cursor-pointer bg-white" />
                        <p className="text-sm text-slate-600">Accent reference for dashboards (non-destructive; stored on profile).</p>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving} className="rounded-xl px-10 font-black bg-[#00008b] hover:bg-[#000060] text-white">
                    {saving ? <Loader2 className="animate-spin h-5 w-5 inline" /> : <><Save className="inline mr-2 h-4 w-4" /> Persist changes</>}
                </Button>
            </div>
        </div>
    );
};

export default AdminSettings;
