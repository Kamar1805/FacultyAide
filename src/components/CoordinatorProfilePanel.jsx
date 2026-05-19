import React from 'react';
import {
    X,
    Mail,
    Phone,
    MapPin,
    Globe,
    Clock,
    Building2,
    ShieldCheck,
    ShieldOff,
    UserCircle2,
    Bell,
    FileDown,
    Activity,
} from 'lucide-react';
import { Button } from './ui/button';
import { getCoordinatorProfileFields, initialsFromName } from '../utils/coordinatorProfile';

function formatTs(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
        return String(iso);
    }
}

/**
 * Rich profile overlay for admins — coordinator Firestore user doc.
 */
export default function CoordinatorProfilePanel({ userDoc, onClose }) {
    if (!userDoc) return null;
    const p = getCoordinatorProfileFields(userDoc);
    const revoked = p.accessStatus === 'revoked';
    const initials = initialsFromName(p.name);

    return (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <button
                type="button"
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200"
                onClick={onClose}
                aria-label="Close profile"
            />
            <div
                role="dialog"
                aria-modal="true"
                className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-[2rem] sm:rounded-3xl bg-white shadow-2xl border border-slate-200/80 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300"
            >
                <div className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#00008b] via-indigo-800 to-[#579044] opacity-95" />
                    <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/10 blur-3xl -translate-y-1/2 translate-x-1/2" />
                    <div className="relative px-6 pt-8 pb-10 text-white">
                        <button
                            type="button"
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 rounded-xl bg-white/15 hover:bg-white/25 transition-colors"
                        >
                            <X size={20} />
                        </button>
                        <div className="flex items-start gap-4">
                            <div className="h-16 w-16 rounded-2xl bg-white/20 backdrop-blur border border-white/30 flex items-center justify-center text-2xl font-black tracking-tight shadow-lg shrink-0">
                                {initials}
                            </div>
                            <div className="min-w-0 flex-1 pt-1">
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Timetable coordinator</p>
                                <h2 className="text-2xl font-black leading-tight truncate">{p.name || 'Unnamed'}</h2>
                                <p className="text-sm font-semibold text-white/90 flex items-center gap-1.5 mt-1">
                                    <Building2 size={14} className="shrink-0 opacity-80" />
                                    <span className="truncate">{p.department || 'Department'}</span>
                                </p>
                                <div className="flex flex-wrap gap-2 mt-3">
                                    <span
                                        className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                                            revoked ? 'bg-amber-300 text-amber-950' : 'bg-emerald-300/90 text-emerald-950'
                                        }`}
                                    >
                                        {revoked ? <ShieldOff size={12} /> : <ShieldCheck size={12} />}
                                        {revoked ? 'Access revoked' : 'Active'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="px-5 sm:px-6 py-6 space-y-5 -mt-4 relative">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 space-y-3">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Contact</h3>
                        <div className="space-y-2.5">
                            <div className="flex items-start gap-3 text-sm">
                                <Mail className="shrink-0 mt-0.5 text-[#00008b]" size={18} />
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Email</p>
                                    <p className="font-semibold text-slate-800 break-all">{p.email || '—'}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 text-sm">
                                <Phone className="shrink-0 mt-0.5 text-[#579044]" size={18} />
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Phone</p>
                                    <p className="font-semibold text-slate-800">{p.phone || '—'}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 text-sm">
                                <MapPin className="shrink-0 mt-0.5 text-indigo-600" size={18} />
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Office / room</p>
                                    <p className="font-semibold text-slate-800">{p.officeRoom || '—'}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 text-sm">
                                <Globe className="shrink-0 mt-0.5 text-sky-600" size={18} />
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Timezone</p>
                                    <p className="font-semibold text-slate-800">
                                        {(p.timezone || 'Africa/Lagos').replace(/_/g, ' ')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {p.bio ? (
                        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 flex items-center gap-2 mb-2">
                                <UserCircle2 size={14} /> Bio / scope
                            </h3>
                            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{p.bio}</p>
                        </div>
                    ) : null}

                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 mb-1">
                                <Bell size={12} /> Email nudges
                            </div>
                            <p className="text-sm font-bold text-slate-800">{p.notifyEmailCoordinator ? 'On' : 'Off'}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 mb-1">
                                <Bell size={12} /> Weekly digest
                            </div>
                            <p className="text-sm font-bold text-slate-800">{p.notifyWeeklyDigest ? 'On' : 'Off'}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm col-span-2">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 mb-1">
                                <FileDown size={12} /> Default export
                            </div>
                            <p className="text-sm font-bold text-slate-800 uppercase">{p.defaultExportFormat}</p>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2 text-xs">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                            <Activity size={14} /> Activity
                        </h3>
                        <div className="grid gap-1.5 text-slate-600">
                            <p>
                                <span className="font-bold text-slate-500">Profile saved:</span>{' '}
                                {formatTs(p.settingsUpdatedAt)}
                            </p>
                            <p>
                                <span className="font-bold text-slate-500">Last active:</span> {formatTs(p.lastActiveAt)}
                            </p>
                            <p className="flex flex-wrap gap-1">
                                <span className="font-bold text-slate-500">Last page:</span>
                                <code className="text-[11px] bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                    {p.lastVisitedPath || '—'}
                                </code>
                            </p>
                            <p>
                                <span className="font-bold text-slate-500">Joined:</span> {formatTs(p.createdAt)}
                            </p>
                        </div>
                    </div>

                    <Button className="w-full h-12 font-black rounded-xl bg-[#00008b] hover:bg-[#000060]" type="button" onClick={onClose}>
                        Done
                    </Button>
                </div>
            </div>
        </div>
    );
}
