import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Play, Calendar, Download, RefreshCw, Filter, ShieldCheck, Users, MapPin, Save, AlertTriangle, Clock, Edit3, MessageSquare, GripVertical, FileJson, Sheet, ChevronDown, Mail } from 'lucide-react';
import InstructionGuide from '../../components/InstructionGuide';
import { collection, getDocs, addDoc, Timestamp, doc, updateDoc, deleteField, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { logActivity } from '../../utils/activityLog';
import { useOutletContext, useSearchParams, useNavigate } from 'react-router-dom';
import {
    analyzeExamScheduleBundles,
    normalizePersonTag,
    examInvigilatorNorms,
} from '../../utils/timetableClashAnalysis';
import { createReviewThread, addThreadMessage, getReviewThread, markCoordinatorCaughtUp } from '../../services/timetableReviews';
import OptionalNoteToAdminsModal from '../../components/OptionalNoteToAdminsModal';
import {
    downloadExamScheduleCsv,
    downloadExamScheduleJson,
    downloadExamSchedulePdf,
    downloadExamStaffPersonalPdfInteractive,
    filterScheduleByLevel,
    collectExamStaffOptions,
    filterExamScheduleByStaffNorm,
} from '../../utils/timetableExport';
import {
    invigilatorsRequiredForVenueCapacity,
    venueEligibleForWrittenExam,
    coursePassesExamGeneratorGate,
    lecturerEligibleForExamInvigilationByTitle,
    invigilatorDisplayNameIndicatesExcludedSeniority,
} from '../../utils/examScheduleRules';

function parseExamStartMs(dateStr, hhmm) {
    const t = `${dateStr}T${String(hhmm || '09:00').slice(0, 5)}:00`;
    const x = Date.parse(t);
    return Number.isNaN(x) ? null : x;
}

function examIntervalsOverlap(exA, exB) {
    if (!exA || !exB || exA.date !== exB.date) return false;
    const ma = parseExamStartMs(exA.date, exA.startTime);
    const mb = parseExamStartMs(exB.date, exB.startTime);
    if (ma == null || mb == null) return false;
    const da = (parseInt(exA.durationMins, 10) || 90) * 60000;
    const db = (parseInt(exB.durationMins, 10) || 90) * 60000;
    return ma < mb + db && mb < ma + da;
}

function examPairHardClash(exA, exB) {
    if (!examIntervalsOverlap(exA, exB)) return false;
    const vidA = String(exA.venueId || '');
    const vidB = String(exB.venueId || '');
    const tangible = vidA && vidB && vidA !== 'TBH' && vidB !== 'TBH';
    if (tangible && vidA === vidB) return true;
    if (String(exA.department || '') === String(exB.department || '') && String(exA.level || '') === String(exB.level || ''))
        return true;
    return false;
}

function candidateClashesBuckets(candidate, internal, externalFlat) {
    for (const ex of externalFlat) {
        if (examPairHardClash(candidate, ex)) return true;
    }
    for (const ex of internal) {
        if (examPairHardClash(candidate, ex)) return true;
    }
    return false;
}

function formatLocalYmd(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function defaultEndDateFromStart(startYmd) {
    try {
        const d = new Date(`${startYmd}T12:00:00`);
        d.setDate(d.getDate() + 28);
        return formatLocalYmd(d);
    } catch {
        return startYmd;
    }
}

function parseLectureDurationHours(d) {
    if (d == null) return 2;
    const s = String(d).replace(/h/i, '').trim();
    const n = parseInt(s, 10);
    return Number.isFinite(n) && n > 0 ? n : 2;
}

function examStartToMinutes(startTimeStr) {
    const p = String(startTimeStr || '09:00').slice(0, 5).split(':');
    const h = parseInt(p[0], 10) || 0;
    const m = parseInt(p[1] || '0', 10) || 0;
    return h * 60 + m;
}

function minutesOverlap(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
}

const WEEK_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function weekdayKeyFromExamYmd(examYmd) {
    const d = new Date(`${examYmd}T12:00:00`);
    return WEEK_KEYS[d.getDay()];
}

function assignedDayMatchesExamDate(assignedDay, examYmd) {
    const k = String(assignedDay || '')
        .trim()
        .toLowerCase()
        .replace(/\.$/, '');
    return k === weekdayKeyFromExamYmd(examYmd);
}

function lecturerDisplayFromRecord(l) {
    const t = String(l?.title ?? '').trim();
    const n = String(l?.name ?? '').trim();
    if (!t) return n || '';
    const title = t.endsWith('.') ? t : `${t}.`;
    return `${title} ${n}`.trim();
}

function lectureSlotBlocksInvigilatorTime(slot, examDateYmd, examStartTime, durationMins) {
    const lec = normalizePersonTag(slot?.lecturer);
    if (!lec || lec === normalizePersonTag('TBA')) return false;
    if (!assignedDayMatchesExamDate(slot?.assignedDay, examDateYmd)) return false;
    const durH = parseLectureDurationHours(slot?.duration);
    const startHour = typeof slot?.assignedStart === 'number' ? slot.assignedStart : parseInt(slot?.assignedStart, 10);
    const sh = Number.isFinite(startHour) ? startHour : 0;
    const slotStartMin = sh * 60;
    const slotEndMin = slotStartMin + durH * 60;
    const exStartMin = examStartToMinutes(examStartTime);
    const exEndMin = exStartMin + (parseInt(durationMins, 10) || 90);
    return minutesOverlap(slotStartMin, slotEndMin, exStartMin, exEndMin);
}

/** Norms that must NOT invigilate this paper — from course lecturer fields only. */
function invigilateBlockedNormsFromCourse(courseDoc) {
    const norms = [];
    const add = (s) => {
        const z = normalizePersonTag(s);
        if (z) norms.push(z);
    };
    if (courseDoc?.lecturer) add(courseDoc.lecturer);
    if (courseDoc?.sectionLecturers && typeof courseDoc.sectionLecturers === 'object') {
        for (const v of Object.values(courseDoc.sectionLecturers)) add(v);
    }
    return [...new Set(norms)];
}

/** Normalized tags for lecturers who must never appear as invigilators (auto or manual picker). */
function excludedInvigilatorNormSet(deptLecturers) {
    const set = new Set();
    for (const l of deptLecturers || []) {
        if (lecturerEligibleForExamInvigilationByTitle(l)) continue;
        const dn = normalizePersonTag(lecturerDisplayFromRecord(l));
        if (dn) set.add(dn);
    }
    return set;
}

/** Replace excluded staff names with placeholders (fixes legacy schedules and stray assignments). */
function stripDisallowedInvigilatorsFromNames(invigilatorNames, deptLecturers) {
    if (!Array.isArray(invigilatorNames) || invigilatorNames.length === 0) return invigilatorNames;
    const excluded = excludedInvigilatorNormSet(deptLecturers);
    const total = invigilatorNames.length;

    return invigilatorNames.map((nm, ix) => {
        if (typeof nm !== 'string') return nm;
        const trimmed = nm.trim();
        const z = normalizePersonTag(trimmed);
        if (!z || z === normalizePersonTag('TBA')) return nm;

        const placeholder = `TBA (${ix + 1}/${total} — senior faculty excluded)`;

        if (excluded.has(z)) return placeholder;

        if (invigilatorDisplayNameIndicatesExcludedSeniority(trimmed)) return placeholder;
        return nm;
    });
}

function invigilatorLoadBalanceWeight(title, name) {
    const blob = `${title ?? ''} ${name ?? ''}`.toLowerCase();
    const isDr = /\b(dr\.?|doctor)\b/i.test(blob);
    return isDr ? 0.35 : 1;
}

function assignInvigilatorsForExam({
    assignedCount,
    probe,
    courseDoc,
    deptLecturers,
    lectureSlotsPublished,
    internalPlacedExams,
    externalExamRows,
    pickCountsRef,
}) {
    const blockedTeaching = new Set(invigilateBlockedNormsFromCourse(courseDoc));
    const counts = pickCountsRef || {};

    function baseBusyNorms() {
        const busy = new Set();
        for (const ex of internalPlacedExams) {
            if (!examIntervalsOverlap(probe, ex)) continue;
            for (const n of examInvigilatorNorms(ex)) busy.add(n);
        }
        for (const ex of externalExamRows) {
            if (!examIntervalsOverlap(probe, ex)) continue;
            for (const n of examInvigilatorNorms(ex)) busy.add(n);
        }
        for (const slot of lectureSlotsPublished) {
            if (lectureSlotBlocksInvigilatorTime(slot, probe.date, probe.startTime, probe.durationMins)) {
                const n = normalizePersonTag(slot?.lecturer);
                if (n && n !== normalizePersonTag('TBA')) busy.add(n);
            }
        }
        return busy;
    }

    const chosen = [];
    for (let k = 0; k < assignedCount; k++) {
        const busy = baseBusyNorms();
        for (const v of chosen) busy.add(normalizePersonTag(v));

        const pool = deptLecturers.filter((l) => {
            if (!lecturerEligibleForExamInvigilationByTitle(l)) return false;
            const dn = normalizePersonTag(lecturerDisplayFromRecord(l));
            if (!dn) return false;
            if (blockedTeaching.has(dn)) return false;
            if (busy.has(dn)) return false;
            return true;
        });

        if (pool.length === 0) {
            chosen.push(`TBA (assign manually ${k + 1}/${assignedCount})`);
            continue;
        }

        let totalW = 0;
        const weights = pool.map((l) => {
            const dn = normalizePersonTag(lecturerDisplayFromRecord(l));
            const w =
                invigilatorLoadBalanceWeight(l.title, l.name) /
                (1 + 0.5 * (counts[dn] ?? 0));
            totalW += w;
            return w;
        });
        let r = Math.random() * totalW;
        let idx = pool.length - 1;
        for (let i = 0; i < pool.length; i++) {
            r -= weights[i];
            if (r <= 0) {
                idx = i;
                break;
            }
        }
        const picked = lecturerDisplayFromRecord(pool[idx]);
        chosen.push(picked);
        const pn = normalizePersonTag(picked);
        counts[pn] = (counts[pn] ?? 0) + 1;
    }

    return chosen;
}

function aggregateExamConflicts(draft, externalFlat) {
    const raw = analyzeExamScheduleBundles([
        { label: 'This timetable', exams: draft || [] },
        { label: 'Other departments (admin-published only)', exams: externalFlat || [] },
    ]);
    if (!raw.hasClashes) return [];
    return raw.clashes.map((c) => {
        if (c.type === 'venue') return `VENUE clash: ${c.a} ↔ ${c.b}. Suggested fix: ${c.fix}`;
        if (c.type === 'cohort') return `COHORT clash: ${c.a} ↔ ${c.b}. Suggested fix: ${c.fix}`;
        if (c.type === 'invigilator')
            return `INVIGILATOR clash: ${c.invigilator} double-booked — ${c.a} vs ${c.b}. Suggested fix: ${c.fix}`;
        if (c.type === 'invigilate_teacher')
            return `INVIGILATION rule: teacher listed for "${c.course}" cannot invigilate that paper (${c.date}). Fix: ${c.fix}`;
        return `${String(c.type).toUpperCase()}: ${c.a || ''}${c.b ? ` ↔ ${c.b}` : ''}. Fix: ${c.fix}`;
    });
}

const ExamTimetable = () => {
    const { userData } = useOutletContext();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const reviewThreadId = searchParams.get('reviewThread');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [timetable, setTimetable] = useState(null);
    const [generationStats, setGenerationStats] = useState({ totalExams: 0, startDate: '', endDate: '' });

    const [config, setConfig] = useState(() => {
        const s = new Date();
        s.setDate(s.getDate() + 7);
        const startDate = formatLocalYmd(s);
        return {
            startDate,
            endDate: defaultEndDateFromStart(startDate),
            semester: 'First',
            morningStart: '09:00',
            afternoonStart: '14:00',
            assignInvigilatorsOnGenerate: false,
        };
    });

    const [examExportOpen, setExamExportOpen] = useState(false);
    const [examExportLevel, setExamExportLevel] = useState('100');
    const [examStaffViewNorm, setExamStaffViewNorm] = useState('');

    const [venues, setVenues] = useState([]);
    const [conflicts, setConflicts] = useState([]);
    const [draggedExamId, setDraggedExamId] = useState(null);
    const [editingExamId, setEditingExamId] = useState(null);
    const [editForm, setEditForm] = useState(null);
    const [sendingReview, setSendingReview] = useState(false);
    const [adminNoteModalOpen, setAdminNoteModalOpen] = useState(false);
    const [examDraftId, setExamDraftId] = useState(null);
    const [examApprovalOk, setExamApprovalOk] = useState(false);

    const [externalExamRows, setExternalExamRows] = useState([]);
    const [deptLecturers, setDeptLecturers] = useState([]);
    const [departmentCoursesById, setDepartmentCoursesById] = useState({});
    const [publishedLectureSlots, setPublishedLectureSlots] = useState([]);
    const [draggedInvExamId, setDraggedInvExamId] = useState(null);

    const invigilatorPickPool = useMemo(
        () => (deptLecturers || []).filter(lecturerEligibleForExamInvigilationByTitle),
        [deptLecturers],
    );

    const examStaffPickOptions = useMemo(() => collectExamStaffOptions(timetable || []), [timetable]);

    const examTimetableForStaffView = useMemo(() => {
        if (!examStaffViewNorm) return timetable || [];
        return filterExamScheduleByStaffNorm(timetable || [], examStaffViewNorm);
    }, [timetable, examStaffViewNorm]);

    const selectedExamStaffLabel =
        examStaffPickOptions.find((o) => o.norm === examStaffViewNorm)?.label || '';

    const selectedExamStaffEmail = useMemo(() => {
        if (!examStaffViewNorm || !deptLecturers.length) return '';
        for (const l of deptLecturers) {
            const d = lecturerDisplayFromRecord(l);
            if (normalizePersonTag(d) === examStaffViewNorm) return String(l.email || '').trim();
        }
        return '';
    }, [examStaffViewNorm, deptLecturers]);

    useEffect(() => {
        setTimetable((prev) => {
            if (!prev?.length || !deptLecturers.length) return prev;
            let changed = false;
            const next = prev.map((ex) => {
                const names = ex.invigilatorNames;
                if (!Array.isArray(names) || !names.length) return ex;
                const cleaned = stripDisallowedInvigilatorsFromNames([...names], deptLecturers);
                const same =
                    cleaned.length === names.length && cleaned.every((v, i) => v === names[i]);
                if (same) return ex;
                changed = true;
                return {
                    ...ex,
                    invigilatorNames: cleaned,
                    invigilatorsAssigned: cleaned.length,
                };
            });
            return changed ? next : prev;
        });
    }, [deptLecturers]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const snap = await getDocs(collection(db, 'saved_timetables'));
                const flat = [];
                snap.docs.forEach((d) => {
                    const t = d.data();
                    if (t.published !== true) return;
                    for (const row of t.schedule || []) flat.push(row);
                });
                if (!cancelled) setPublishedLectureSlots(flat);
            } catch (e) {
                console.error(e);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const dept = String(userData?.department || '').trim();
            if (!dept) {
                setDeptLecturers([]);
                setDepartmentCoursesById({});
                return;
            }
            try {
                const [lectSnap, courseSnap] = await Promise.all([
                    getDocs(collection(db, 'lecturers')),
                    getDocs(collection(db, 'courses')),
                ]);
                if (cancelled) return;
                const lec = lectSnap.docs
                    .map((d) => ({ id: d.id, ...d.data() }))
                    .filter((l) => String(l.department || '').trim() === dept);
                const cmap = {};
                courseSnap.docs.forEach((d) => {
                    const c = { id: d.id, ...d.data() };
                    if (String(c.department || '').trim() !== dept) return;
                    cmap[d.id] = c;
                });
                setDeptLecturers(lec);
                setDepartmentCoursesById(cmap);
            } catch (e) {
                console.error(e);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [userData?.department]);

    useEffect(() => {
        setTimetable((prev) => {
            if (!prev?.length || !Object.keys(departmentCoursesById).length) return prev;
            let changed = false;
            const next = prev.map((ex) => {
                if (Array.isArray(ex.invigilateBlockedNorms) && ex.invigilateBlockedNorms.length) return ex;
                const blk = invigilateBlockedNormsFromCourse(departmentCoursesById[ex.id] || {});
                if (!blk.length) return ex;
                changed = true;
                return { ...ex, invigilateBlockedNorms: blk };
            });
            return changed ? next : prev;
        });
    }, [departmentCoursesById]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!examDraftId) {
                setExamApprovalOk(false);
                return;
            }
            try {
                const ds = await getDoc(doc(db, 'exam_timetables', examDraftId));
                if (cancelled || !ds.exists()) {
                    setExamApprovalOk(false);
                    return;
                }
                const d = ds.data();
                if (!d?.lastReviewThreadId) {
                    setExamApprovalOk(false);
                    return;
                }
                const th = await getReviewThread(d.lastReviewThreadId);
                if (!cancelled) setExamApprovalOk(th?.publishApproved === true);
            } catch {
                if (!cancelled) setExamApprovalOk(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [examDraftId]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!userData?.department) return;
            try {
                const snap = await getDocs(collection(db, 'exam_timetables'));
                const flat = [];
                snap.docs.forEach((docSnap) => {
                    const t = docSnap.data();
                    if (t.published !== true) return;
                    if (String(t.department || '') === String(userData.department || '')) return;
                    for (const row of t.schedule || []) flat.push(row);
                });
                if (!cancelled) setExternalExamRows(flat);
            } catch (e) {
                console.error(e);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [userData?.department]);

    useEffect(() => {
        if (!timetable?.length) {
            setConflicts([]);
            return;
        }
        setConflicts(aggregateExamConflicts(timetable, externalExamRows));
    }, [timetable, externalExamRows]);

    useEffect(() => {
        if (!reviewThreadId || !userData?.uid) return undefined;
        let cancelled = false;
        (async () => {
            try {
                const t = await getReviewThread(reviewThreadId);
                if (cancelled) return;
                if (!t || t.coordinatorUid !== userData.uid) {
                    if (t && t.coordinatorUid !== userData.uid) {
                        alert('This review thread belongs to another coordinator.');
                    }
                    setSearchParams((p) => {
                        p.delete('reviewThread');
                        return p;
                    }, { replace: true });
                    return;
                }
                if ((t.kind || 'lecture') === 'lecture') {
                    navigate(`/coordinator/lecture-timetable?reviewThread=${reviewThreadId}`, { replace: true });
                    return;
                }
                const snap = t.snapshot || {};
                const sched = Array.isArray(snap.schedule) ? [...snap.schedule] : [];
                setTimetable(sched);
                if (snap.stats && typeof snap.stats === 'object') {
                    setGenerationStats(snap.stats);
                }
                if (snap.semester === 'First' || snap.semester === 'Second') {
                    setConfig((c) => ({ ...c, semester: snap.semester }));
                }
                markCoordinatorCaughtUp(reviewThreadId).catch(() => {});
                setExamDraftId(t.linkedExamTimetableId || null);
                setSearchParams((p) => {
                    p.delete('reviewThread');
                    return p;
                }, { replace: true });
            } catch (e) {
                console.error(e);
                alert('Could not load this review thread. Check Firestore rules and that you are signed in as the coordinator who submitted it.');
                setSearchParams((p) => {
                    p.delete('reviewThread');
                    return p;
                }, { replace: true });
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [reviewThreadId, userData?.uid, navigate, setSearchParams]);

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            if (!config.startDate || !config.endDate || config.startDate > config.endDate) {
                alert('Choose a valid exam period: start date on or before end date.');
                setIsGenerating(false);
                return;
            }

            const coursesSnapshot = await getDocs(collection(db, 'courses'));
            const venuesSnapshot = await getDocs(collection(db, 'venues'));
            
            let allCourses = coursesSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
            const allVenues = venuesSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })).filter((v) => v.status !== 'maintenance');
            setVenues(allVenues);

            allCourses = allCourses.filter((c) => c.semester === config.semester || !c.semester);
            const deptCourses = allCourses.filter(
                (c) => String(c.department || '') === String(userData?.department || '') && coursePassesExamGeneratorGate(c)
            );

            if (deptCourses.length === 0) {
                alert(
                    userData?.department
                        ? `No schedulable ${config.semester} written exams for "${userData.department}" (check lab/practical/online courses, exclusions, or "exclude from exam" flags).`
                        : 'No courses for your department.'
                );
                setIsGenerating(false);
                return;
            }

            const extSnap = await getDocs(collection(db, 'exam_timetables'));
            const externalFlat = [];
            extSnap.docs.forEach((docSnap) => {
                const t = docSnap.data();
                if (t.published !== true) return;
                if (String(t.department || '') === String(userData?.department || '')) return;
                for (const row of t.schedule || []) externalFlat.push(row);
            });
            setExternalExamRows(externalFlat);

            const bumpDay = (d) => {
                const nd = new Date(d);
                nd.setDate(nd.getDate() + 1);
                if (nd.getDay() === 6) nd.setDate(nd.getDate() + 2);
                else if (nd.getDay() === 0) nd.setDate(nd.getDate() + 1);
                return nd;
            };

            const generatedExams = [];
            let cursor = new Date(`${config.startDate}T12:00:00`);
            let session = 'Morning';
            const queue = [...deptCourses].sort((a, b) => a.level - b.level);
            const pickCountsRef = {};

            outer: while (queue.length > 0) {
                const course = queue.shift();
                const units = parseInt(course.creditUnit, 10) || 2;
                const durationMins = units === 3 ? 120 : units >= 4 ? 150 : units === 1 ? 60 : 90;

                let placed = false;
                let tries = 0;
                while (!placed && tries < 3200) {
                    tries++;
                    const dateString = formatLocalYmd(cursor);
                    if (dateString > config.endDate) {
                        break;
                    }
                    const startTime = session === 'Morning' ? config.morningStart : config.afternoonStart;

                    const deptVRaw = allVenues.filter((v) => v.dept === course.department);
                    const genVRaw = allVenues.filter((v) => v.dept === 'General');
                    const deptV = deptVRaw.filter(venueEligibleForWrittenExam);
                    const genV = genVRaw.filter(venueEligibleForWrittenExam);

                    let pool =
                        deptV.length > 0
                            ? [...deptV]
                            : [...genV, ...allVenues.filter((x) => !genVRaw.some((g) => g.id === x.id) && venueEligibleForWrittenExam(x))];
                    if (pool.length === 0) pool = allVenues.filter(venueEligibleForWrittenExam);
                    if (pool.length === 0) pool = [{ id: 'TBH', name: 'TBA', capacity: 50 }];
                    pool = [...pool].sort(() => Math.random() - 0.5);

                    for (const assignedVenue of pool) {
                        const need = invigilatorsRequiredForVenueCapacity(assignedVenue.capacity);
                        const probe = { date: dateString, startTime, durationMins };
                        const invigilateBlockedNorms = invigilateBlockedNormsFromCourse(course);
                        let invigilatorNames =
                            config.assignInvigilatorsOnGenerate
                                ? assignInvigilatorsForExam({
                                      assignedCount: need,
                                      probe,
                                      courseDoc: course,
                                      deptLecturers,
                                      lectureSlotsPublished: publishedLectureSlots,
                                      internalPlacedExams: generatedExams,
                                      externalExamRows: externalFlat,
                                      pickCountsRef,
                                  })
                                : [];
                        if (invigilatorNames?.length)
                            invigilatorNames = stripDisallowedInvigilatorsFromNames(invigilatorNames, deptLecturers);

                        const candidate = {
                            id: course.id,
                            courseCode: course.code,
                            courseTitle: course.title,
                            department: course.department,
                            level: course.level,
                            creditUnit: course.creditUnit || 2,
                            durationMins,
                            venueId: assignedVenue.id,
                            venueName: assignedVenue.name,
                            venueCapacity: assignedVenue.capacity,
                            date: dateString,
                            startTime,
                            session,
                            invigilatorsAssigned: need,
                            invigilatorNames,
                            invigilateBlockedNorms,
                        };
                        if (!candidateClashesBuckets(candidate, generatedExams, externalFlat)) {
                            generatedExams.push(candidate);
                            placed = true;
                            if (session === 'Morning') {
                                session = 'Afternoon';
                            } else {
                                session = 'Morning';
                                cursor = bumpDay(cursor);
                            }
                            continue outer;
                        }
                    }

                    if (session === 'Morning') {
                        session = 'Afternoon';
                    } else {
                        session = 'Morning';
                        cursor = bumpDay(cursor);
                    }
                }

                alert(
                    `Could not place "${course.code}" inside ${config.startDate} → ${config.endDate} without clashes vs other departments' published exams. Widen the exam period or free venues.`,
                );
                break outer;
            }

            generatedExams.sort((a, b) => new Date(a.date) - new Date(b.date));

            setGenerationStats({
                totalExams: generatedExams.length,
                startDate: generatedExams[0]?.date,
                endDate: generatedExams[generatedExams.length - 1]?.date,
            });

            setTimetable(generatedExams.length > 0 ? generatedExams : null);
            setExamDraftId(null);
            setExamStaffViewNorm('');
        } catch (error) {
            console.error("Error generating exams:", error);
            alert("Failed to generate timetable.");
        } finally {
            setIsGenerating(false);
        }
    };

    const refreshExamApproval = async () => {
        if (!examDraftId) return;
        try {
            const ds = await getDoc(doc(db, 'exam_timetables', examDraftId));
            if (!ds.exists()) return;
            const d = ds.data();
            if (!d?.lastReviewThreadId) {
                setExamApprovalOk(false);
                return;
            }
            const th = await getReviewThread(d.lastReviewThreadId);
            setExamApprovalOk(th?.publishApproved === true);
        } catch {
            setExamApprovalOk(false);
        }
    };

    const handleExamStaffSharePdf = async () => {
        if (!examStaffViewNorm) {
            alert('Choose a staff member from Staff view first.');
            return;
        }
        const pf = `Exam-Personal-${(selectedExamStaffLabel || 'Staff').replace(/\s+/g, '-').slice(0, 36)}-${config.semester}`
            .replace(/\s+/g, '-');
        await downloadExamStaffPersonalPdfInteractive(timetable || [], {
            department: userData?.department,
            level: 'All',
            filePrefix: pf,
            staffNorm: examStaffViewNorm,
            staffDisplayLabel: selectedExamStaffLabel,
            lecturerEmail: selectedExamStaffEmail,
            subtitle: `${userData?.department || ''} · ${config.semester} semester exams — ${selectedExamStaffLabel}`,
        });
        if (!selectedExamStaffEmail) {
            window.alert(
                'No work email on file for this staff member in Lecturer Management. Export still ran — attach the PDF manually.',
            );
        }
    };

    const handleSaveDraft = async () => {
        if (!timetable || conflicts.length > 0) {
            alert('Generate a conflict-free exam timetable first.');
            return;
        }
        setIsSaving(true);
        try {
            const core = {
                department: userData?.department || 'General',
                coordinatorUid: auth.currentUser?.uid || null,
                coordinatorName: userData?.name || '',
                semester: config.semester,
                isActive: false,
                schedule: timetable,
                stats: generationStats,
                published: false,
                type: 'exam',
                name: `${config.semester} Semester Exam Timetable`,
                updatedAt: new Date().toISOString(),
            };
            if (examDraftId) {
                await updateDoc(doc(db, 'exam_timetables', examDraftId), {
                    ...core,
                    lastReviewThreadId: deleteField(),
                });
                await logActivity(db, {
                    uid: auth.currentUser?.uid,
                    userName: userData?.name,
                    userRole: 'coordinator',
                    department: userData?.department,
                    action: 'exam_timetable_draft_saved',
                    targetType: 'exam_timetables',
                    targetId: examDraftId,
                });
            } else {
                const ref = await addDoc(collection(db, 'exam_timetables'), {
                    ...core,
                    createdAt: Timestamp.now(),
                });
                setExamDraftId(ref.id);
                await logActivity(db, {
                    uid: auth.currentUser?.uid,
                    userName: userData?.name,
                    userRole: 'coordinator',
                    department: userData?.department,
                    action: 'exam_timetable_draft_saved',
                    targetType: 'exam_timetables',
                    targetId: ref.id,
                });
                alert('Draft saved. Next: send to admins for review, then publish after approval.');
                return;
            }
            alert('Draft updated.');
        } catch (err) {
            console.error('Draft save error:', err);
            alert('Could not save draft. Deploy Firestore rules if exam timetable updates are blocked.');
        } finally {
            setIsSaving(false);
        }
    };

    const handlePublishExam = async () => {
        if (!timetable || conflicts.length > 0) {
            alert('Please resolve conflicts before publishing!');
            return;
        }
        if (!examDraftId) {
            alert('Save a draft first. Admin approval is linked to that exam document.');
            return;
        }
        try {
            const ds = await getDoc(doc(db, 'exam_timetables', examDraftId));
            if (!ds.exists()) {
                alert('Draft not found. Save draft again.');
                return;
            }
            const row = ds.data();
            if (!row?.lastReviewThreadId) {
                alert('Send this timetable to administrators for review first.');
                return;
            }
            const th = await getReviewThread(row.lastReviewThreadId);
            if (!th?.publishApproved) {
                alert('Wait for an administrator to approve for publication, or click Refresh approval.');
                return;
            }
        } catch {
            alert('Could not verify approval.');
            return;
        }

        setIsSaving(true);
        try {
            const extSnap = await getDocs(collection(db, 'exam_timetables'));
            const others = extSnap.docs.filter(
                (d) =>
                    d.id !== examDraftId &&
                    String(d.data().department || '') === String(userData?.department || '') &&
                    d.data().isActive === true
            );
            for (const o of others) {
                await updateDoc(doc(db, 'exam_timetables', o.id), { isActive: false });
            }

            await updateDoc(doc(db, 'exam_timetables', examDraftId), {
                schedule: timetable,
                stats: generationStats,
                isActive: true,
                published: true,
                publishedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            await logActivity(db, {
                uid: auth.currentUser?.uid,
                userName: userData?.name,
                userRole: 'coordinator',
                department: userData?.department,
                action: 'exam_timetable_published',
                targetType: 'exam_timetables',
                targetId: examDraftId,
                meta: { semester: config.semester },
            });
            alert('Published — visible on coordinator and admin dashboards.');
            navigate('/coordinator');
        } catch (err) {
            console.error('Publish error:', err);
            alert('Failed to publish.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSendExamToAdmins = () => {
        const uid = auth.currentUser?.uid;
        if (!uid || !userData?.department) {
            alert('Sign in as a coordinator with a department to submit for review.');
            return;
        }
        if (!examDraftId) {
            alert('Save a draft first (Save draft). Admin review is linked to that saved exam document.');
            return;
        }
        if (!timetable?.length) {
            alert('Generate an exam timetable first.');
            return;
        }
        if (conflicts.length > 0 && !window.confirm(`${conflicts.length} conflict flag(s) remain. Send this draft to admins anyway?`))
            return;
        setAdminNoteModalOpen(true);
    };

    const submitExamReviewWithNote = async (noteRaw) => {
        const uid = auth.currentUser?.uid;
        if (!uid || !userData?.department || !examDraftId) {
            if (!examDraftId) alert('Save a draft first, then send for review.');
            return;
        }

        setSendingReview(true);
        try {
            const threadId = await createReviewThread({
                coordinatorUid: uid,
                coordinatorName: userData?.name || '',
                coordinatorEmail: userData?.email || '',
                department: userData.department,
                kind: 'exam',
                title: `${userData.department} · ${config.semester} Semester · Exam draft`,
                linkedExamTimetableId: examDraftId,
                snapshot: {
                    schedule: timetable,
                    stats: generationStats,
                    semester: config.semester,
                    conflicts,
                },
            });
            await updateDoc(doc(db, 'exam_timetables', examDraftId), {
                lastReviewThreadId: threadId,
                updatedAt: new Date().toISOString(),
            });
            await addThreadMessage(threadId, {
                senderRole: 'coordinator',
                senderUid: uid,
                senderName: userData?.name || '',
                body:
                    (noteRaw || '').trim() ||
                    'Submitted exam timetable draft for review. Conflicts array lists venue/cohort issues if any.',
            });
            setAdminNoteModalOpen(false);
            await refreshExamApproval();
            alert('Sent to admins. After approval, use Refresh approval then Publish to dashboard.');
        } catch (e) {
            console.error(e);
            alert('Could not send to admins. Check Firestore security rules for timetable_review_threads.');
        } finally {
            setSendingReview(false);
        }
    };

    const handleDragStart = (e, id) => {
        e.stopPropagation();
        e.dataTransfer.setData('examId', id);
        setDraggedExamId(id);
        setDraggedInvExamId(null);
    };

    const handleInvigilatorDragStart = (e, id) => {
        e.stopPropagation();
        e.dataTransfer.setData('examInvSwapSrc', String(id));
        setDraggedInvExamId(id);
        setDraggedExamId(null);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleRowDrop = (e, targetExamId) => {
        e.preventDefault();

        const invSrc = e.dataTransfer.getData('examInvSwapSrc');
        if (invSrc) {
            if (invSrc === String(targetExamId)) {
                setDraggedInvExamId(null);
                return;
            }
            setTimetable((prev) => {
                const newTimetable = [...prev];
                const sourceIndex = newTimetable.findIndex((x) => String(x.id) === invSrc);
                const targetIndex = newTimetable.findIndex((x) => String(x.id) === String(targetExamId));
                if (sourceIndex < 0 || targetIndex < 0) return prev;

                const sourceObj = { ...newTimetable[sourceIndex] };
                const targetObj = { ...newTimetable[targetIndex] };

                const listFor = (ex) =>
                    Array.isArray(ex.invigilatorNames) && ex.invigilatorNames.length
                        ? [...ex.invigilatorNames]
                        : Array.from(
                              { length: Math.max(1, Number(ex.invigilatorsAssigned) || 1) },
                              (_, j) => `TBA (${j + 1})`
                          );

                const sourceInv = listFor(sourceObj);
                const targetInv = listFor(targetObj);

                sourceObj.invigilatorNames = stripDisallowedInvigilatorsFromNames(targetInv, deptLecturers);
                targetObj.invigilatorNames = stripDisallowedInvigilatorsFromNames(sourceInv, deptLecturers);

                sourceObj.invigilatorsAssigned = sourceObj.invigilatorNames.length;
                targetObj.invigilatorsAssigned = targetObj.invigilatorNames.length;

                newTimetable[sourceIndex] = sourceObj;
                newTimetable[targetIndex] = targetObj;

                const newC = aggregateExamConflicts(newTimetable, externalExamRows);
                if (newC.length > 0) {
                    alert(`Invigilator swap failed:\n- ${newC.join('\n- ')}`);
                    return prev;
                }

                newTimetable.sort((a, b) => new Date(a.date) - new Date(b.date));
                return newTimetable;
            });
            setDraggedInvExamId(null);
            return;
        }

        const sourceExamId = e.dataTransfer.getData('examId');
        if (sourceExamId === targetExamId) {
            setDraggedExamId(null);
            return;
        }

        setTimetable((prev) => {
            const newTimetable = [...prev];
            const sourceIndex = newTimetable.findIndex((x) => x.id === sourceExamId);
            const targetIndex = newTimetable.findIndex((x) => x.id === targetExamId);

            const sourceObj = { ...newTimetable[sourceIndex] };
            const targetObj = { ...newTimetable[targetIndex] };

            const tempDate = sourceObj.date;
            const tempStart = sourceObj.startTime;
            const tempSession = sourceObj.session;
            const tempVenueId = sourceObj.venueId;
            const tempVenueName = sourceObj.venueName;
            const tempCapacity = sourceObj.venueCapacity;

            newTimetable[sourceIndex] = {
                ...sourceObj,
                date: targetObj.date,
                startTime: targetObj.startTime,
                session: targetObj.session,
                venueId: targetObj.venueId,
                venueName: targetObj.venueName,
                venueCapacity: targetObj.venueCapacity,
            };

            newTimetable[targetIndex] = {
                ...targetObj,
                date: tempDate,
                startTime: tempStart,
                session: tempSession,
                venueId: tempVenueId,
                venueName: tempVenueName,
                venueCapacity: tempCapacity,
            };

            const newC = aggregateExamConflicts(newTimetable, externalExamRows);
            if (newC.length > 0) {
                alert(`Swap failed. It introduces the following conflict(s):\n- ${newC.join('\n- ')}`);
                return prev;
            }

            newTimetable.sort((a, b) => new Date(a.date) - new Date(b.date));
            return newTimetable;
        });
        setDraggedExamId(null);
    };

    const openEdit = (exam) => {
        const blk =
            Array.isArray(exam.invigilateBlockedNorms) && exam.invigilateBlockedNorms.length
                ? [...exam.invigilateBlockedNorms]
                : invigilateBlockedNormsFromCourse(departmentCoursesById[exam.id] || {});

        const invRaw =
            Array.isArray(exam.invigilatorNames) && exam.invigilatorNames.length
                ? [...exam.invigilatorNames]
                : Array.from(
                      { length: Math.max(1, Number(exam.invigilatorsAssigned) || 1) },
                      (_, k) => `TBA (${k + 1})`
                  );
        const invNames = stripDisallowedInvigilatorsFromNames(invRaw, deptLecturers);

        const startTimeStr = String(exam.startTime || '09:00').trim();
        const startTimeHHMM = startTimeStr.length >= 5 ? startTimeStr.slice(0, 5) : '09:00';

        setEditingExamId(exam.id);
        setEditForm({
            date: exam.date,
            startTime: startTimeHHMM,
            durationMins: exam.durationMins,
            venueId: exam.venueId,
            invigilatorNames: invNames,
            invigilateBlockedNorms: blk,
        });
    };

    const saveEdit = () => {
        setTimetable((prev) => {
            const selVenue = venues.find((v) => v.id === editForm.venueId);
            const newTbl = prev.map((ex) => {
                if (ex.id !== editingExamId) return ex;
                const invClean = stripDisallowedInvigilatorsFromNames(
                    [...(editForm.invigilatorNames || [])],
                    deptLecturers,
                );
                return {
                    ...ex,
                    date: editForm.date,
                    startTime: editForm.startTime,
                    durationMins: editForm.durationMins,
                    venueId: editForm.venueId,
                    venueName: selVenue ? selVenue.name : ex.venueName,
                    venueCapacity: selVenue ? selVenue.capacity : ex.venueCapacity,
                    invigilatorNames: invClean,
                    invigilatorsAssigned: invClean.length,
                    invigilateBlockedNorms: [...(editForm.invigilateBlockedNorms || [])],
                    session: (() => {
                        const st = examStartToMinutes(editForm.startTime);
                        const cutoff = examStartToMinutes(config.afternoonStart || '14:00');
                        return Number.isFinite(st) && st < cutoff ? 'Morning' : 'Afternoon';
                    })(),
                };
            });
            const newC = aggregateExamConflicts(newTbl, externalExamRows);
            if (newC.length > 0) {
                alert(`Edit failed. It introduces the following conflict(s):\n- ${newC.join('\n- ')}`);
                return prev;
            }
            newTbl.sort((a, b) => new Date(a.date) - new Date(b.date));
            return newTbl;
        });
        setEditingExamId(null);
        setEditForm(null);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <InstructionGuide
                title="Exam Timetable Engine"
                steps={[
                    'Pick the exam window (start and end dates) and semester. Generation only places exams inside that period.',
                    'Published exam timetables from other departments block shared venues/times — drafts are ignored until admin publishes.',
                    'Labs, studios, Physics-block rooms, and virtual venues are never seated finals locations. Practical, Computing lab, Physics lab, or Online catalog delivery types never populate the finals generator; admins can omit additional Lecture courses with “Exclude from written exam timetable”.',
                    'When auto-assigning invigilators, headcount follows hall capacity: fewer than 60 seats → 1 invigilator; 60–100 → 2; 101–150 → 3; above 150 → 4. In Admin → Lecturers, **Title Prof.** or **Assoc. Prof.** (Associate Professor) excludes that person from automatic assignment and from coordinator invigilator pick lists; legacy stray names are replaced with placeholders when the sheet loads.',
                    'Drag the grip beside each row to swap date, time, and venue with another exam. Drag the dashed invigilator panel to swap crews between exams.',
                    'Export: choose 100–400 in the menu for PDF/CSV of one level, or export all levels. JSON is always the full timetable.',
                    'Durations follow credit units — then save draft → admin review → publish.',
                ]}
            />

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-4 items-start">
                    <div className="space-y-2 w-full min-h-[4.75rem]">
                        <label className="text-xs font-bold text-slate-500 uppercase">Start Date</label>
                        <input
                            type="date"
                            value={config.startDate}
                            onChange={(e) => {
                                const startDate = e.target.value;
                                setConfig((c) => ({
                                    ...c,
                                    startDate,
                                    endDate:
                                        !c.endDate || c.endDate < startDate ? defaultEndDateFromStart(startDate) : c.endDate,
                                }));
                            }}
                            className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-sm text-slate-700 font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        />
                    </div>
                    <div className="space-y-2 w-full min-h-[4.75rem]">
                        <label className="text-xs font-bold text-slate-500 uppercase">End Date</label>
                        <input
                            type="date"
                            value={config.endDate}
                            min={config.startDate}
                            onChange={(e) => setConfig({ ...config, endDate: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-sm text-slate-700 font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        />
                    </div>
                    <div className="space-y-2 w-full min-h-[4.75rem]">
                        <label className="text-xs font-bold text-slate-500 uppercase">Semester</label>
                        <select
                            value={config.semester}
                            onChange={(e) => setConfig({ ...config, semester: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-sm text-slate-700 font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        >
                            <option value="First">First Semester</option>
                            <option value="Second">Second Semester</option>
                        </select>
                    </div>
                    <div className="w-full md:w-auto md:self-end shrink-0">
                        <Button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className={`w-full md:w-auto gap-2 ${isGenerating ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'} text-white shadow-lg shadow-indigo-200 transition-all px-8`}
                        >
                            {isGenerating ? <RefreshCw className="animate-spin" size={16} /> : <Play size={16} />}
                            {isGenerating ? 'Computing...' : 'Generate Target Timetable'}
                        </Button>
                    </div>
                </div>
                <p className="text-[11px] text-slate-500">
                    Exams are scheduled only between the chosen start and end dates (weekends skipped when generating).
                </p>
                <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                    <input
                        type="checkbox"
                        className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        checked={config.assignInvigilatorsOnGenerate}
                        onChange={(e) =>
                            setConfig((c) => ({
                                ...c,
                                assignInvigilatorsOnGenerate: e.target.checked,
                            }))
                        }
                    />
                    <span className="text-sm font-bold text-slate-700 leading-snug">
                        Automatically assign invigilators from lecturers in this department
                        <span className="block font-medium text-slate-500 text-[11px] mt-0.5 font-normal">
                            Off by default: slot halls first, then add invigilators in Edit—or enable this before Generate for capacity-based auto-assignment from lecturers whose Admin title is not Prof. or Assoc. Prof., when enough staff avoid clashes.
                        </span>
                    </span>
                </label>
            </div>

            {timetable ? (
                <div className="space-y-12 mt-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-4">
                        <div>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Generated Results</h2>
                            <p className="text-slate-500 font-medium mt-1">Period: {generationStats.startDate} to {generationStats.endDate} • {generationStats.totalExams} Exams Scheduled</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <div className="relative" onMouseDown={(e) => e.stopPropagation()}>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="gap-2 border-slate-200 font-bold h-12 rounded-xl"
                                    onClick={() => setExamExportOpen((o) => !o)}
                                >
                                    <Download size={18} /> Export <ChevronDown size={16} className="opacity-60" />
                                </Button>
                                {examExportOpen && (
                                    <div className="absolute right-0 top-full mt-1 w-64 rounded-xl border border-slate-200 bg-white shadow-xl z-30 py-2 text-left">
                                        <div className="px-4 pb-2 mb-2 border-b border-slate-100 space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                                                Single-level exports use
                                            </label>
                                            <select
                                                value={examExportLevel}
                                                onChange={(e) => setExamExportLevel(e.target.value)}
                                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-bold text-slate-800"
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {['100', '200', '300', '400'].map((lv) => (
                                                    <option key={lv} value={lv}>
                                                        {lv} level
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <button
                                            type="button"
                                            className="w-full px-4 py-2.5 text-xs font-bold hover:bg-slate-50 text-left"
                                            onClick={() => {
                                                setExamExportOpen(false);
                                                void downloadExamSchedulePdf(timetable || [], {
                                                    department: userData?.department,
                                                    level: 'All',
                                                    filePrefix: `${config.semester}-Sem-Exams`.replace(/\s+/g, '-'),
                                                    subtitle: `${userData?.department || ''} · ${config.semester} semester`,
                                                    staffNorm: examStaffViewNorm || '',
                                                    staffDisplayLabel: examStaffViewNorm ? selectedExamStaffLabel : '',
                                                });
                                            }}
                                        >
                                            PDF — {examStaffViewNorm ? `${selectedExamStaffLabel || 'staff'} · all levels` : 'all levels'}
                                        </button>
                                        <button
                                            type="button"
                                            className="w-full px-4 py-2.5 text-xs font-bold hover:bg-slate-50 text-left"
                                            onClick={() => {
                                                setExamExportOpen(false);
                                                const filtered = filterScheduleByLevel(timetable || [], examExportLevel);
                                                if (!filtered.length) {
                                                    alert(`No exams for ${examExportLevel} level in this timetable.`);
                                                    return;
                                                }
                                                void downloadExamSchedulePdf(filtered, {
                                                    department: userData?.department,
                                                    level: examExportLevel,
                                                    filePrefix: `${config.semester}-Sem-Exams-${examExportLevel}L`.replace(
                                                        /\s+/g,
                                                        '-'
                                                    ),
                                                    subtitle: `${userData?.department || ''} · ${config.semester} · ${examExportLevel} level`,
                                                    staffNorm: examStaffViewNorm || '',
                                                    staffDisplayLabel: examStaffViewNorm ? selectedExamStaffLabel : '',
                                                });
                                            }}
                                        >
                                            PDF — {examExportLevel} level only
                                        </button>
                                        <button
                                            type="button"
                                            className="w-full px-4 py-2.5 text-xs font-bold hover:bg-slate-50 flex items-center gap-2"
                                            onClick={() => {
                                                setExamExportOpen(false);
                                                downloadExamScheduleJson(timetable || [], {
                                                    department: userData?.department,
                                                    name: `${config.semester}-exams`.replace(/\s+/g, '-'),
                                                });
                                            }}
                                        >
                                            <FileJson size={14} /> JSON (all levels)
                                        </button>
                                        <button
                                            type="button"
                                            className="w-full px-4 py-2.5 text-xs font-bold hover:bg-slate-50 flex items-center gap-2"
                                            onClick={() => {
                                                setExamExportOpen(false);
                                                downloadExamScheduleCsv(timetable || [], {
                                                    department: userData?.department,
                                                    name: `${config.semester}-exams`.replace(/\s+/g, '-'),
                                                });
                                            }}
                                        >
                                            <Sheet size={14} /> CSV — all levels
                                        </button>
                                        <button
                                            type="button"
                                            className="w-full px-4 py-2.5 text-xs font-bold hover:bg-slate-50 flex items-center gap-2"
                                            onClick={() => {
                                                setExamExportOpen(false);
                                                const filtered = filterScheduleByLevel(timetable || [], examExportLevel);
                                                if (!filtered.length) {
                                                    alert(`No exams for ${examExportLevel} level in this timetable.`);
                                                    return;
                                                }
                                                downloadExamScheduleCsv(filtered, {
                                                    department: userData?.department,
                                                    name: `${config.semester}-exams-${examExportLevel}L`.replace(
                                                        /\s+/g,
                                                        '-'
                                                    ),
                                                });
                                            }}
                                        >
                                            <Sheet size={14} /> CSV — {examExportLevel} level
                                        </button>
                                    </div>
                                )}
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                className="gap-2 border-slate-200 font-bold h-12 rounded-xl"
                                disabled={isSaving || conflicts.length > 0}
                                onClick={() => void handleSaveDraft()}
                            >
                                {isSaving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                                Save draft
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                className="gap-2 border-emerald-200 text-emerald-900 hover:bg-emerald-50 px-6 h-12 rounded-xl font-bold disabled:opacity-50"
                                disabled={sendingReview || !examDraftId}
                                title={!examDraftId ? 'Save draft first' : ''}
                                onClick={() => handleSendExamToAdmins()}
                            >
                                {sendingReview ? <RefreshCw className="animate-spin" size={18} /> : <MessageSquare size={18} />}
                                Send to admins
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                className="gap-2 h-12 rounded-xl font-bold text-slate-600"
                                disabled={!examDraftId}
                                onClick={() => void refreshExamApproval()}
                            >
                                <RefreshCw size={18} /> Refresh approval
                            </Button>
                            <Button
                                type="button"
                                onClick={() => void handlePublishExam()}
                                disabled={isSaving || conflicts.length > 0 || !examDraftId || !examApprovalOk}
                                className="gap-2 bg-slate-900 text-white hover:bg-slate-800 shadow-xl shadow-slate-900/10 px-6 h-12 rounded-xl text-md font-bold disabled:opacity-40"
                                title={!examApprovalOk ? 'Save draft → send for review → admin approves → refresh → publish' : ''}
                            >
                                {isSaving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                                Publish to dashboard
                            </Button>
                        </div>
                        {examDraftId && (
                            <p className="text-xs text-slate-500 mt-2 w-full">
                                {examApprovalOk ? 'Admin approved — you can publish.' : 'Publish stays locked until an administrator approves for publication.'}
                            </p>
                        )}
                    </div>

                    <div className="rounded-xl border border-indigo-100 bg-white shadow-sm p-4 flex flex-col lg:flex-row lg:items-end gap-4">
                        <div className="flex-1 min-w-[240px] space-y-1.5">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Staff view — invigilator & course lecturer</label>
                            <select
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800"
                                value={examStaffViewNorm}
                                onChange={(e) => setExamStaffViewNorm(e.target.value)}
                            >
                                <option value="">All staff — full exam timetable</option>
                                {examStaffPickOptions.map((o) => (
                                    <option key={o.norm} value={o.norm}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                            <p className="text-[11px] text-slate-500 leading-snug">
                                Lists only papers where this person invigilates or teaches (course lecturer). PDF export and share respect this filter when a name is selected.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0">
                            <Button
                                type="button"
                                variant="outline"
                                className="font-bold border-indigo-200 text-indigo-900 h-11"
                                disabled={!examStaffViewNorm}
                                onClick={() => void handleExamStaffSharePdf()}
                            >
                                <Mail size={16} className="mr-2" />
                                Share / mail PDF
                            </Button>
                        </div>
                    </div>

                    {['100', '200', '300', '400'].map(level => {
                        const levelSchedule = examTimetableForStaffView.filter(item => item.level.toString() === level);
                        if (levelSchedule.length === 0) return null;

                        return (
                            <div key={level} data-level={level} className="space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-16 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-slate-900/20">
                                        {level}L
                                    </div>
                                    <h3 className="text-2xl font-bold text-slate-800 uppercase tracking-tight">Exam Schedule</h3>
                                    <div className="h-px flex-1 bg-slate-200"></div>
                                </div>

                                <div className="overflow-x-auto rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/40">
                                    <table className="w-full text-sm text-left border-collapse">
                                        <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-[0.2em] font-black">
                                            <tr>
                                                <th
                                                    scope="col"
                                                    className="px-3 py-5 border-r border-slate-800 text-center w-12"
                                                    title="Grip to swap date/time/venue between rows"
                                                >
                                                    <span className="sr-only">Grip</span>
                                                </th>
                                                <th className="px-8 py-5 border-r border-slate-800">Code</th>
                                                <th className="px-8 py-5 border-r border-slate-800">Course</th>
                                                <th className="px-8 py-5 border-r border-slate-800 text-center">Date</th>
                                                <th className="px-8 py-5 border-r border-slate-800 text-center">Time</th>
                                                <th className="px-8 py-5 border-r border-slate-800">Venue</th>
                                                <th className="px-8 py-5 border-r border-slate-800">Invigilators</th>
                                                <th className="px-8 py-5 border-r border-slate-800 text-center">Duration</th>
                                                <th className="px-8 py-5 border-l border-slate-800 text-center text-slate-500">*</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {levelSchedule.map((course, idx) => (
                                                <tr
                                                    key={`${course.id}-${idx}`}
                                                    className={`hover:bg-indigo-50/20 transition-colors group ${
                                                        draggedExamId === course.id || draggedInvExamId === course.id
                                                            ? 'opacity-40 bg-slate-50'
                                                            : ''
                                                    }`}
                                                    onDragOver={handleDragOver}
                                                    onDrop={(e) => handleRowDrop(e, course.id)}
                                                >
                                                    <td
                                                        className="px-3 py-5 border-r border-slate-100 bg-slate-50/70 text-center align-middle cursor-grab select-none active:cursor-grabbing"
                                                        draggable
                                                        title="Drag to swap date, time & venue with another row"
                                                        onDragStart={(e) => handleDragStart(e, course.id)}
                                                    >
                                                        <GripVertical size={20} className="mx-auto text-slate-400" />
                                                    </td>
                                                    <td className="px-8 py-5 font-black text-slate-900 border-r border-slate-100 bg-slate-50/40">
                                                        {course.courseCode}
                                                    </td>
                                                    <td className="px-8 py-5 font-bold text-slate-700 border-r border-slate-100 max-w-md leading-relaxed">
                                                        {course.courseTitle}
                                                        <div className="flex gap-2 items-center mt-1">
                                                            <span className="text-[9px] text-slate-500 uppercase tracking-widest bg-slate-100 px-1.5 rounded">
                                                                {course.department}
                                                            </span>
                                                            <span className="text-[9px] font-black text-green-700 uppercase tracking-widest bg-green-100 px-1.5 py-0.5 rounded">
                                                                {course.creditUnit} Units
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5 text-center font-black border-r border-slate-100 whitespace-nowrap">
                                                        <div
                                                            className={`inline-block px-4 py-1.5 rounded-lg text-white font-black text-[10px] uppercase shadow-md ${course.session === 'Morning' ? 'bg-emerald-500 shadow-emerald-200' : 'bg-sky-500 shadow-sky-200'}`}
                                                        >
                                                            {new Date(course.date).toLocaleDateString('en-US', {
                                                                weekday: 'short',
                                                                month: 'short',
                                                                day: 'numeric',
                                                            })}
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5 text-center font-black text-indigo-600 border-r border-slate-100 whitespace-nowrap bg-indigo-50/10">
                                                        {course.startTime}
                                                    </td>
                                                    <td className="px-8 py-5 font-bold text-slate-500 border-r border-slate-100">
                                                        <div className="flex items-center gap-2 text-indigo-900">
                                                            <MapPin size={14} className="text-slate-300" />
                                                            {course.venueName}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">
                                                            Cap: {course.venueCapacity}
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5 border-r border-slate-100 align-top">
                                                        <div
                                                            draggable
                                                            className={`cursor-grab rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 p-3 space-y-1 select-none hover:border-indigo-300 hover:bg-indigo-50 active:cursor-grabbing ${draggedInvExamId === course.id ? 'opacity-80 ring-2 ring-indigo-200' : ''}`}
                                                            title="Drag onto another exam’s invigilator panel to swap crews"
                                                            onDragStart={(e) => handleInvigilatorDragStart(e, course.id)}
                                                        >
                                                            {course.invigilatorNames?.length ? (
                                                                <ul className="text-[11px] font-bold text-slate-700 space-y-0.5 list-decimal list-inside">
                                                                    {course.invigilatorNames.map((iv, k) => (
                                                                        <li key={k}>{iv}</li>
                                                                    ))}
                                                                </ul>
                                                            ) : (
                                                                <p className="text-[11px] text-slate-500 italic">
                                                                    {config.assignInvigilatorsOnGenerate
                                                                        ? 'None available under current rules — edit to assign.'
                                                                        : 'Optional: tick "Automatically assign invigilators" and regenerate, or use Edit.'}
                                                                </p>
                                                            )}
                                                            <p className="text-[10px] text-slate-400 font-medium pt-1">Swap crews — drag panel</p>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5 text-center font-black text-slate-700 bg-slate-50/30 border-r border-slate-100">
                                                        {course.durationMins}m
                                                    </td>
                                                    <td className="px-4 py-5 text-center border-l border-slate-100 bg-slate-50/30">
                            <Button
                                variant="ghost"
                                size="sm"
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openEdit(course);
                                }}
                                className="text-slate-400 hover:text-indigo-600"
                            >
                                                            <Edit3 size={16} />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center bg-slate-50/30 mt-8">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300 shadow-sm border border-slate-100">
                        <Calendar size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">Ready to Schedule</h3>
                    <p className="text-slate-500 max-w-sm mx-auto mt-2">
                        Set your parameters above to automatically distribute exams across your active venues without conflict.
                    </p>
                </div>
            )}

            <OptionalNoteToAdminsModal
                open={adminNoteModalOpen}
                onClose={() => {
                    if (!sendingReview) setAdminNoteModalOpen(false);
                }}
                onSend={(note) => void submitExamReviewWithNote(note)}
                pending={sendingReview}
                title="Send exam draft to administrators"
                description="Optional note attached to this review thread. Coordinators can clarify context, risks, or requested checks for the admin team."
            />

            {/* Edit Modal */}
            {editingExamId && editForm && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-8 space-y-4 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-2xl font-black text-slate-900 border-b border-slate-100 pb-4">Manual Override</h3>

                        <div className="space-y-4 pt-2">
                            <div>
                                <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                                    Exam Date
                                </label>
                                <input
                                    type="date"
                                    value={editForm.date}
                                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                                    className="w-full mt-1 bg-slate-50 border p-3 font-bold text-slate-700 rounded-lg text-sm"
                                />
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                                        Start Time
                                    </label>
                                    <input
                                        type="time"
                                        value={editForm.startTime}
                                        onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                                        className="w-full mt-1 bg-slate-50 border p-3 font-bold text-slate-700 rounded-lg text-sm"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                                        Duration (Mins)
                                    </label>
                                    <input
                                        type="number"
                                        value={editForm.durationMins}
                                        onChange={(e) =>
                                            setEditForm({ ...editForm, durationMins: parseInt(e.target.value, 10) })
                                        }
                                        className="w-full mt-1 bg-slate-50 border p-3 font-bold text-slate-700 rounded-lg text-sm"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                                    Assigned Venue
                                </label>
                                <select
                                    value={editForm.venueId}
                                    onChange={(e) => setEditForm({ ...editForm, venueId: e.target.value })}
                                    className="w-full mt-1 bg-slate-50 border p-3 font-bold text-slate-700 rounded-lg text-sm"
                                >
                                    {venues.map((v) => (
                                        <option key={v.id} value={v.id}>
                                            {v.name} (Cap: {v.capacity})
                                        </option>
                                    ))}
                                    <option value="TBH">TBA</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                                    Invigilators
                                </label>
                                <p className="text-[11px] text-slate-500">
                                    Course instructors cannot cover their own papers. Staff with Admin title <strong>Prof.</strong> or <strong>Assoc. Prof.</strong> cannot be selected here. Auto-assignment mildly favours non–Dr. load-sharing among eligible faculty.
                                </p>
                                {(editForm.invigilatorNames || []).map((nm, ix) => (
                                    <div key={ix} className="flex flex-col gap-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                                            Slot {ix + 1}
                                        </span>
                                        <select
                                            value={nm}
                                            onChange={(e) => {
                                                const next = [...(editForm.invigilatorNames || [])];
                                                next[ix] = e.target.value;
                                                setEditForm({ ...editForm, invigilatorNames: next });
                                            }}
                                            className="w-full bg-slate-50 border p-3 font-bold text-slate-700 rounded-lg text-sm"
                                        >
                                            <option value={nm}>{nm || 'Choose…'} (current)</option>
                                            <option value="TBA (manual)">TBA — assign manually</option>
                                            {invigilatorPickPool.map((l) => {
                                                const disp = lecturerDisplayFromRecord(l);
                                                const key = `${l.id}-${ix}`;
                                                return (
                                                    <option key={key} value={disp}>
                                                        {disp}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3 pt-6 border-t border-slate-100">
                            <Button
                                variant="ghost"
                                className="flex-1 font-bold text-slate-500"
                                type="button"
                                onClick={() => {
                                    setEditingExamId(null);
                                    setEditForm(null);
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12 rounded-xl"
                                onClick={saveEdit}
                            >
                                Confirm Change
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExamTimetable;
