import {
    collection,
    addDoc,
    updateDoc,
    doc,
    query,
    where,
    onSnapshot,
    serverTimestamp,
    getDocs,
    getDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

const THREADS = 'timetable_review_threads';
const messagesCol = (threadId) => collection(db, THREADS, threadId, 'messages');

/** Load one thread document (respects Firestore rules). */
export async function getReviewThread(threadId) {
    if (!threadId) return null;
    const snap = await getDoc(doc(db, THREADS, threadId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
}

function sortThreadsDesc(rows) {
    return [...rows].sort((a, b) => {
        const ta = a.updatedAt?.toMillis?.() ?? a.updatedAt?.seconds * 1000 ?? 0;
        const tb = b.updatedAt?.toMillis?.() ?? b.updatedAt?.seconds * 1000 ?? 0;
        return tb - ta;
    });
}

export async function createReviewThread({
    coordinatorUid,
    coordinatorName,
    coordinatorEmail,
    department,
    kind,
    title,
    snapshot,
}) {
    const ref = await addDoc(collection(db, THREADS), {
        coordinatorUid,
        coordinatorName: coordinatorName || '',
        coordinatorEmail: coordinatorEmail || '',
        department: department || '',
        kind: kind === 'exam' ? 'exam' : 'lecture',
        title: title || 'Timetable review',
        snapshot: snapshot || {},
        status: 'submitted',
        pendingAdminAttention: true,
        pendingCoordinatorAttention: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return ref.id;
}

export async function addThreadMessage(threadId, { senderRole, senderUid, senderName, body }) {
    if (!threadId || !body?.trim()) return;
    await addDoc(messagesCol(threadId), {
        senderRole,
        senderUid: senderUid || null,
        senderName: senderName || '',
        body: body.trim(),
        createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, THREADS, threadId), {
        updatedAt: serverTimestamp(),
        pendingAdminAttention: senderRole === 'coordinator',
        pendingCoordinatorAttention: senderRole === 'admin',
        lastMessagePreview: body.trim().slice(0, 180),
        lastMessageRole: senderRole,
    });
}

export async function updateThreadStatus(threadId, status) {
    await updateDoc(doc(db, THREADS, threadId), {
        status,
        updatedAt: serverTimestamp(),
    });
}

export async function markCoordinatorCaughtUp(threadId) {
    await updateDoc(doc(db, THREADS, threadId), {
        pendingCoordinatorAttention: false,
        coordinatorLastOpenedAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
    });
}

export async function markAdminCaughtUp(threadId) {
    await updateDoc(doc(db, THREADS, threadId), {
        pendingAdminAttention: false,
        adminLastOpenedAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
    });
}

export function subscribeCoordinatorThreads(coordinatorUid, callback) {
    const q = query(collection(db, THREADS), where('coordinatorUid', '==', coordinatorUid));
    return onSnapshot(q, (snap) => {
        callback(sortThreadsDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    });
}

export function subscribeAllThreads(callback) {
    return onSnapshot(collection(db, THREADS), (snap) => {
        callback(sortThreadsDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    });
}

/** One-shot fallback if snapshots fail permission */
export async function fetchAllThreadsOnce() {
    const snap = await getDocs(collection(db, THREADS));
    return sortThreadsDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
}

export function subscribeThreadMessages(threadId, callback) {
    const q = query(messagesCol(threadId));
    return onSnapshot(q, (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => {
            const ta = a.createdAt?.toMillis?.() ?? a.createdAt?.seconds * 1000 ?? 0;
            const tb = b.createdAt?.toMillis?.() ?? b.createdAt?.seconds * 1000 ?? 0;
            return ta - tb;
        });
        callback(rows);
    });
}
