/**
 * Deterministic clash detection for merging multiple lecture or exam schedules.
 */

function parseLectureDurationHours(d) {
    if (d == null) return 2;
    const s = String(d).replace(/h/i, '').trim();
    const n = parseInt(s, 10);
    return Number.isFinite(n) && n > 0 ? n : 2;
}

function lectureSlotWindow(slot) {
    const start = typeof slot.assignedStart === 'number' ? slot.assignedStart : parseInt(slot.assignedStart, 10);
    const dur = parseLectureDurationHours(slot.duration);
    if (Number.isNaN(start)) return null;
    return {
        day: slot.assignedDay || '',
        start,
        end: start + dur,
        venueId: String(slot.assignedVenue?.id || slot.assignedVenueId || '').trim(),
        lecturer: String(slot.lecturer || '').trim(),
        code: String(slot.code || '').trim(),
        department: String(slot.department || '').trim(),
        label: `${slot.code || '?'} · ${slot.assignedDay || ''} ${start}:00`,
    };
}

function intervalsOverlap(a0, a1, b0, b1) {
    return a0 < b1 && b0 < a1;
}

/**
 * @param {Array<{ label: string, slots: object[] }>} bundles
 * @returns {{ hasClashes: boolean, venueClashes: object[], lecturerClashes: object[] }}
 */
export function analyzeLectureScheduleBundles(bundles) {
    const venueClashes = [];
    const lecturerClashes = [];
    const normBundles = Array.isArray(bundles) ? bundles : [];

    for (let i = 0; i < normBundles.length; i++) {
        const slotsI = (normBundles[i].slots || []).map(lectureSlotWindow).filter(Boolean);
        for (let j = i; j < normBundles.length; j++) {
            const slotsJ = (normBundles[j].slots || []).map(lectureSlotWindow).filter(Boolean);
            for (let ia = 0; ia < slotsI.length; ia++) {
                for (let ib = 0; ib < slotsJ.length; ib++) {
                    if (i === j && ia === ib) continue;
                    const sa = slotsI[ia];
                    const sb = slotsJ[ib];
                    if (sa.day !== sb.day || !sa.day) continue;

                    const vA = sa.venueId.toLowerCase();
                    const vB = sb.venueId.toLowerCase();
                    const isVirtual =
                        !vA || !vB || vA.includes('virtual') || vB.includes('virtual') || vA.includes('online') || vB.includes('online');

                    if (!isVirtual && vA === vB && vA.length > 0 && intervalsOverlap(sa.start, sa.end, sb.start, sb.end)) {
                        venueClashes.push({
                            type: 'venue',
                            day: sa.day,
                            venueId: vA,
                            a: `${normBundles[i].label}: ${sa.label}`,
                            b: `${normBundles[j].label}: ${sb.label}`,
                            fix: 'Move one session to a different room or shift its start time so it does not overlap.',
                        });
                    }

                    const lecA = sa.lecturer;
                    const lecB = sb.lecturer;
                    if (
                        lecA &&
                        lecB &&
                        lecA !== 'TBA' &&
                        lecB !== 'TBA' &&
                        lecA.toLowerCase() === lecB.toLowerCase() &&
                        intervalsOverlap(sa.start, sa.end, sb.start, sb.end)
                    ) {
                        lecturerClashes.push({
                            type: 'lecturer',
                            day: sa.day,
                            lecturer: lecA,
                            a: `${normBundles[i].label}: ${sa.label}`,
                            b: `${normBundles[j].label}: ${sb.label}`,
                            fix: 'Assign a different instructor for one of the sessions or reschedule one course to a non-overlapping slot.',
                        });
                    }
                }
            }
        }
    }

    return {
        hasClashes: venueClashes.length + lecturerClashes.length > 0,
        venueClashes,
        lecturerClashes,
    };
}

function examTimeToMs(dateStr, hhmm) {
    const t = `${dateStr}T${String(hhmm || '09:00').slice(0, 5)}:00`;
    const x = Date.parse(t);
    return Number.isNaN(x) ? null : x;
}

