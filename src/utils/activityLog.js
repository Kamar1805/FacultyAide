import { collection, addDoc } from 'firebase/firestore';

/**
 * Append an activity entry for coordinators/admins (no PII beyond name).
 * Requires Firestore write permission on `activity_logs`.
 */
export async function logActivity(db, { uid, userName = '', userRole = '', department = '', action, targetType = '', targetId = '', path = '', meta = {} }) {
    if (!db || !action) return;
    try {
        await addDoc(collection(db, 'activity_logs'), {
            uid: uid || null,
            userName: userName || 'Unknown user',
            userRole: userRole || '',
            department: department || '',
            action,
            targetType,
            targetId,
            path: path || '',
            meta: typeof meta === 'object' ? meta : {},
            createdAt: new Date().toISOString(),
        });
    } catch (e) {
        console.warn('activity_log skipped:', e?.message || e);
    }
}
