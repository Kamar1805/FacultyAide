import React from 'react';
import { slotTimeRange, formatExamInvigilatorsCell } from '../utils/timetableExport';
import { sortLectureForReview, sortExamForReview } from '../utils/reviewScheduleHtml';

/** Human-readable timetable for admin review threads (replaces JSON-only previews). */
export default function ReviewThreadSchedulePreview({
    kind = 'lecture',
    schedule = [],
    semester = '',
    department = '',
    conflicts = [],
    /** null = capped scroll area (default audit card); `'none'`/`false`/`0'` = taller inline body */
    maxBodyHeight,
}) {
    const rows = Array.isArray(schedule) ? schedule : [];

    if (!rows.length) {
        return <p className="text-sm text-slate-500 italic py-4 text-center">No schedule attached to this submission.</p>;
    }

    const metaLine = [
        department && `Dept: ${department}`,
        semester && `Semester: ${semester}`,
        Array.isArray(conflicts) && conflicts.length ? `${conflicts.length} flagged conflict(s)` : null,
    ]
        .filter(Boolean)
        .join(' · ');

    const bodyScrollClass =
        maxBodyHeight === null || maxBodyHeight === false || maxBodyHeight === 'none' || maxBodyHeight === 0
            ? 'max-h-[min(720px,75vh)] overflow-auto'
            : 'max-h-[min(420px,55vh)] overflow-auto';

    if (kind === 'exam') {
        const sorted = sortExamForReview(rows);
        return (
            <div className="rounded-xl border border-indigo-200 bg-white overflow-hidden shadow-sm">
                {metaLine ? (
                    <div className="px-4 py-2 text-[11px] font-semibold text-indigo-900 bg-indigo-50 border-b border-indigo-100">
                        {metaLine} · Sorted by date · level · code
                    </div>
                ) : null}
                <div className={bodyScrollClass}>
                    <table className="w-full text-xs text-left border-collapse min-w-[800px]">
                        <thead className="sticky top-0 bg-indigo-950 text-white z-10 shadow-sm">
                            <tr className="uppercase tracking-wider text-[10px] font-black">
                                <th className="p-3 border-b border-indigo-800 whitespace-nowrap">Level</th>
                                <th className="p-3 border-b border-indigo-800">Code</th>
                                <th className="p-3 border-b border-indigo-800">Course</th>
                                <th className="p-3 border-b border-indigo-800 text-center whitespace-nowrap">Date</th>
                                <th className="p-3 border-b border-indigo-800 text-center">Session</th>
                                <th className="p-3 border-b border-indigo-800 text-center whitespace-nowrap">Start</th>
                                <th className="p-3 border-b border-indigo-800 text-center">Mins</th>
                                <th className="p-3 border-b border-indigo-800">Venue</th>
                                <th className="p-3 border-b border-indigo-800">Invigilators</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sorted.map((ex, i) => (
                                <tr key={`${ex.courseCode}-${ex.date}-${ex.startTime}-${i}`} className="bg-white hover:bg-indigo-50/40">
                                    <td className="p-3 font-bold text-indigo-800 whitespace-nowrap">{ex.level ?? ''}</td>
                                    <td className="p-3 font-black text-slate-900">{ex.courseCode || ''}</td>
                                    <td className="p-3 text-slate-700 font-semibold max-w-[220px] leading-snug">{ex.courseTitle || ''}</td>
                                    <td className="p-3 text-center font-bold text-slate-800 whitespace-nowrap">
                                        {ex.date
                                            ? new Date(ex.date).toLocaleDateString(undefined, {
                                                  weekday: 'short',
                                                  month: 'short',
                                                  day: 'numeric',
                                              })
                                            : ''}
                                    </td>
                                    <td className="p-3 text-center text-slate-600">{ex.session || '—'}</td>
                                    <td className="p-3 text-center font-bold text-indigo-700">{ex.startTime || ''}</td>
                                    <td className="p-3 text-center text-slate-600">{ex.durationMins ?? '—'}</td>
                                    <td className="p-3 text-slate-700">{ex.venueName || ''}</td>
                                    <td className="p-3 text-slate-600 max-w-[200px] text-[11px] leading-snug">
                                        {formatExamInvigilatorsCell(ex) || '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    const sorted = sortLectureForReview(rows);

    return (
        <div className="rounded-xl border border-emerald-200 bg-white overflow-hidden shadow-sm">
            {metaLine ? (
                <div className="px-4 py-2 text-[11px] font-semibold text-emerald-900 bg-emerald-50 border-b border-emerald-100">
                    {metaLine} · Rows sorted by level 100→400, then weekday &amp; time
                </div>
            ) : null}
            <div className={bodyScrollClass}>
                <table className="w-full text-xs text-left border-collapse min-w-[820px]">
                    <thead className="sticky top-0 bg-slate-900 text-white z-10 shadow-sm">
                        <tr className="uppercase tracking-wider text-[10px] font-black">
                            <th className="p-3 border-b border-slate-700 text-center whitespace-nowrap">Lvl</th>
                            <th className="p-3 border-b border-slate-700">Code</th>
                            <th className="p-3 border-b border-slate-700">Course</th>
                            <th className="p-3 border-b border-slate-700 text-center whitespace-nowrap">Time</th>
                            <th className="p-3 border-b border-slate-700 text-center">Day</th>
                            <th className="p-3 border-b border-slate-700">Venue</th>
                            <th className="p-3 border-b border-slate-700">Lecturer</th>
                            <th className="p-3 border-b border-slate-700 text-center whitespace-nowrap">Hours</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {sorted.map((s, i) => (
                            <tr key={`${s.code}-${s.assignedDay}-${s.assignedStart}-${i}`} className="bg-white hover:bg-emerald-50/30">
                                <td className="p-3 text-center font-black text-emerald-800">{s.level ?? ''}</td>
                                <td className="p-3 font-black text-slate-900">{s.code || ''}</td>
                                <td className="p-3 text-slate-700 font-semibold max-w-[260px] leading-snug">{s.title || ''}</td>
                                <td className="p-3 text-center font-bold text-indigo-700 whitespace-nowrap">{slotTimeRange(s)}</td>
                                <td className="p-3 text-center font-semibold text-slate-800">{s.assignedDay || '—'}</td>
                                <td className="p-3 text-slate-700">{s.assignedVenue?.name || s.assignedVenueName || '—'}</td>
                                <td className="p-3 text-slate-600">{s.lecturer || 'TBA'}</td>
                                <td className="p-3 text-center text-slate-600">{s.duration ?? ''}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
