/** Written-exam scheduling: invigilator count and course/venue eligibility. */

/** @deprecated Prefer {@link invigilatorsRequiredForVenueCapacity} — retained for backwards compatibility with old strings. */
export const INVIGILATORS_PER_EXAM_HALL = 3;

/**
 * Invigilator headcount by seated-exam venue capacity:
 * Below 60 → 1; 60–100 → 2; 101–150 → 3; above 150 → 4.
 */
export function invigilatorsRequiredForVenueCapacity(capacityRaw) {
    const c = Number(capacityRaw);
    if (!Number.isFinite(c) || c <= 0) return 1;
    if (c < 60) return 1;
    if (c > 150) return 4;
    if (c > 100) return 3;
    return 2;
}

/**
 * Canonical `lecturers.title` values stored by Admin → Lecturers that cannot invigilate.
 * Keep in sync with the title dropdown in LecturerManagement.
 */
const INVIGILATOR_EXCLUDED_LECTURER_TITLES = new Set(['Prof.', 'Assoc. Prof.', 'Associate Professor']);

/**
 * True when the lecturer's **title** is Professor or Associate Professor (excluded from exam invigilation).
 * @param {{ title?: string } | string} lecturerOrTitle - Firestore row or title string
 */
export function lecturerTitleExcludedFromInvigilation(lecturerOrTitle) {
    const raw =
        typeof lecturerOrTitle === 'string'
            ? lecturerOrTitle
            : String(lecturerOrTitle?.title ?? '').trim();
    if (!raw) return false;
    if (INVIGILATOR_EXCLUDED_LECTURER_TITLES.has(raw)) return true;

    const s = raw.toLowerCase().replace(/\s+/g, ' ').trim();
    const noDot = s.replace(/\.$/, '');
    if (noDot === 'prof') return true;
    if (s === 'associate professor') return true;
    if (/^assoc\.?\s*prof\.?$/.test(noDot)) return true;
    if (s.includes('associate') && s.includes('prof')) return true;
    return false;
}

/** Eligible for invigilator pool when title is not Prof / Associate Professor. */
export function lecturerEligibleForExamInvigilationByTitle(l) {
    return !!l && !lecturerTitleExcludedFromInvigilation(l);
}

/**
 * Heuristic on a free-form invigilator label (e.g. legacy rows "Prof. A. Smith") when no lecturer-row match fits.
 */
export function invigilatorDisplayNameIndicatesExcludedSeniority(s) {
    if (typeof s !== 'string') return false;
    const trimmed = s.trim();
    if (!trimmed) return false;
    const low = trimmed.toLowerCase();
    if (/^\s*prof\.?\s/i.test(trimmed)) return true;
    if (/^\s*professor\b/i.test(low)) return true;
    if (/^\s*associate\s+professor\b/.test(low)) return true;
    if (/^\s*assoc\.?\s*prof\.?\s/.test(low)) return true;

    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 1 && lecturerTitleExcludedFromInvigilation(parts[0])) return true;
    if (parts.length >= 2) {
        const two = `${parts[0]} ${parts[1]}`.trim();
        if (lecturerTitleExcludedFromInvigilation(two)) return true;
    }
    return false;
}

/** Lab, studio, virtual, or Physics-area rooms are never used for written finals placement. */
export function venueEligibleForWrittenExam(v) {
    if (!v || String(v.id) === 'TBH') return true;
    const t = String(v.type || '').trim().toLowerCase();
    if (['lab', 'laboratory', 'studio', 'virtual'].includes(t)) return false;
    const n = String(v.name || '').toLowerCase();
    const blk = String(v.block || '').trim().toLowerCase();
    if (blk === 'physics') return false;
    if (
        /\bphysics\b/.test(n) &&
        (/\blaboratory\b|\blab\b|\bpractical\b/.test(n) || /\bphysics\s+lab\b/.test(n))
    ) {
        return false;
    }
    return true;
}

/** Delivery types written exams do not slot automatically (manual project/oral/offline workflows). */
export function catalogDeliveryExcludedFromExamByDefault(typeRaw) {
    const t = String(typeRaw || 'Theory').trim().toLowerCase();
    return ['physics practical', 'computing practical', 'practical', 'online'].includes(t);
}

/**
 * Catches wrongly catalogued "Theory" rows that are clearly practical physics / computing labs
 * from Code + Title (e.g. "GENERAL PRACTICAL PHYSICS I").
 */
export function heuristicPracticalModuleExcludedFromExamByText(c) {
    const raw = `${c?.code ?? ''} ${c?.title ?? ''}`.toLowerCase();
    const norm = raw.replace(/\s+/g, ' ').trim();

    const hasPracticalWording =
        /\bgeneral\s+practical\b|\bpractical\b|\bclinical\s+practice\b/i.test(norm) ||
        /\b(?:laboratory|laboratories|workshop)\b/.test(norm) ||
        /\blabs?\b/i.test(norm) ||
        /\((?:practical|lab)\)|\[(?:practical|lab)\]/i.test(norm);

    if (!hasPracticalWording) return false;

    const hasPhysics =
        /\bphysics\b|\bparticle\s+(?:and\s+)?mechanics\b|\bphysical\s+computing\b/i.test(norm) ||
        /(^|[\s,/(\[\-])(phy|cphy)(?=\s|\d|\/|,|\)|$|\])/i.test(norm);

    if (hasPhysics) return true;

    const hasComputingCluster =
        /\b(?:computing|programming)\b|\bcomputer\s+(?:science|practical)\b/i.test(norm) ||
        /(?:^|[\s,/()])(?:csc|cpc|cmp)[\s._/-]*\d+/i.test(norm) ||
        /\bcsc\b|\bcpc\b|\bcmp\b/.test(norm);
    if (hasComputingCluster) return true;

    return false;
}

export function coursePassesExamGeneratorGate(c) {
    if (!c || c.excludeFromTimetable) return false;
    if (c.excludeFromExamTimetable) return false;
    if (catalogDeliveryExcludedFromExamByDefault(c.type)) return false;
    if (heuristicPracticalModuleExcludedFromExamByText(c)) return false;
    return true;
}
