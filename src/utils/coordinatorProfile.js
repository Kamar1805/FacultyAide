/** Normalize Firestore user doc for coordinator profile displays (prefs + top-level). */

export function getCoordinatorProfileFields(u) {
    if (!u) return {};
    const p = typeof u.prefs === 'object' && u.prefs ? u.prefs : {};
    return {
        name: u.name || '',
        email: u.email || '',
        department: u.department || '',
        phone: p.phone || '',
        officeRoom: p.officeRoom || '',
        bio: p.bio || '',
        timezone: p.timezone || 'Africa/Lagos',
        notifyEmailCoordinator: !!p.notifyEmailCoordinator,
        notifyWeeklyDigest: !!p.notifyWeeklyDigest,
        defaultExportFormat: p.defaultExportFormat || 'pdf',
        settingsUpdatedAt: u.settingsUpdatedAt || null,
        lastActiveAt: u.lastActiveAt || null,
        lastVisitedPath: u.lastVisitedPath || '',
        accessStatus: u.accessStatus || 'active',
        createdAt: u.createdAt || null,
        role: u.role || '',
        staffId: u.staffId || '',
    };
}

export function initialsFromName(name) {
    const s = String(name || '').trim();
    if (!s) return 'C';
    const parts = s.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return s.slice(0, 2).toUpperCase();
}
