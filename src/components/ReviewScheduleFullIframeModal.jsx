import React, { useMemo } from 'react';
import { X, Expand } from 'lucide-react';
import { Button } from './ui/button';
import { buildReviewScheduleSrcDoc } from '../utils/reviewScheduleHtml';

/**
 * Full-screen iframe preview (isolated scrolling) — open / close overlay.
 */
export default function ReviewScheduleFullIframeModal({ open, onClose, kind, schedule = [], semester, department }) {
    const srcDoc = useMemo(() => buildReviewScheduleSrcDoc(kind === 'exam' ? 'exam' : 'lecture', schedule, { semester, department }), [
        kind,
        schedule,
        semester,
        department,
    ]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[120] flex flex-col animate-in fade-in duration-200">
            <button
                type="button"
                className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
                onClick={onClose}
                aria-label="Close full timetable view"
            />
            <div className="relative m-3 sm:m-6 flex-1 min-h-0 flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-2 duration-300">
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-[#00008b]/95 to-[#1e293b] text-white shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                            <Expand size={20} />
                        </div>
                        <div className="min-w-0">
                            <p className="font-black truncate text-[15px]">Full timetable</p>
                            <p className="text-[11px] text-blue-100/90 truncate font-medium">
                                {kind === 'exam' ? 'Exam' : 'Lecture'} · {department || 'Dept'} · {semester || 'Sem'}{' '}
                                · {Array.isArray(schedule) ? schedule.length : 0} row(s), sorted by level 100→400 where available
                            </p>
                        </div>
                    </div>
                    <Button
                        type="button"
                        variant="secondary"
                        className="shrink-0 font-black rounded-xl bg-white/15 hover:bg-white/25 border-0 text-white"
                        onClick={onClose}
                    >
                        <X size={18} className="mr-1" /> Close
                    </Button>
                </div>
                <iframe
                    title="Submitted timetable — full audit view"
                    className="flex-1 w-full min-h-0 border-0 bg-slate-50"
                    sandbox="allow-same-origin"
                    srcDoc={srcDoc}
                />
                <p className="text-[11px] text-slate-500 px-4 py-2 bg-slate-50 border-t border-slate-100 shrink-0 text-center">
                    Isolated iframe view scrolls independently. Close when finished reviewing.
                </p>
            </div>
        </div>
    );
}
