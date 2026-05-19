import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate, useSearchParams } from 'react-router-dom';
import { auth, db } from '../../firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc, onSnapshot, orderBy, deleteField } from 'firebase/firestore';
import { parseAIConstraints } from '../../utils/aiParser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import {
    Calendar, Clock, User, Rocket, Check,
    AlertCircle, RefreshCw, Layers, Sparkles, Plus, MessageSquare,
    Play, Download, MapPin, Trash2, Home, Share2, Save, X, ChevronRight, LayoutGrid, ArrowRight,
    ChevronDown, FileJson, Sheet, PencilLine, Send, Mail,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    downloadLectureSchedulePdf,
    downloadScheduleJson,
    downloadScheduleCsv,
    collectLectureStaffOptions,
    filterLectureScheduleByStaffNorm,
    downloadLectureStaffPersonalPdfInteractive,
} from '../../utils/timetableExport';
import { normalizePersonTag } from '../../utils/timetableClashAnalysis';
import { logActivity } from '../../utils/activityLog';
import { createReviewThread, addThreadMessage, getReviewThread, markCoordinatorCaughtUp } from '../../services/timetableReviews';
import OptionalNoteToAdminsModal from '../../components/OptionalNoteToAdminsModal';

const DAY_OPTS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];


const LectureTimetable = () => {
    const { userData } = useOutletContext();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // State for Fetching Real Data
    const [fetchedCourses, setFetchedCourses] = useState([]);
    const [fetchedVenues, setFetchedVenues] = useState([]);
    const [fetchedLecturers, setFetchedLecturers] = useState([]);
    const [storedConstraints, setStoredConstraints] = useState([]);
    const [loadingData, setLoadingData] = useState(true);

    // Generation State
    const [step, setStep] = useState(1); // 1: Setup, 2: Generating, 3: Result
    const [progress, setProgress] = useState(0);
    const [nlConstraint, setNlConstraint] = useState('');
    const [addedConstraints, setAddedConstraints] = useState([]);
    const [generatedResult, setGeneratedResult] = useState({ schedule: [], conflicts: [] });
    const [activeLevelTab, setActiveLevelTab] = useState('All');
    const [isPrinting, setIsPrinting] = useState(false);
    const [printScope, setPrintScope] = useState('All');
    const [showExportOptions, setShowExportOptions] = useState(false);
    const [viewMode, setViewMode] = useState('generate'); // 'generate' or 'saved'
    const [savedTimetables, setSavedTimetables] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [saveModalOpen, setSaveModalOpen] = useState(false);
    const [newTimetableName, setNewTimetableName] = useState('');
    const [selectedCourseIds, setSelectedCourseIds] = useState([]);
    const [selectedVenueIds, setSelectedVenueIds] = useState([]);
    const [isDeletingTimetable, setIsDeletingTimetable] = useState(null);
    const [selectionLevelFilter, setSelectionLevelFilter] = useState('All');
    const [venueFilter, setVenueFilter] = useState('All'); // 'All', 'Department', 'General'

    const [editingSavedId, setEditingSavedId] = useState(null);
    const [scheduleEditMode, setScheduleEditMode] = useState(false);
    const [exportMenuOpen, setExportMenuOpen] = useState(false);
    /** Empty string = department-wide view */
    const [lectureStaffViewNorm, setLectureStaffViewNorm] = useState('');
    const [savingEdits, setSavingEdits] = useState(false);
    const [sendingReview, setSendingReview] = useState(false);
    const [adminNoteModalOpen, setAdminNoteModalOpen] = useState(false);
    const [workingSavedTimetableId, setWorkingSavedTimetableId] = useState(null);
    const [threadApprovals, setThreadApprovals] = useState({});

    // New State for Enhanced Workflow
    const [setupStep, setSetupStep] = useState(1); // 1: Session, 2: Config
    const [selectedSemester, setSelectedSemester] = useState('First');
    const [courseConfigs, setCourseConfigs] = useState({}); // { courseId: { lecturer, sections, type, duration } }
    const [crossDeptTimetables, setCrossDeptTimetables] = useState([]);

    // Fetch Saved Timetables
    useEffect(() => {
        if (!userData?.department) return;

        const q = query(
            collection(db, 'saved_timetables'),
            where('department', '==', userData.department),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSavedTimetables(list);
        });

        return () => unsubscribe();
    }, [userData]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const map = {};
            for (const t of savedTimetables) {
                if (!t.lastReviewThreadId) {
                    map[t.id] = false;
                    continue;
                }
                try {
                    const th = await getReviewThread(t.lastReviewThreadId);
                    if (cancelled) return;
                    map[t.id] = th?.publishApproved === true;
                } catch {
                    map[t.id] = false;
                }
            }
            if (!cancelled) setThreadApprovals(map);
        })();
        return () => {
            cancelled = true;
        };
    }, [savedTimetables]);

    const editIdParam = searchParams.get('edit');
    useEffect(() => {
        if (!editIdParam || !savedTimetables.length) return;
        const t = savedTimetables.find((x) => x.id === editIdParam);
        if (!t) return;
        setGeneratedResult({ schedule: [...(t.schedule || [])], conflicts: t.conflicts || [] });
        setEditingSavedId(t.id);
        setWorkingSavedTimetableId(t.id);
        setStep(3);
        setViewMode('generate');
        setScheduleEditMode(true);
        setSearchParams({}, { replace: true });
    }, [editIdParam, savedTimetables, setSearchParams]);

    const reviewThreadId = searchParams.get('reviewThread');
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
                if ((t.kind || 'lecture') === 'exam') {
                    navigate(`/coordinator/exam-timetable?reviewThread=${reviewThreadId}`, { replace: true });
                    return;
                }
                const snap = t.snapshot || {};
                const sched = Array.isArray(snap.schedule) ? snap.schedule : [];
                setGeneratedResult({
                    schedule: [...sched],
                    conflicts: Array.isArray(snap.conflicts) ? [...snap.conflicts] : [],
                });
                setAddedConstraints(Array.isArray(snap.nlConstraints) ? snap.nlConstraints : []);
                if (snap.semester === 'First' || snap.semester === 'Second') {
                    setSelectedSemester(snap.semester);
                }
                if (Array.isArray(snap.courseSelectionIds) && snap.courseSelectionIds.length > 0) {
                    setSelectedCourseIds(snap.courseSelectionIds);
                }
                setStep(3);
                setViewMode('generate');
                setScheduleEditMode(true);
                setWorkingSavedTimetableId(t.linkedSavedLectureId || null);
                setEditingSavedId(null);
                markCoordinatorCaughtUp(reviewThreadId).catch(() => {});
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

    // Fetch Base Data on Mount
    useEffect(() => {
        const fetchData = async () => {
            setLoadingData(true);
            if (!userData?.department) {
                setLoadingData(false);
                return;
            }

            try {
                // 1. Fetch Department Courses (Filtered by Semester)
                // Note: ensuring we fetch all and filter client side if 'semester' field is missing in some old data
                const coursesQ = query(collection(db, 'courses'), where('department', '==', userData.department));
                const coursesSnap = await getDocs(coursesQ);
                const courses = coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // Filter by semester if selectedSemester is set (defaults to First)
                const semesterCourses = courses.filter(c => !c.semester || c.semester === selectedSemester);
                const schedulableCourses = semesterCourses.filter((c) => !c.excludeFromTimetable);

                // 2. Fetch Relevant Venues (Department + General); omit maintenance halls
                const venueDepts = [...new Set(['General', userData.department])];
                const venuesQ = query(collection(db, 'venues'), where('dept', 'in', venueDepts));
                const venuesSnap = await getDocs(venuesQ);
                const venues = venuesSnap.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter((v) => String(v.status || '').toLowerCase() !== 'maintenance');

                // 3. Fetch Stored Constraints
                const constraintsQ = query(collection(db, 'constraints'), where('department', '==', userData.department));
                const constraintsSnap = await getDocs(constraintsQ);
                const constraints = constraintsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // 4. Fetch All Lecturers for AI Context (From any department)
                const lecturersQ = query(collection(db, 'lecturers'));
                const lecturersSnap = await getDocs(lecturersQ);
                const lecturers = lecturersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // 5. Other departments — only ADMIN-PUBLISHED timetables block venues/lecturers (drafts/active-unpublished excluded)
                const allSavedSnap = await getDocs(collection(db, 'saved_timetables'));
                const activeOthers = allSavedSnap.docs
                    .map((d) => ({ id: d.id, ...d.data() }))
                    .filter(
                        (t) =>
                            t.department !== userData.department &&
                            t.published === true
                    );

                setCrossDeptTimetables(activeOthers);

                setFetchedCourses(schedulableCourses);
                setFetchedVenues(venues);
                setStoredConstraints(constraints);
                setFetchedLecturers(lecturers);

                // Initialize configs for fetched courses
                const initialConfigs = {};
                schedulableCourses.forEach(c => {
                    initialConfigs[c.id] = {
                        lecturer: c.lecturer,
                        sections: c.sections || 1,
                        type: c.type || 'Theory',
                        duration: c.duration || '2h',
                        level: c.level,
                        code: c.code,
                        title: c.title,
                        students: c.students
                    };
                });
                setCourseConfigs(initialConfigs);
                // Select all by default
                setSelectedCourseIds(schedulableCourses.map(c => c.id));
                // Select all venues by default
                setSelectedVenueIds(venues.map(v => v.id));

            } catch (error) {
                console.error("Error fetching generation data:", error);
            } finally {
                setLoadingData(false);
            }
        };

        fetchData();
    }, [userData, selectedSemester]); // Re-run when semester changes

    const handleAddConstraint = () => {
        if (!nlConstraint.trim()) return;
        setAddedConstraints([...addedConstraints, nlConstraint]);
        setNlConstraint('');
    };

    const handleRemoveConstraint = (index) => {
        setAddedConstraints(addedConstraints.filter((_, i) => i !== index));
    };

    const handleGenerate = async () => {
        // Prepare courses with their SPECIFIC configurations
        const selectedCourses = selectedCourseIds.map(id => {
            const base = fetchedCourses.find(c => c.id === id);
            const config = courseConfigs[id];
            return {
                ...base,
                ...config, // Override with manual config
                id: base.id // Ensure ID is preserved
            };
        });

        const selectedVenues = fetchedVenues.filter(v => selectedVenueIds.includes(v.id));

        if (selectedCourses.length === 0) {
            alert("No courses selected! Please select the courses you want to include in the timetable.");
            return;
        }
        if (selectedVenues.length === 0) {
            alert("No venues selected! Please select the venues you want to use for the timetable.");
            return;
        }

        setStep(2);
        setProgress(0);

        try {
            const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;

            const deptNlTexts = storedConstraints
                .filter((c) => c.kind === 'natural_language' && (c.text || '').trim())
                .map((c) => c.text.trim());

            const adHocNl = addedConstraints.map((s) => (s || '').trim()).filter(Boolean);
            const allNlToParse = [...deptNlTexts, ...adHocNl];

            let parsedConstraints = [];

            if (allNlToParse.length > 0 && geminiKey) {
                setProgress(20);
                parsedConstraints = await parseAIConstraints(allNlToParse, geminiKey, {
                    courses: selectedCourses,
                    lecturers: fetchedLecturers,
                    department: userData?.department || '',
                });
            } else if (allNlToParse.length > 0 && !geminiKey) {
                console.warn('VITE_GEMINI_API_KEY is missing. Skipping natural-language rule parsing.');
                alert(
                    'Natural-language rules (saved under Constraints or entered below) need VITE_GEMINI_API_KEY in your .env. Generation will continue without those rules.'
                );
            }

            setProgress(40);

            // 2. Run Scheduling Engine
            // Small delay to simulate "thinking" for UX
            await new Promise(resolve => setTimeout(resolve, 800));
            setProgress(70);

            // 2. Pre-process Courses for Section Lecturers
            // If a course has manual sections > 1, we explode it HERE to assign specific lecturers
            // before sending to the engine. The engine's own explosion logic will be bypassed
            // because we set sections=1 for these fragments.

            const processedCourses = [];

            selectedCourses.forEach(course => {
                const numSections = course.sections || 1;
                if (numSections > 1) {
                    // Explode
                    const baseEnrollment = Number(course.students || 0);
                    const perSectionLimit = Math.ceil(baseEnrollment / numSections);
                    let remaining = baseEnrollment;

                    for (let i = 1; i <= numSections; i++) {
                        const currentEnrollment = i === numSections ? remaining : perSectionLimit;
                        remaining -= currentEnrollment;

                        // Get specific lecturer for this section if set, else fallback to main lecturer
                        const specificLecturer = course.sectionLecturers?.[i] || course.lecturer || 'TBA';

                        processedCourses.push({
                            ...course,
                            id: `${course.id}-S${i}`,
                            code: `${course.code}-S${i}`,
                            parentCode: course.code,
                            title: `${course.title} (Section ${String.fromCharCode(64 + i)})`,
                            lecturer: specificLecturer,
                            students: currentEnrollment,
                            sections: 1,
                            isSection: true,
                            department: course.department,
                            isCommon: course.isCommon || false,
                        });
                    }
                } else {
                    processedCourses.push({
                        ...course,
                        department: course.department,
                        isCommon: course.isCommon || false,
                    });
                }
            });

            setProgress(75);

            const legacyStructured = storedConstraints
                .filter((c) => c.kind !== 'natural_language' && c.lecturer && c.day && c.timeSlot)
                .map((c) => ({
                    type: 'Exclusion',
                    lecturer: c.lecturer,
                    day: c.day,
                    timeSlot: c.timeSlot,
                }));

            const mergedConstraints = [...parsedConstraints, ...legacyStructured];

            const response = await fetch('http://localhost:8000/generate_schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    courses: processedCourses,
                    venues: selectedVenues,
                    constraints: mergedConstraints,
                    cross_dept_timetables: crossDeptTimetables
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Backend OR-Tools generation failed');
            }

            const result = await response.json();

            setProgress(90);
            await new Promise(resolve => setTimeout(resolve, 500));

            setGeneratedResult(result);
            setLectureStaffViewNorm('');
            setEditingSavedId(null);
            setScheduleEditMode(false);
            setWorkingSavedTimetableId(null);
            setProgress(100);
            setStep(3);
        } catch (error) {
            console.error("Generation failed:", error);
            alert("An error occurred during generation. Please try again.");
            setStep(1);
        }
    };

    const patchCourseRow = (course, patches) => {
        setGeneratedResult((prev) => ({
            ...prev,
            schedule: prev.schedule.map((s) =>
                s.code === course.code && s.assignedDay === course.assignedDay && s.assignedStart === course.assignedStart
                    ? { ...s, ...patches }
                    : s
            ),
        }));
    };

    const handleSendLectureToAdmins = () => {
        const uid = auth.currentUser?.uid;
        if (!uid || !userData?.department) {
            alert('Sign in as a coordinator with a department to submit for review.');
            return;
        }
        if (!generatedResult?.schedule?.length) {
            alert('Generate or load a timetable first.');
            return;
        }
        if (!workingSavedTimetableId) {
            alert('Save this timetable first (use Save Timetable and keep it as your working saved version), then send for review. The review is tied to that saved copy.');
            return;
        }
        setAdminNoteModalOpen(true);
    };

    const submitLectureReviewWithNote = async (noteRaw) => {
        const uid = auth.currentUser?.uid;
        if (!uid || !userData?.department) return;

        setSendingReview(true);
        try {
            const threadId = await createReviewThread({
                coordinatorUid: uid,
                coordinatorName: userData?.name || '',
                coordinatorEmail: userData?.email || '',
                department: userData.department,
                kind: 'lecture',
                title: `${userData.department} · ${selectedSemester} Semester · Lecture draft`,
                linkedSavedLectureId: workingSavedTimetableId,
                snapshot: {
                    schedule: generatedResult.schedule,
                    conflicts: generatedResult.conflicts || [],
                    semester: selectedSemester,
                    nlConstraints: addedConstraints,
                    courseSelectionIds: selectedCourseIds,
                },
            });
            await updateDoc(doc(db, 'saved_timetables', workingSavedTimetableId), {
                lastReviewThreadId: threadId,
                updatedAt: new Date().toISOString(),
            });
            const body =
                (noteRaw || '').trim() ||
                'Submitted lecture timetable draft for your review. Please check for venue, lecturer, and cross-department clashes.';
            await addThreadMessage(threadId, {
                senderRole: 'coordinator',
                senderUid: uid,
                senderName: userData?.name || '',
                body,
            });
            setAdminNoteModalOpen(false);
            alert('Sent to admins. Use Admin feedback in the sidebar to read replies and adjust if needed.');
        } catch (e) {
            console.error(e);
            alert('Could not send to admins. Check your connection and Firestore security rules for timetable_review_threads.');
        } finally {
            setSendingReview(false);
        }
    };

    const handleSaveTimetable = async () => {
        if (!newTimetableName.trim()) return;
        setIsSaving(true);
        try {
            const ref = await addDoc(collection(db, 'saved_timetables'), {
                name: newTimetableName.trim(),
                department: userData.department,
                schedule: generatedResult.schedule,
                conflicts: generatedResult.conflicts || [],
                coordinatorUid: auth.currentUser?.uid || null,
                coordinatorName: userData?.name || '',
                type: 'lecture',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                isActive: false,
                published: false,
                status: 'draft',
            });
            await logActivity(db, {
                uid: auth.currentUser?.uid,
                userName: userData?.name,
                userRole: 'coordinator',
                department: userData?.department,
                action: 'lecture_timetable_saved',
                targetType: 'saved_timetables',
                targetId: ref.id,
                path: '/coordinator/lecture-timetable',
                meta: { name: newTimetableName.trim() },
            });
            setSaveModalOpen(false);
            setNewTimetableName('');
            setWorkingSavedTimetableId(ref.id);
            alert("Timetable saved successfully!");
        } catch (error) {
            console.error("Error saving timetable:", error);
            alert("Failed to save timetable.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteTimetable = async (id) => {
        if (window.confirm("Are you sure you want to delete this saved timetable?")) {
            setIsDeletingTimetable(id);
            try {
                await deleteDoc(doc(db, 'saved_timetables', id));
            } catch (error) {
                console.error("Error deleting timetable:", error);
                alert("Failed to delete timetable.");
            } finally {
                setIsDeletingTimetable(null);
            }
        }
    };

    const handleSetActive = async (timetable) => {
        try {
            // 1. Deactivate all others in this department
            for (const t of savedTimetables) {
                if (t.isActive && t.id !== timetable.id) {
                    await updateDoc(doc(db, 'saved_timetables', t.id), { isActive: false });
                }
            }
            // 2. Set this one as active (toggle)
            const newStatus = !timetable.isActive;
            await updateDoc(doc(db, 'saved_timetables', timetable.id), { isActive: newStatus });
            alert(newStatus ? "Timetable set as active for dashboard!" : "Timetable removed from dashboard.");
        } catch (error) {
            console.error("Error setting active timetable:", error);
            alert("Failed to update dashboard status.");
        }
    };

    const handleTogglePublish = async (t) => {
        const next = !t.published;
        if (next) {
            if (!t.lastReviewThreadId) {
                alert('Send this timetable to administrators for review first. Publishing is enabled only after an administrator approves it.');
                return;
            }
            try {
                const th = await getReviewThread(t.lastReviewThreadId);
                if (!th?.publishApproved) {
                    alert('An administrator must approve this timetable for publication before you can publish it. Check Timetable feedback or wait for approval.');
                    return;
                }
            } catch {
                alert('Could not verify approval status. Try again or contact an administrator.');
                return;
            }
        }
        try {
            const patch = {
                published: next,
                status: next ? 'published' : 'draft',
                publishedAt: next ? new Date().toISOString() : '',
                updatedAt: new Date().toISOString(),
                isActive: next,
            };
            await updateDoc(doc(db, 'saved_timetables', t.id), patch);
            if (next) {
                for (const x of savedTimetables) {
                    if (x.id !== t.id && x.isActive) {
                        await updateDoc(doc(db, 'saved_timetables', x.id), { isActive: false });
                    }
                }
            }
            await logActivity(db, {
                uid: auth.currentUser?.uid,
                userName: userData?.name,
                userRole: 'coordinator',
                department: userData?.department,
                action: next ? 'lecture_timetable_published' : 'lecture_timetable_unpublished',
                targetType: 'saved_timetables',
                targetId: t.id,
                meta: { name: t.name },
            });
            if (next) {
                alert('Published. It will appear on your home dashboard and the admin overview.');
                navigate('/coordinator');
            } else {
                alert('Publication withdrawn (draft again).');
            }
        } catch (error) {
            console.error(error);
            alert('Could not update publish state. If this persists, ensure Firestore rules are deployed.');
        }
    };

    const handleSaveEditedTimetable = async () => {
        if (!editingSavedId) return;
        setSavingEdits(true);
        try {
            await updateDoc(doc(db, 'saved_timetables', editingSavedId), {
                schedule: generatedResult.schedule,
                conflicts: generatedResult.conflicts || [],
                updatedAt: new Date().toISOString(),
                lastReviewThreadId: deleteField(),
            });
            await logActivity(db, {
                uid: auth.currentUser?.uid,
                userName: userData?.name,
                userRole: 'coordinator',
                department: userData?.department,
                action: 'lecture_timetable_edited',
                targetType: 'saved_timetables',
                targetId: editingSavedId,
            });
            setScheduleEditMode(false);
            setEditingSavedId(null);
            alert('Saved your edits to this version.');
        } catch (error) {
            console.error(error);
            alert('Could not save edits.');
        } finally {
            setSavingEdits(false);
        }
    };

    const canEditSlots = !!(scheduleEditMode && editingSavedId);

    const lectureStaffOptions = useMemo(
        () => collectLectureStaffOptions(generatedResult.schedule || []),
        [generatedResult.schedule],
    );

    const lectureScheduleForStaffView = useMemo(() => {
        if (!lectureStaffViewNorm) return generatedResult.schedule || [];
        return filterLectureScheduleByStaffNorm(generatedResult.schedule || [], lectureStaffViewNorm);
    }, [generatedResult.schedule, lectureStaffViewNorm]);

    const selectedLectureStaffLabel = lectureStaffOptions.find((o) => o.norm === lectureStaffViewNorm)?.label || '';

    const selectedLectureStaffEmail = useMemo(() => {
        if (!lectureStaffViewNorm || !fetchedLecturers.length) return '';
        for (const l of fetchedLecturers) {
            const disp = `${l.title || ''} ${l.name || ''}`.trim();
            if (normalizePersonTag(disp) === lectureStaffViewNorm) return String(l.email || '').trim();
        }
        return '';
    }, [lectureStaffViewNorm, fetchedLecturers]);

    const handleDownloadPDF = (level = 'All') => {
        setExportMenuOpen(false);
        const staffNorm = lectureStaffViewNorm || '';
        const pf = staffNorm ? `Lecture-Personal-${(selectedLectureStaffLabel || 'Staff').replace(/\s+/g, '-').slice(0, 40)}` : 'Nile-Lecture-Timetable';
        void downloadLectureSchedulePdf(generatedResult.schedule, {
            department: userData?.department,
            level,
            filePrefix: pf,
            staffNorm,
            staffDisplayLabel: selectedLectureStaffLabel,
            subtitle:
                staffNorm && selectedLectureStaffLabel
                    ? `${userData?.department || ''} · ${selectedSemester} semester — ${selectedLectureStaffLabel}`
                    : undefined,
        });
    };

    const handleLectureStaffSharePdf = async () => {
        if (!lectureStaffViewNorm) {
            alert('Choose a lecturer from the dropdown first.');
            return;
        }
        const pf = `Lecture-Personal-${(selectedLectureStaffLabel || 'Staff').replace(/\s+/g, '-').slice(0, 40)}`;
        await downloadLectureStaffPersonalPdfInteractive(generatedResult.schedule, {
            department: userData?.department,
            level: 'All',
            filePrefix: pf,
            staffNorm: lectureStaffViewNorm,
            staffDisplayLabel: selectedLectureStaffLabel,
            lecturerEmail: selectedLectureStaffEmail,
            subtitle: `${userData?.department || ''} · ${selectedSemester} semester — ${selectedLectureStaffLabel}`,
        });
        if (!selectedLectureStaffEmail && lectureStaffViewNorm) {
            window.alert(
                'No matching work email found in Lecturer Management for this person. Export still ran — send the PDF manually.',
            );
        }
    };

    const handleShareWhatsApp = (level = 'All') => {
        const text = `*OFFICIAL NILE UNIVERSITY TIMETABLE*\nDept: ${userData.department}\nLevel: ${level}\n\nGenerated via Nile FacultyAide. Please check your dashboard for the full interactive view!`;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    };

    const coursesByLevel = fetchedCourses.reduce((acc, course) => {
        const lvl = course.level || 'Unknown';
        if (!acc[lvl]) acc[lvl] = 0;
        acc[lvl]++;
        return acc;
    }, {});

    return (
        <div className="space-y-8 animate-in fade-in duration-700 pb-20">
            {/* Main Navigation Tabs */}
            <div className="flex bg-slate-100/80 backdrop-blur p-1.5 rounded-2xl w-fit border border-slate-200 shadow-sm no-print mx-auto md:mx-0 sticky top-4 z-40">
                <Button
                    variant={viewMode === 'generate' ? 'default' : 'ghost'}
                    onClick={() => setViewMode('generate')}
                    className={`rounded-xl px-6 h-10 font-bold transition-all ${viewMode === 'generate' ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'}`}
                >
                    <Rocket size={16} className="mr-2" />
                    {step === 3 ? 'Current Result' : 'Generator'}
                </Button>
                <div className="w-px bg-slate-300 mx-1 my-2"></div>
                <Button
                    variant={viewMode === 'saved' ? 'default' : 'ghost'}
                    onClick={() => setViewMode('saved')}
                    className={`rounded-xl px-6 h-10 font-bold transition-all ${viewMode === 'saved' ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'}`}
                >
                    <Layers size={16} className="mr-2" />
                    Saved Timetables
                    {savedTimetables.length > 0 && <span className="ml-2 px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px]">{savedTimetables.length}</span>}
                </Button>
            </div>

            {viewMode === 'saved' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-8 duration-500">
                    <AnimatePresence>
                        {savedTimetables.map((t, index) => (
                            <motion.div
                                key={t.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <Card className={`group transition-all border-slate-200 relative overflow-hidden h-full flex flex-col hover:border-indigo-200 hover:shadow-[0_20px_40px_-15px_rgba(79,70,229,0.1)] ${t.isActive ? 'ring-2 ring-indigo-500 ring-offset-4 border-transparent' : 'hover:-translate-y-1'}`}>
                                    {t.isActive && (
                                        <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[9px] font-black uppercase px-4 py-1.5 rounded-bl-2xl shadow-lg z-20 flex items-center gap-1.5">
                                            <Check size={10} strokeWidth={4} /> Active version
                                        </div>
                                    )}
                                    <div className="absolute -right-8 -top-8 w-32 h-32 bg-indigo-50/50 rounded-full group-hover:scale-150 group-hover:bg-indigo-50 transition-all duration-700"></div>

                                    <CardHeader className="pb-4 relative z-10">
                                        <CardTitle className="text-xl font-black text-slate-800 tracking-tight leading-tight pr-6">{t.name}</CardTitle>
                                        <div className="flex items-center gap-3 mt-3 flex-wrap">
                                            <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-widest text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                                                <Calendar size={10} />
                                                {new Date(t.createdAt).toLocaleDateString()}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-widest text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                                                <Layers size={10} />
                                                {t.schedule?.length || 0} Slots
                                            </div>
                                            {t.published && (
                                                <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-widest text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200">
                                                    <Send size={10} /> Published
                                                </div>
                                            )}
                                            {t.lastReviewThreadId && !t.published && (
                                                <div className={`flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-lg border ${threadApprovals[t.id] ? 'text-emerald-800 bg-emerald-50 border-emerald-200' : 'text-amber-800 bg-amber-50 border-amber-200'}`}>
                                                    {threadApprovals[t.id] ? 'Admin approved — publish' : 'Awaiting admin approval'}
                                                </div>
                                            )}
                                        </div>
                                    </CardHeader>

                                    <CardContent className="space-y-6 relative z-10 flex-1 flex flex-col justify-between pt-2">
                                        <div className="flex gap-3">
                                            <Button
                                                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs h-10 rounded-xl shadow-lg shadow-slate-900/10 transition-all active:scale-95"
                                                onClick={() => {
                                                    setGeneratedResult({ schedule: t.schedule, conflicts: t.conflicts || [] });
                                                    setEditingSavedId(null);
                                                    setWorkingSavedTimetableId(t.id);
                                                    setScheduleEditMode(false);
                                                    setStep(3);
                                                    setViewMode('generate');
                                                }}
                                            >
                                                <Play size={14} className="mr-2" /> Load
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className={`flex-1 font-bold text-xs h-10 rounded-xl transition-all active:scale-95 border-2 ${t.isActive ? 'border-indigo-100 text-indigo-600 bg-indigo-50/50' : 'text-slate-600 border-slate-100 hover:border-slate-300 hover:bg-slate-50'}`}
                                                onClick={() => handleSetActive(t)}
                                            >
                                                <Home size={14} className="mr-2" /> {t.isActive ? 'Active' : 'Set Active'}
                                            </Button>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <Button
                                                variant="outline"
                                                className="font-bold text-xs h-10 rounded-xl border-slate-200"
                                                onClick={() => navigate(`/coordinator/lecture-timetable?edit=${t.id}`)}
                                            >
                                                <PencilLine size={14} className="mr-2" /> Edit
                                            </Button>
                                            <Button
                                                variant={t.published ? 'outline' : 'default'}
                                                className={`font-bold text-xs h-10 rounded-xl ${t.published ? 'border-amber-200 text-amber-800 hover:bg-amber-50' : !t.lastReviewThreadId || !threadApprovals[t.id] ? 'bg-slate-300 text-slate-600 cursor-not-allowed hover:bg-slate-300' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                                                onClick={() => handleTogglePublish(t)}
                                                disabled={!t.published && (!t.lastReviewThreadId || threadApprovals[t.id] !== true)}
                                                title={!t.published && (!t.lastReviewThreadId || threadApprovals[t.id] !== true) ? 'Send for admin review first, then wait for approval before publishing.' : ''}
                                            >
                                                <Send size={14} className="mr-2" /> {t.published ? 'Unpublish' : 'Publish'}
                                            </Button>
                                        </div>

                                        <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 font-bold transition-colors rounded-lg px-2 h-8"
                                                onClick={() => handleDeleteTimetable(t.id)}
                                                disabled={isDeletingTimetable === t.id}
                                            >
                                                {isDeletingTimetable === t.id ? (
                                                    <RefreshCw size={14} className="animate-spin" />
                                                ) : (
                                                    <Trash2 size={14} />
                                                )}
                                            </Button>
                                            <div className="flex gap-2">
                                                <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all" title="Download PDF"
                                                    onClick={() => void downloadLectureSchedulePdf(t.schedule || [], {
                                                        department: userData?.department,
                                                        level: 'All',
                                                        filePrefix: `Lecture-${(t.name || 'export').replace(/\s+/g, '-').slice(0, 48)}`,
                                                        subtitle: t.name || userData?.department,
                                                    })}>
                                                    <Download size={14} />
                                                </Button>
                                                <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-slate-200 text-slate-400 hover:text-sky-600 hover:border-sky-200 hover:bg-sky-50 transition-all" title="JSON"
                                                    onClick={() => downloadScheduleJson(t.schedule || [], { department: userData?.department, name: `${(t.name || 'timetable').replace(/\s+/g, '-')}` })}>
                                                    <FileJson size={14} />
                                                </Button>
                                                <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-slate-200 text-slate-400 hover:text-teal-600 hover:border-teal-200 hover:bg-teal-50 transition-all" title="CSV"
                                                    onClick={() => downloadScheduleCsv(t.schedule || [], { department: userData?.department, name: `${(t.name || 'timetable').replace(/\s+/g, '-')}` })}>
                                                    <Sheet size={14} />
                                                </Button>
                                                <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 transition-all" onClick={() => handleShareWhatsApp()}>
                                                    <Share2 size={14} />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    {savedTimetables.length === 0 && (
                        <div className="col-span-full py-24 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                            <div className="bg-white p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6 shadow-sm">
                                <Layers size={32} className="text-slate-300" />
                            </div>
                            <h3 className="text-lg font-black text-slate-800">No saved timetables yet</h3>
                            <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">Generate a new timetable and save it to access it here later.</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-8">
                    {step === 1 && (
                        <div className="space-y-8 animate-in fade-in duration-500">

                            {/* Setup Progress Header */}
                            <div className="flex items-center justify-between pb-6 border-b border-slate-100">
                                <div>
                                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                                        {setupStep === 1 ? 'New Schedule' : 'Configuration'}
                                    </h1>
                                    <p className="text-slate-500 font-medium mt-1">
                                        {setupStep === 1 ? 'Define the academic session to start.' : 'Customize course delivery parameters.'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                                    <div className={`flex flex-col items-center ${setupStep >= 1 ? 'text-indigo-600' : 'text-slate-300'}`}>
                                        <span className="text-[10px] font-black uppercase tracking-widest">Step 1</span>
                                        <div className={`h-1.5 w-12 rounded-full mt-1 ${setupStep >= 1 ? 'bg-indigo-600' : 'bg-slate-200'}`}></div>
                                    </div>
                                    <div className="w-8 h-px bg-slate-200"></div>
                                    <div className={`flex flex-col items-center ${setupStep >= 2 ? 'text-indigo-600' : 'text-slate-300'}`}>
                                        <span className="text-[10px] font-black uppercase tracking-widest">Step 2</span>
                                        <div className={`h-1.5 w-12 rounded-full mt-1 ${setupStep >= 2 ? 'bg-indigo-600' : 'bg-slate-200'}`}></div>
                                    </div>
                                </div>
                            </div>

                            {/* STEP 1: Session & Semester Selection */}
                            {setupStep === 1 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <Card className="border-indigo-100 shadow-xl shadow-indigo-100/20 overflow-hidden ring-1 ring-slate-900/5">
                                        <div className="h-2 bg-indigo-500 w-full"></div>
                                        <CardHeader className="pt-8 px-8">
                                            <CardTitle className="text-2xl font-black text-slate-900">Select Session</CardTitle>
                                            <CardDescription className="text-base">Which semester are you scheduling for?</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-8 px-8 pb-8">
                                            <div className="grid grid-cols-1 gap-4">
                                                <button
                                                    onClick={() => setSelectedSemester('First')}
                                                    className={`group relative flex items-center justify-between p-6 rounded-2xl border-2 transition-all ${selectedSemester === 'First' ? 'border-indigo-600 bg-indigo-50/50 shadow-inner' : 'border-slate-100 hover:border-indigo-200 hover:bg-white hover:shadow-lg'}`}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg ${selectedSemester === 'First' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600'}`}>1</div>
                                                        <div className="text-left">
                                                            <div className={`font-black text-lg ${selectedSemester === 'First' ? 'text-indigo-900' : 'text-slate-700'}`}>First Semester</div>
                                                            <div className="text-sm text-slate-400 font-medium">Harmattan Session</div>
                                                        </div>
                                                    </div>
                                                    {selectedSemester === 'First' && <Check className="text-indigo-600" strokeWidth={3} />}
                                                </button>

                                                <button
                                                    onClick={() => setSelectedSemester('Second')}
                                                    className={`group relative flex items-center justify-between p-6 rounded-2xl border-2 transition-all ${selectedSemester === 'Second' ? 'border-indigo-600 bg-indigo-50/50 shadow-inner' : 'border-slate-100 hover:border-indigo-200 hover:bg-white hover:shadow-lg'}`}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg ${selectedSemester === 'Second' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600'}`}>2</div>
                                                        <div className="text-left">
                                                            <div className={`font-black text-lg ${selectedSemester === 'Second' ? 'text-indigo-900' : 'text-slate-700'}`}>Second Semester</div>
                                                            <div className="text-sm text-slate-400 font-medium">Rain Session</div>
                                                        </div>
                                                    </div>
                                                    {selectedSemester === 'Second' && <Check className="text-indigo-600" strokeWidth={3} />}
                                                </button>
                                            </div>

                                            <div className="flex justify-end pt-4">
                                                <Button
                                                    onClick={() => setSetupStep(2)}
                                                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold h-14 px-8 rounded-xl shadow-xl shadow-slate-900/10 text-lg transition-transform hover:scale-[1.02] active:scale-95"
                                                    disabled={fetchedCourses.length === 0}
                                                >
                                                    Continue Configuration <ArrowRight size={20} className="ml-2" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Info/Stats Card */}
                                    <div className="space-y-6">
                                        <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-600/20 relative overflow-hidden">
                                            <Sparkles className="absolute top-8 right-8 text-indigo-400 opacity-50" size={48} />
                                            <div className="relative z-10">
                                                <h3 className="text-2xl font-black">Quick Stats</h3>
                                                <p className="text-indigo-200 mt-1 font-medium">For {selectedSemester} Semester</p>

                                                <div className="grid grid-cols-2 gap-6 mt-8">
                                                    <div>
                                                        <div className="text-4xl font-black">{fetchedCourses.length}</div>
                                                        <div className="text-xs font-bold uppercase tracking-widest text-indigo-300 mt-1">Courses</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-4xl font-black">{fetchedLecturers.length}</div>
                                                        <div className="text-xs font-bold uppercase tracking-widest text-indigo-300 mt-1">Lecturers</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-4xl font-black">{fetchedVenues.length}</div>
                                                        <div className="text-xs font-bold uppercase tracking-widest text-indigo-300 mt-1">Venues</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STEP 2: Detailed Course Configuration */}
                            {setupStep === 2 && (
                                <div className="space-y-12">
                                    {['100', '200', '300', '400'].map(level => {
                                        const levelCourses = fetchedCourses.filter(c => c.level === level);
                                        if (levelCourses.length === 0) return null;

                                        return (
                                            <div key={level} className="space-y-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-2 w-2 rounded-full bg-slate-900"></div>
                                                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{level} Level Courses</h3>
                                                    <div className="h-px flex-1 bg-slate-200/60"></div>
                                                </div>

                                                <Card className="border-slate-200 shadow-sm ring-1 ring-slate-900/5 overflow-hidden rounded-2xl">
                                                    <CardContent className="p-0">
                                                        {/* Desktop Table View */}
                                                        <div className="hidden md:block overflow-x-auto">
                                                            <table className="w-full text-sm text-left">
                                                                <thead className="bg-slate-50/80 border-b border-slate-100">
                                                                    <tr>
                                                                        <th className="px-8 py-4 font-black text-xs text-slate-400 uppercase tracking-widest">Code</th>
                                                                        <th className="px-8 py-4 font-black text-xs text-slate-400 uppercase tracking-widest">Title</th>
                                                                        <th className="px-8 py-4 font-black text-xs text-slate-400 uppercase tracking-widest w-1/4">Lecturer</th>
                                                                        <th className="px-8 py-4 font-black text-xs text-slate-400 uppercase tracking-widest w-20">Sections</th>
                                                                        <th className="px-8 py-4 font-black text-xs text-slate-400 uppercase tracking-widest">Venue Type</th>
                                                                        <th className="px-8 py-4 font-black text-xs text-slate-400 uppercase tracking-widest">Duration</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-100">
                                                                    {levelCourses.map(course => (
                                                                        <tr key={course.id} className="bg-white hover:bg-indigo-50/30 transition-colors group">
                                                                            <td className="px-8 py-5">
                                                                                <span className="font-black text-slate-800 bg-slate-100 px-2 py-1 rounded text-xs">{course.code}</span>
                                                                            </td>
                                                                            <td className="px-8 py-5">
                                                                                <div className="font-bold text-slate-700 leading-normal">{course.title}</div>
                                                                            </td>
                                                                            <td className="px-8 py-5">
                                                                                {(courseConfigs[course.id]?.sections || 1) <= 1 ? (
                                                                                    <div className="relative">
                                                                                        <select
                                                                                            className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 cursor-pointer hover:bg-white transition-colors"
                                                                                            value={courseConfigs[course.id]?.lecturer || ''}
                                                                                            onChange={(e) => setCourseConfigs({
                                                                                                ...courseConfigs,
                                                                                                [course.id]: { ...courseConfigs[course.id], lecturer: e.target.value }
                                                                                            })}
                                                                                        >
                                                                                            <option value="TBA">TBA</option>
                                                                                            {fetchedLecturers.map(l => (
                                                                                                <option key={l.id} value={`${l.title} ${l.name}`}>{l.title} {l.name}</option>
                                                                                            ))}
                                                                                        </select>
                                                                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400"><ChevronRight size={12} className="rotate-90" /></div>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="space-y-2 mt-1">
                                                                                        {Array.from({ length: courseConfigs[course.id]?.sections || 1 }).map((_, idx) => {
                                                                                            const sectionNum = idx + 1;
                                                                                            return (
                                                                                                <div key={sectionNum} className="flex items-center gap-2">
                                                                                                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded w-6 text-center">{String.fromCharCode(64 + sectionNum)}</span>
                                                                                                    <div className="relative flex-1">
                                                                                                        <select
                                                                                                            className="w-full appearance-none bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-[10px] font-bold text-slate-600 focus:outline-none focus:border-indigo-500"
                                                                                                            value={courseConfigs[course.id]?.sectionLecturers?.[sectionNum] || courseConfigs[course.id]?.lecturer || ''}
                                                                                                            onChange={(e) => {
                                                                                                                const currentSectionLecturers = courseConfigs[course.id]?.sectionLecturers || {};
                                                                                                                setCourseConfigs({
                                                                                                                    ...courseConfigs,
                                                                                                                    [course.id]: {
                                                                                                                        ...courseConfigs[course.id],
                                                                                                                        sectionLecturers: {
                                                                                                                            ...currentSectionLecturers,
                                                                                                                            [sectionNum]: e.target.value
                                                                                                                        }
                                                                                                                    }
                                                                                                                });
                                                                                                            }}
                                                                                                        >
                                                                                                            <option value="TBA">TBA</option>
                                                                                                            {fetchedLecturers.map(l => (
                                                                                                                <option key={l.id} value={`${l.title} ${l.name}`}>{l.title} {l.name}</option>
                                                                                                            ))}
                                                                                                        </select>
                                                                                                    </div>
                                                                                                </div>
                                                                                            );
                                                                                        })}
                                                                                    </div>
                                                                                )}
                                                                            </td>
                                                                            <td className="px-8 py-5">
                                                                                <input
                                                                                    type="number"
                                                                                    min="1"
                                                                                    max="8"
                                                                                    className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-center text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                                                                                    value={courseConfigs[course.id]?.sections || 1}
                                                                                    onChange={(e) => setCourseConfigs({
                                                                                        ...courseConfigs,
                                                                                        [course.id]: { ...courseConfigs[course.id], sections: parseInt(e.target.value) }
                                                                                    })}
                                                                                />
                                                                            </td>
                                                                            <td className="px-8 py-5">
                                                                                <select
                                                                                    className="w-full bg-transparent border-b-2 border-slate-100 hover:border-indigo-200 focus:border-indigo-500 focus:outline-none py-1.5 text-xs font-bold text-slate-600 transition-colors"
                                                                                    value={courseConfigs[course.id]?.type || 'Theory'}
                                                                                    onChange={(e) => setCourseConfigs({
                                                                                        ...courseConfigs,
                                                                                        [course.id]: { ...courseConfigs[course.id], type: e.target.value }
                                                                                    })}
                                                                                >
                                                                                    <option value="Theory">Lecture Hall</option>
                                                                                    <option value="Online">Online</option>
                                                                                    <option value="Computing Practical">Computing Practical</option>
                                                                                    <option value="Physics Practical">Physics Practical</option>
                                                                                    <option value="Practical">General Lab</option>
                                                                                </select>
                                                                            </td>
                                                                            <td className="px-8 py-5">
                                                                                <div className="flex bg-slate-100 rounded-lg p-0.5 w-fit">
                                                                                    {['1h', '2h', '3h'].map(d => (
                                                                                        <button
                                                                                            key={d}
                                                                                            onClick={() => setCourseConfigs({
                                                                                                ...courseConfigs,
                                                                                                [course.id]: { ...courseConfigs[course.id], duration: d }
                                                                                            })}
                                                                                            className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${courseConfigs[course.id]?.duration === d ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                                                        >
                                                                                            {d}
                                                                                        </button>
                                                                                    ))}
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>

                                                        {/* Mobile Card View */}
                                                        <div className="md:hidden divide-y divide-slate-100">
                                                            {levelCourses.map(course => (
                                                                <div key={course.id} className="p-6 space-y-4">
                                                                    <div className="flex justify-between items-start gap-3">
                                                                        <span className="font-black text-slate-800 bg-slate-100 px-2 py-1 rounded text-xs">{course.code}</span>
                                                                        <div className="text-right">
                                                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Duration</div>
                                                                            <div className="flex bg-slate-100 rounded-lg p-0.5">
                                                                                {['1h', '2h', '3h'].map(d => (
                                                                                    <button
                                                                                        key={d}
                                                                                        onClick={() => setCourseConfigs({
                                                                                            ...courseConfigs,
                                                                                            [course.id]: { ...courseConfigs[course.id], duration: d }
                                                                                        })}
                                                                                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${courseConfigs[course.id]?.duration === d ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-400'}`}
                                                                                    >
                                                                                        {d}
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="font-bold text-slate-900 leading-tight">{course.title}</div>

                                                                    <div className="grid grid-cols-2 gap-4 pt-2">
                                                                        <div className="space-y-1.5">
                                                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Venue Type</label>
                                                                            <select
                                                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
                                                                                value={courseConfigs[course.id]?.type || 'Theory'}
                                                                                onChange={(e) => setCourseConfigs({
                                                                                    ...courseConfigs,
                                                                                    [course.id]: { ...courseConfigs[course.id], type: e.target.value }
                                                                                })}
                                                                            >
                                                                                <option value="Theory">Lecture Hall</option>
                                                                                <option value="Online">Online</option>
                                                                                <option value="Computing Practical">Computing Practical</option>
                                                                                <option value="Physics Practical">Physics Practical</option>
                                                                                <option value="Practical">General Lab</option>
                                                                            </select>
                                                                        </div>
                                                                        <div className="space-y-1.5">
                                                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sections</label>
                                                                            <input
                                                                                type="number"
                                                                                min="1"
                                                                                max="8"
                                                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none"
                                                                                value={courseConfigs[course.id]?.sections || 1}
                                                                                onChange={(e) => setCourseConfigs({
                                                                                    ...courseConfigs,
                                                                                    [course.id]: { ...courseConfigs[course.id], sections: parseInt(e.target.value) }
                                                                                })}
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                    <div className="space-y-1.5">
                                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lecturer(s)</label>
                                                                        {(courseConfigs[course.id]?.sections || 1) <= 1 ? (
                                                                            <select
                                                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
                                                                                value={courseConfigs[course.id]?.lecturer || ''}
                                                                                onChange={(e) => setCourseConfigs({
                                                                                    ...courseConfigs,
                                                                                    [course.id]: { ...courseConfigs[course.id], lecturer: e.target.value }
                                                                                })}
                                                                            >
                                                                                <option value="TBA">TBA</option>
                                                                                {fetchedLecturers.map(l => (
                                                                                    <option key={l.id} value={`${l.title} ${l.name}`}>{l.title} {l.name}</option>
                                                                                ))}
                                                                            </select>
                                                                        ) : (
                                                                            <div className="space-y-2">
                                                                                {Array.from({ length: courseConfigs[course.id]?.sections || 1 }).map((_, idx) => {
                                                                                    const sectionNum = idx + 1;
                                                                                    return (
                                                                                        <div key={sectionNum} className="flex items-center gap-2">
                                                                                            <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded w-6 text-center">{String.fromCharCode(64 + sectionNum)}</span>
                                                                                            <select
                                                                                                className="flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-[10px] font-bold text-slate-600"
                                                                                                value={courseConfigs[course.id]?.sectionLecturers?.[sectionNum] || courseConfigs[course.id]?.lecturer || ''}
                                                                                                onChange={(e) => {
                                                                                                    const currentSectionLecturers = courseConfigs[course.id]?.sectionLecturers || {};
                                                                                                    setCourseConfigs({
                                                                                                        ...courseConfigs,
                                                                                                        [course.id]: {
                                                                                                            ...courseConfigs[course.id],
                                                                                                            sectionLecturers: { ...currentSectionLecturers, [sectionNum]: e.target.value }
                                                                                                        }
                                                                                                    });
                                                                                                }}
                                                                                            >
                                                                                                <option value="TBA">TBA</option>
                                                                                                {fetchedLecturers.map(l => (
                                                                                                    <option key={l.id} value={`${l.title} ${l.name}`}>{l.title} {l.name}</option>
                                                                                                ))}
                                                                                            </select>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            </div>
                                        );
                                    })}
                                    {/* Action Area */}

                                    <div className="flex items-start md:items-center flex-col md:flex-row justify-between gap-6 pt-6">
                                        <Card className="w-full md:w-auto flex-1 border-indigo-100 shadow-sm bg-indigo-50/30">
                                            <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4">
                                                <Sparkles className="text-indigo-500 shrink-0" />
                                                <input
                                                    className="flex-1 bg-transparent border-b border-indigo-200 focus:border-indigo-500 focus:outline-none text-sm py-2 w-full"
                                                    placeholder="Optional extra rule for this run only — saved department rules under Constraints also apply."
                                                    value={nlConstraint}
                                                    onChange={(e) => setNlConstraint(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleAddConstraint()}
                                                />
                                                <Button size="sm" onClick={handleAddConstraint} className="bg-white text-indigo-700 hover:bg-indigo-50 border border-indigo-100 font-bold shadow-sm whitespace-nowrap">Add Rule</Button>
                                            </CardContent>
                                        </Card>
                                        <Button
                                            size="lg"
                                            className="w-full md:w-auto bg-slate-900 text-white font-bold h-14 px-10 shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-transform hover:scale-[1.02] active:scale-95 text-lg"
                                            onClick={handleGenerate}
                                        >
                                            Generate Timetable <Rocket className="ml-2 animate-bounce" size={20} />
                                        </Button>
                                    </div>

                                    {/* Display Added Constraints */}
                                    {addedConstraints.length > 0 && (
                                        <div className="flex flex-wrap gap-2 pt-2">
                                            {addedConstraints.map((c, i) => (
                                                <div key={i} className="animate-in fade-in zoom-in duration-300 bg-white text-slate-700 px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 shadow-sm flex items-center gap-2 group">
                                                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                                    {c}
                                                    <button onClick={() => handleRemoveConstraint(i)} className="text-slate-300 hover:text-red-500 ml-1 transition-colors"><X size={14} /></button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {step === 2 && (
                        <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-8 animate-in fade-in duration-1000">
                            <div className="relative w-40 h-40">
                                <svg className="animate-spin w-full h-full text-slate-100" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none"></circle>
                                    <path className="opacity-75 text-indigo-600" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="font-black text-slate-800 text-3xl">{progress}%</span>
                                </div>
                            </div>
                            <div className="max-w-md mx-auto">
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Optimizing Schedule</h2>
                                <p className="text-slate-500 font-medium mt-3 text-lg">
                                    Resolving conflicts for {selectedCourseIds.length} courses...
                                </p>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-12 max-w-full mx-auto pb-20" id="timetable-container">

                            {canEditSlots && (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-sm">
                                    <div>
                                        <p className="text-sm font-black text-amber-900 uppercase tracking-widest">Editing saved version</p>
                                        <p className="text-xs text-amber-800/80 mt-1">Adjust slots in the table below, then save to update this version.</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button type="button" variant="outline" className="border-amber-300 text-amber-900 font-bold bg-white" disabled={savingEdits} onClick={() => { setEditingSavedId(null); setScheduleEditMode(false); }}>Close editor</Button>
                                        <Button type="button" className="bg-amber-700 hover:bg-amber-800 text-white font-bold" disabled={savingEdits} onClick={handleSaveEditedTimetable}>{savingEdits ? 'Saving…' : 'Save edits'}</Button>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end gap-4 border-b border-slate-200 pb-6">
                                <div>
                                    <h2 className="text-4xl font-black text-slate-900 tracking-tight">Generated Timetable</h2>
                                    <p className="text-slate-500 font-medium mt-1">Review, export, save a version, send it to admins for approval, then publish from <strong>Saved timetables</strong>.</p>
                                </div>
                                <div className="flex flex-wrap gap-2 items-center justify-end">
                                    <div className="relative" onMouseDown={(e) => e.stopPropagation()}>
                                        <Button variant="outline" className="font-bold border-slate-200" type="button" onClick={() => setExportMenuOpen((o) => !o)}>
                                            <Download size={16} className="mr-2" /> Export <ChevronDown size={14} className="ml-2" />
                                        </Button>
                                        {exportMenuOpen && (
                                            <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-slate-200 bg-white shadow-2xl z-50 py-2" onMouseDown={(e) => e.stopPropagation()}>
                                                <button type="button" className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-slate-50" onClick={() => handleDownloadPDF('All')}>
                                                    {lectureStaffViewNorm ? `PDF — ${selectedLectureStaffLabel || 'lecturer'} (all levels)` : 'PDF — full schedule'}
                                                </button>
                                                <button type="button" className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-slate-50 flex items-center gap-2" onClick={() => { setExportMenuOpen(false); downloadScheduleJson(generatedResult.schedule, { department: userData?.department, name: 'lecture-timetable' }); }}><FileJson size={14} /> JSON download</button>
                                                <button type="button" className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-slate-50 flex items-center gap-2" onClick={() => { setExportMenuOpen(false); downloadScheduleCsv(generatedResult.schedule, { department: userData?.department, name: 'lecture-timetable' }); }}><Sheet size={14} /> CSV download</button>
                                                <button type="button" className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-emerald-50 text-emerald-900 flex items-center gap-2 border-t border-slate-100 disabled:opacity-50" onClick={() => { setExportMenuOpen(false); void handleSendLectureToAdmins(); }} disabled={sendingReview || !workingSavedTimetableId} title={!workingSavedTimetableId ? 'Save the timetable first' : ''}><MessageSquare size={14} /> Send to admins for review</button>
                                            </div>
                                        )}
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="font-bold border-emerald-200 text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                                        disabled={sendingReview || !workingSavedTimetableId}
                                        title={!workingSavedTimetableId ? 'Save your timetable first (Save Timetable). Sending for review is tied to that saved copy.' : ''}
                                        onClick={() => void handleSendLectureToAdmins()}
                                    >
                                        {sendingReview ? <RefreshCw size={16} className="mr-2 animate-spin" /> : <MessageSquare size={16} className="mr-2" />}
                                        Send to admins
                                    </Button>
                                    <Button variant="outline" className="font-bold border-slate-200 text-slate-600 hover:bg-slate-50" type="button" onClick={() => { setStep(1); setEditingSavedId(null); setWorkingSavedTimetableId(null); setScheduleEditMode(false); setLectureStaffViewNorm(''); }}>
                                        <RefreshCw size={16} className="mr-2" /> Regenerate
                                    </Button>
                                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-200" type="button" onClick={() => setSaveModalOpen(true)}>
                                        <Save size={16} className="mr-2" /> Save Timetable
                                    </Button>
                                </div>
                            </div>

                            <div className="rounded-xl border border-indigo-100 bg-white shadow-sm p-4 flex flex-col lg:flex-row lg:items-end gap-4">
                                <div className="flex-1 min-w-[240px] space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Staff view — lecturer timetable</label>
                                    <select
                                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800"
                                        value={lectureStaffViewNorm}
                                        onChange={(e) => setLectureStaffViewNorm(e.target.value)}
                                    >
                                        <option value="">All lecturers — full department timetable</option>
                                        {lectureStaffOptions.map((o) => (
                                            <option key={o.norm} value={o.norm}>
                                                {o.label}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[11px] text-slate-500 leading-snug">
                                        Shows only slots where that lecturer is assigned. Export PDF respects this scope; per-level PDF buttons use the same filter. Share tries your device share sheet, then downloads and opens mail with the work email from Lecturer Management when available.
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2 shrink-0">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="font-bold border-indigo-200 text-indigo-900"
                                        disabled={!lectureStaffViewNorm}
                                        onClick={() => void handleLectureStaffSharePdf()}
                                    >
                                        <Mail size={16} className="mr-2" />
                                        Share / mail PDF
                                    </Button>
                                </div>
                            </div>

                            {['100', '200', '300', '400', 'Other'].map(level => {
                                const levelSchedule = lectureScheduleForStaffView.filter(item => {
                                    const lv = item.level != null ? String(item.level) : '';
                                    if (level === 'Other') {
                                        return lv === '' || !['100', '200', '300', '400'].includes(lv);
                                    }
                                    return lv === level;
                                });

                                if (levelSchedule.length === 0) return null;

                                return (
                                    <div key={level} data-level={level} className="space-y-6">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 min-w-[4rem] px-2 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-slate-900/20">
                                                {level === 'Other' ? 'Other' : `${level}L`}
                                            </div>
                                            <h3 className="text-2xl font-bold text-slate-800 uppercase tracking-tight">Academic Schedule</h3>
                                            <div className="h-px flex-1 bg-slate-200"></div>
                                            <Button variant="ghost" size="sm" onClick={() => handleDownloadPDF(level)} className="text-slate-400 hover:text-indigo-600">
                                                <Download size={16} /> Export PDF
                                            </Button>
                                        </div>

                                        {(() => {
                                            const formatTimeRange = (start, durationStr) => {
                                                const duration = parseInt(durationStr);
                                                const end = start + duration;
                                                const formatHour = (h) => {
                                                    if (h < 12) return `${h}AM`;
                                                    if (h === 12) return `12PM`;
                                                    return `${h - 12}PM`;
                                                };
                                                return `${formatHour(start)}-${formatHour(end)}`;
                                            };

                                            return (
                                                <div className="overflow-x-auto rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/40">
                                                    <table className="w-full text-sm text-left border-collapse">
                                                        <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-[0.2em] font-black">
                                                            <tr>
                                                                <th className="px-8 py-5 border-r border-slate-800">Code</th>
                                                                <th className="px-8 py-5 border-r border-slate-800">Course</th>
                                                                <th className="px-8 py-5 border-r border-slate-800 text-center">Time</th>
                                                                <th className="px-8 py-5 border-r border-slate-800 text-center">Day</th>
                                                                <th className="px-8 py-5 border-r border-slate-800">Venue</th>
                                                                <th className="px-8 py-5 border-r border-slate-800">Lecturer</th>
                                                                <th className="px-8 py-5 text-center">Hours</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 bg-white">
                                                            {levelSchedule
                                                                .sort((a, b) => {
                                                                    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                                                                    if (a.assignedDay !== b.assignedDay) {
                                                                        return dayOrder.indexOf(a.assignedDay) - dayOrder.indexOf(b.assignedDay);
                                                                    }
                                                                    return a.assignedStart - b.assignedStart;
                                                                })
                                                                .map((course, idx) => (
                                                                    <tr key={`${course.id}-${idx}`} className="hover:bg-indigo-50/20 transition-colors group">
                                                                        {canEditSlots ? (
                                                                            <>
                                                                                <td className="px-5 py-4 font-black text-slate-900 border-r border-slate-100 bg-slate-50/50 text-xs">{course.code}</td>
                                                                                <td className="px-5 py-4 border-r border-slate-100 max-w-xs">
                                                                                    <input className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold" value={course.title || ''} onChange={(e) => patchCourseRow(course, { title: e.target.value })} />
                                                                                </td>
                                                                                <td className="px-5 py-4 border-r border-slate-100 text-center">
                                                                                    <div className="flex flex-col gap-1 items-center">
                                                                                        <input type="number" min={7} max={20} className="w-14 rounded border border-slate-200 px-1 py-1 text-center text-xs font-black" value={course.assignedStart ?? ''} onChange={(e) => patchCourseRow(course, { assignedStart: parseInt(e.target.value, 10) || 0 })} />
                                                                                        <select className="rounded border border-slate-200 px-1 py-0.5 text-[10px] font-bold" value={course.duration || '2h'} onChange={(e) => patchCourseRow(course, { duration: e.target.value })}>
                                                                                            {['1h', '2h', '3h'].map((d) => <option key={d} value={d}>{d}</option>)}
                                                                                        </select>
                                                                                    </div>
                                                                                </td>
                                                                                <td className="px-5 py-4 border-r border-slate-100 text-center">
                                                                                    <select className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold" value={course.assignedDay || 'Monday'} onChange={(e) => patchCourseRow(course, { assignedDay: e.target.value })}>
                                                                                        {DAY_OPTS.map((d) => <option key={d} value={d}>{d}</option>)}
                                                                                    </select>
                                                                                </td>
                                                                                <td className="px-5 py-4 border-r border-slate-100">
                                                                                    <input className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold" value={course.assignedVenue?.name || ''} onChange={(e) => patchCourseRow(course, { assignedVenue: { ...(course.assignedVenue || {}), name: e.target.value } })} />
                                                                                </td>
                                                                                <td className="px-5 py-4 border-r border-slate-100">
                                                                                    <input className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold" value={course.lecturer || ''} onChange={(e) => patchCourseRow(course, { lecturer: e.target.value })} />
                                                                                </td>
                                                                                <td className="px-5 py-4 text-center text-xs font-black text-slate-600 bg-slate-50/30">{course.duration}</td>
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <td className="px-8 py-5 font-black text-slate-900 border-r border-slate-100 bg-slate-50/50">{course.code}</td>
                                                                                <td className="px-8 py-5 font-bold text-slate-700 border-r border-slate-100 max-w-md leading-relaxed">
                                                                                    {course.title}
                                                                                </td>
                                                                                <td className="px-8 py-5 text-center font-black text-indigo-600 border-r border-slate-100 whitespace-nowrap bg-indigo-50/10">
                                                                                    {formatTimeRange(course.assignedStart, course.duration)}
                                                                                </td>
                                                                                <td className="px-8 py-5 text-center border-r border-slate-100">
                                                                                    <div className={`inline-block px-4 py-1.5 rounded-lg text-white font-black text-[10px] uppercase shadow-md ${course.assignedDay === 'Monday' ? 'bg-emerald-500 shadow-emerald-200' :
                                                                                        course.assignedDay === 'Tuesday' ? 'bg-sky-500 shadow-sky-200' :
                                                                                            course.assignedDay === 'Wednesday' ? 'bg-yellow-400 text-yellow-950 shadow-yellow-100' :
                                                                                                course.assignedDay === 'Thursday' ? 'bg-orange-500 shadow-orange-200' :
                                                                                                    course.assignedDay === 'Friday' ? 'bg-amber-500 shadow-amber-200' :
                                                                                                        'bg-slate-500 shadow-slate-200'
                                                                                        }`}>
                                                                                        {course.assignedDay}
                                                                                    </div>
                                                                                </td>
                                                                                <td className="px-8 py-5 font-bold text-slate-500 border-r border-slate-100">
                                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                                        <MapPin size={14} className="text-slate-300 shrink-0" />
                                                                                        <span>{course.assignedVenue?.name}</span>
                                                                                        {(course.courseType === 'Online' || String(course.assignedVenue?.type || '').toLowerCase() === 'virtual') && (
                                                                                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-violet-100 text-violet-800 border border-violet-200">
                                                                                                Online
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </td>
                                                                                <td className="px-8 py-5 font-bold text-slate-500 border-r border-slate-100">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <User size={14} className="text-slate-300" />
                                                                                        {course.lecturer || 'TBA'}
                                                                                    </div>
                                                                                </td>
                                                                                <td className="px-8 py-5 text-center font-black text-slate-700 bg-slate-50/30">
                                                                                    {course.duration}
                                                                                </td>
                                                                            </>
                                                                        )}
                                                                    </tr>
                                                                ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            );
                                        })()}

                                    </div>
                                );
                            })}

                            {/* Conflicts Alert */}
                            {generatedResult.conflicts.length > 0 && (
                                <Card className="border-amber-200 bg-amber-50/50 rounded-2xl overflow-hidden shadow-sm mt-12">
                                    <div className="bg-amber-100 px-6 py-3 border-b border-amber-200 flex items-center gap-2">
                                        <AlertCircle className="text-amber-600" size={18} />
                                        <span className="font-bold text-amber-800 text-sm uppercase tracking-wide">Scheduling Conflicts Detected</span>
                                    </div>
                                    <CardContent className="p-0">
                                        <div className="max-h-60 overflow-y-auto">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-amber-50/50 text-xs text-amber-900/60 uppercase font-black">
                                                    <tr>
                                                        <th className="px-6 py-3">Course</th>
                                                        <th className="px-6 py-3">Issue</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-amber-100">
                                                    {generatedResult.conflicts.map((c, i) => (
                                                        <tr key={i} className="hover:bg-amber-100/40">
                                                            <td className="px-6 py-3 font-bold text-slate-700">{c.code}</td>
                                                            <td className="px-6 py-3 text-amber-700">{c.reason}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}
                </div>
            )
            }

            <OptionalNoteToAdminsModal
                open={adminNoteModalOpen}
                onClose={() => {
                    if (!sendingReview) setAdminNoteModalOpen(false);
                }}
                onSend={(note) => void submitLectureReviewWithNote(note)}
                pending={sendingReview}
                title="Send lecture draft to administrators"
                description="Optional note attached to this review thread. Coordinators can clarify context, risks, or requested checks for the admin team."
            />

            {/* Save Modal */}
            {
                saveModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
                        <Card className="w-full max-w-md shadow-2xl scale-100 animate-in zoom-in-95 duration-300">
                            <CardHeader className="border-b border-slate-100 pb-6">
                                <CardTitle className="text-xl font-black text-slate-900">Save Timetable</CardTitle>
                                <CardDescription>Give this version a distinct name to retrieve it later.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6 pt-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Version Name</label>
                                    <input
                                        autoFocus
                                        className="w-full h-12 rounded-xl border-2 border-slate-200 px-4 font-bold text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-300"
                                        placeholder="e.g. Final Schedule v1"
                                        value={newTimetableName}
                                        onChange={(e) => setNewTimetableName(e.target.value)}
                                    />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <Button variant="ghost" className="flex-1 font-bold text-slate-500" onClick={() => setSaveModalOpen(false)}>Cancel</Button>
                                    <Button className="flex-1 bg-slate-900 text-white font-bold h-12 rounded-xl" onClick={handleSaveTimetable} disabled={isSaving}>
                                        {isSaving ? 'Saving...' : 'Save Version'}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )
            }
        </div >
    );
};

export default LectureTimetable;