export function normalizePersonTag(s) {
    return String(s || '')
        .toLowerCase()
        .replace(/\./g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

export function examInvigilatorNorms(ex) {
    const raw = ex.invigilatorNames ?? ex.invigilators ?? [];
    const arr = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',').map((x) => x.trim()) : [];
    return [...new Set(arr.map(normalizePersonTag).filter(Boolean))];
}

function examSlotWindow(ex) {
    const startMs = examTimeToMs(ex.date, ex.startTime);
    const dur = parseInt(ex.durationMins, 10) || 90;
    if (startMs == null) return null;
    return {
        date: ex.date,
        startMs,
        endMs: startMs + dur * 60000,
        venueId: String(ex.venueId || '').trim(),
        department: String(ex.department || '').trim(),
        level: String(ex.level || ''),
        code: String(ex.courseCode || '').trim(),
        label: `${ex.courseCode || '?'} · ${ex.date} ${ex.startTime}`,
        invNorms: examInvigilatorNorms(ex),
        blkNorms:
            Array.isArray(ex.invigilateBlockedNorms) && ex.invigilateBlockedNorms.length
                ? new Set(ex.invigilateBlockedNorms.map(normalizePersonTag).filter(Boolean))
                : null,
    };
}

/**
 * @param {Array<{ label: string, exams: object[] }>} bundles
 */
export function analyzeExamScheduleBundles(bundles) {
    const venueClashes = [];
    const levelClashes = [];
    const invigilatorClashes = [];
    const norm = Array.isArray(bundles) ? bundles : [];

    for (let i = 0; i < norm.length; i++) {
        const slotsI = (norm[i].exams || []).map(examSlotWindow).filter(Boolean);
        for (let j = i; j < norm.length; j++) {
            const slotsJ = (norm[j].exams || []).map(examSlotWindow).filter(Boolean);
            for (let ia = 0; ia < slotsI.length; ia++) {
                for (let ib = 0; ib < slotsJ.length; ib++) {
                    if (i === j && ia === ib) continue;
                    const sa = slotsI[ia];
                    const sb = slotsJ[ib];
                    if (sa.date !== sb.date) continue;

                    const vA = sa.venueId.toLowerCase();
                    const vB = sb.venueId.toLowerCase();
                    const isVirtual =
                        !vA || !vB || vA === 'tbh' || vB === 'tbh' || vA.includes('virtual') || vB.includes('virtual');

                    if (!isVirtual && vA === vB && vA.length > 0 && sa.startMs < sb.endMs && sb.startMs < sa.endMs) {
                        venueClashes.push({
                            type: 'venue',
                            date: sa.date,
                            venueId: vA,
                            a: `${norm[i].label}: ${sa.label}`,
                            b: `${norm[j].label}: ${sb.label}`,
                            fix: 'Use another hall or stagger session times on the same date.',
                        });
                    }

                    if (
                        sa.level &&
                        sb.level &&
                        sa.level === sb.level &&
                        sa.department === sb.department &&
                        sa.startMs < sb.endMs &&
                        sb.startMs < sa.endMs
                    ) {
                        levelClashes.push({
                            type: 'cohort',
                            date: sa.date,
                            department: sa.department,
                            level: sa.level,
                            a: `${norm[i].label}: ${sa.label}`,
                            b: `${norm[j].label}: ${sb.label}`,
                            fix: 'Same cohort cannot sit two papers at once — move one exam to another slot or date.',
                        });
                    }

                    if (sa.invNorms.length && sb.invNorms.length && sa.startMs < sb.endMs && sb.startMs < sa.endMs) {
                        const shared = sa.invNorms.filter((n) => sb.invNorms.includes(n));
                        if (shared.length) {
                            invigilatorClashes.push({
                                type: 'invigilator',
                                date: sa.date,
                                invigilator: shared[0],
                                a: `${norm[i].label}: ${sa.label}`,
                                b: `${norm[j].label}: ${sb.label}`,
                                fix: 'Assign different invigilators or reschedule so the same staff member does not overlap.',
                            });
                        }
                    }
                }
            }
        }
    }

    /** Own-exam guard: lecturers must not invigilate a paper for a course they teach */
    const selfInv = [];
    for (const bundle of norm) {
        for (const ex of bundle.exams || []) {
            const norms = examInvigilatorNorms(ex);
            const blk = Array.isArray(ex.invigilateBlockedNorms)
                ? ex.invigilateBlockedNorms.map(normalizePersonTag).filter(Boolean)
                : [];
            if (!norms.length || !blk.length) continue;
            for (const iv of norms) {
                if (blk.includes(iv)) {
                    selfInv.push({
                        type: 'invigilate_teacher',
                        date: String(ex.date || ''),
                        course: String(ex.courseCode || ''),
                        label: `${ex.courseCode || '?'} · ${ex.date} ${ex.startTime}`,
                        fix: 'Remove this lecturer from invigilation for this exam — they teach this offering.',
                    });
                }
            }
        }
    }

    const merged = [...venueClashes, ...levelClashes, ...invigilatorClashes, ...selfInv];
    return {
        hasClashes: merged.length > 0,
        clashes: merged,
        venueClashes,
        levelClashes,
        invigilatorClashes,
        invigilateTeacherClashes: selfInv,
    };
}
