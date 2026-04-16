/**
 * Timetable Generation Engine
 * Handles clash-free scheduling for courses, lecturers, and venues.
 */

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
export const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17]; // 9 AM to 5 PM (starting hours)

const ALLOCATION_RULES = [
    // Ground Floor & Limpopo (Large / General)
    {
        name: 'Limpopo Big Halls',
        match: (c) => (c.level === '100' || c.level === '200') && c.department !== 'Computer Science' && c.department !== 'Software Engineering' && c.department !== 'Information Technology',
        venues: ['Limpopo D006', 'Limpopo D008']
    },
    {
        name: 'General 100L Hub',
        match: (c) => c.level === '100',
        venues: ['CONGO E026 theatre', 'CONGO E027 theatre']
    },

    // Software Engineering Specifics
    {
        name: 'SE Senior Dedicated',
        match: (c) => c.department === 'Software Engineering' && (c.level === '300' || c.level === '400'),
        venues: ['CONGO E020 hall', 'CONGO HALL E125']
    },

    // IT Specifics
    {
        name: 'IT Dedicated',
        match: (c) => c.department === 'Information Technology',
        venues: ['CONGO HALL E101', 'CONGO HALL E102']
    },

    // Computer Science Specifics
    {
        name: 'CS Dedicated',
        match: (c) => c.department === 'Computer Science',
        venues: ['CONGO HALL E127', 'CONGO E037 hall'] // 037 shared with Cyber
    },

    // Cyber Security Specifics
    {
        name: 'Cyber Dedicated',
        match: (c) => c.department === 'Cyber Security',
        venues: ['CONGO HALL E128', 'CONGO HALL E129', 'CONGO E037 hall']
    },

    // 200L InfoSys / DataScience
    {
        name: 'InfoSys/DS 200L',
        match: (c) => (c.department === 'Information Systems' || c.department === 'Data Science') && c.level === '200',
        venues: ['CONGO HALL E101']
    }
];

const HIGH_FLEX_VENUES = ['CONGO HALL E102', 'CONGO HALL E125', 'CONGO E026 theatre', 'CONGO E027 theatre'];

/**
 * Generates a schedule based on courses, venues, and constraints.
 * @param {Array} courses - List of courses to schedule
 * @param {Array} venues - Available venues
 * @param {Array} constraints - AI-parsed exclusion rules
 * @param {Array} crossDeptTimetables - Active timetables from other departments
 * @returns {Object} { schedule, conflicts }
 */
export const generateSchedule = (courses, venues, constraints = [], crossDeptTimetables = []) => {
    const schedule = [];
    const conflicts = [];

    // 0. Pre-process: Merge common courses and then explode into sections
    const mergedCourses = [];
    const commonGroups = {}; // { "code-level": course }

    courses.forEach(course => {
        if (course.isCommon) {
            const key = `${course.code}-${course.level}`;
            if (commonGroups[key]) {
                commonGroups[key].students += Number(course.students || 0);
                // Combine department names for reference
                if (!commonGroups[key].departments.includes(course.department)) {
                    commonGroups[key].departments.push(course.department);
                }
            } else {
                commonGroups[key] = {
                    ...course,
                    departments: [course.department],
                    students: Number(course.students || 0)
                };
            }
        } else {
            mergedCourses.push({ ...course, departments: [course.department] });
        }
    });

    // Add merged common courses back
    Object.values(commonGroups).forEach(c => mergedCourses.push(c));

    const explodedCourses = [];
    mergedCourses.forEach(course => {
        const enrollment = Number(course.students || 0);
        const manualSections = Number(course.sections || 1);

        // Logic: Enrollment-Based Sectioning
        // Threshold: 120 students (as per stakeholder requirements)
        // Scaling: Split into 120 + remainder (e.g., 180 -> 120 + 60)
        let sectionCount = manualSections;
        if (enrollment > 120 && manualSections <= 1) {
            sectionCount = Math.ceil(enrollment / 120);
        }

        if (sectionCount > 1) {
            let remainingStudents = enrollment;
            for (let i = 1; i <= sectionCount; i++) {
                const studentsInThisSection = i === sectionCount ? remainingStudents : Math.min(120, remainingStudents);
                remainingStudents -= studentsInThisSection;

                explodedCourses.push({
                    ...course,
                    id: `${course.id}-S${i}`,
                    code: `${course.code}-S${i}`,
                    title: `${course.title} (Section ${String.fromCharCode(64 + i)})`,
                    students: studentsInThisSection,
                    isSection: true,
                    parentCode: course.code,
                    originalEnrollment: enrollment,
                    isMerged: course.departments.length > 1
                });
            }
        } else {
            explodedCourses.push({ ...course, isMerged: course.departments.length > 1 });
        }
    });

    // 1. Sort courses by: 1. Priority (high first), 2. Duration (longer first)
    const sortedCourses = [...explodedCourses].sort((a, b) => {
        // Common-First prioritization: Common courses should be scheduled first
        const isCommonA = a.isCommon || constraints.some(c => c.type === 'Priority' && (c.course === a.code || c.course === a.parentCode));
        const isCommonB = b.isCommon || constraints.some(c => c.type === 'Priority' && (c.course === b.code || c.course === b.parentCode));

        if (isCommonA && !isCommonB) return -1;
        if (!isCommonA && isCommonB) return 1;

        // Then by Level (100L first to occupy Limpopo early)
        if (a.level !== b.level) {
            return parseInt(a.level) - parseInt(b.level);
        }

        const durA = parseInt(a.duration) || 1;
        const durB = parseInt(b.duration) || 1;
        return durB - durA;
    });

    // Tracking structures
    const venueOccupancy = {}; // { "VenueID-Day-Hour": true }
    const lecturerOccupancy = {}; // { "LecturerName-Day-Hour": true }
    const groupOccupancy = {}; // { "Level-Dept-Section-Day-Hour": true }

    // Pre-fill occupancy with Cross-Department Data
    crossDeptTimetables.forEach(timetable => {
        if (timetable.schedule) {
            timetable.schedule.forEach(entry => {
                const duration = parseInt(entry.duration) || 2;
                for (let i = 0; i < duration; i++) {
                    const h = entry.assignedStart + i;
                    // Block Venue
                    if (entry.assignedVenue?.id && entry.assignedVenue.id !== 'virtual') {
                        venueOccupancy[`${entry.assignedVenue.id}-${entry.assignedDay}-${h}`] = true;
                    }
                    // We don't block lecturers or groups here as they are dept-specific usually, 
                    // unless we want to prevent a lecturer from teaching in two depts at once.
                    // Assuming lecturers might teach across depts:
                    if (entry.lecturer && entry.lecturer !== 'TBA') {
                        lecturerOccupancy[`${entry.lecturer}-${entry.assignedDay}-${h}`] = true;
                    }
                }
            });
        }
    });

    // Helper to check if a slot is available
    const isSlotAvailable = (course, venue, day, startHour, duration) => {
        for (let i = 0; i < duration; i++) {
            const currentHour = startHour + i;
            if (currentHour >= 18) return false; // Beyond 6 PM

            // 1. HARD CONSTRAINT: Friday Prayer Break (1 PM - 2 PM)
            if (day === 'Friday' && currentHour === 13) return false;

            const venueKey = `${venue.id}-${day}-${currentHour}`;
            const lecturerKey = `${course.lecturer}-${day}-${currentHour}`;

            // Check Venue Occupancy (Skip for Online/Virtual)
            if (venue.id !== 'virtual' && venueOccupancy[venueKey]) return false;

            // Check Lecturer Occupancy
            if (lecturerOccupancy[lecturerKey]) return false;

            // Student Group Clash Prevention
            // If Common Course: It occupies this level for ALL departments/sections
            // If Dept Course: It occupies its specific Dept+Level+Section
            const level = course.level;
            const dept = course.isCommon ? 'ALL' : course.department;
            const section = course.isSection ? course.id.split('-').pop() : 'GEN'; // E.g. S1, S2 or GEN
            const groupKey = `${level}-${dept}-${section}-${day}-${currentHour}`;

            if (groupOccupancy[groupKey]) return false;

            // Also check 'ALL' if this is a dept course
            if (!course.isCommon && groupOccupancy[`${level}-ALL-${section}-${day}-${currentHour}`]) return false;
            // And if common, check if any specific dept/section already has a class
            if (course.isCommon && Object.keys(groupOccupancy).some(key => key.startsWith(`${level}-`) && key.endsWith(`-${day}-${currentHour}`))) {
                // Actually if it's common, it SHOULD be the only thing for that level at that time across all depts
                // So if ANY group in that level is busy, return false
                return false;
            }

            // AI/NL/Manual Constraints Check
            const isRestricted = constraints.some(c => {
                // Check Day Match (if Day is provided)
                if (c.day && c.day !== day) return false;

                // Match Logic:
                // 1. Level match (if constraint is for a specific level)
                const matchesLevel = !c.level || c.level.toString() === course.level.toString();

                // 2. Lecturer match (if constraint is for a specific lecturer)
                const matchesLecturer = !c.lecturer || c.lecturer === course.lecturer;

                // 3. Course match (if constraint is for a specific course)
                const matchesCourse = !c.course || c.course === course.code || c.course === course.parentCode;

                if (!matchesLevel || !matchesLecturer || !matchesCourse) return false;

                // Check Time Period Match (for manual constraints: Morning, Afternoon, All Day)
                if (c.timeSlot) {
                    if (c.timeSlot === 'Morning' && currentHour < 13) return true;
                    if (c.timeSlot === 'Afternoon' && currentHour >= 13) return true;
                    if (c.timeSlot === 'All Day') return true;
                    return false;
                }

                // Check specific hour match (for AI parsed rules: start, end)
                if (c.start !== undefined && c.end !== undefined) {
                    return currentHour >= c.start && currentHour < c.end;
                }

                // If it's a priority "must start at X" type constraint but current hour != X
                if (c.priority === 'high' && c.start !== undefined && startHour !== c.start) {
                    // This is handled better by sorting, but can be a hard constraint too
                    return false;
                }

                return !!(c.day && !c.timeSlot && c.start === undefined); // Catch-all for "No X on Day Y"
            });
            if (isRestricted) return false;
        }
        return true;
    };

    // Helper to tag a slot as occupied
    const occupySlot = (course, venue, day, startHour, duration) => {
        for (let i = 0; i < duration; i++) {
            const currentHour = startHour + i;
            const venueKey = `${venue.id}-${day}-${currentHour}`;
            const lecturerKey = `${course.lecturer}-${day}-${currentHour}`;

            if (venue.id !== 'virtual') {
                venueOccupancy[venueKey] = true;
            }
            lecturerOccupancy[lecturerKey] = true;

            const level = course.level;
            const dept = course.isCommon ? 'ALL' : course.department;
            const section = course.isSection ? course.id.split('-').pop() : 'GEN';
            const groupKey = `${level}-${dept}-${section}-${day}-${currentHour}`;
            groupOccupancy[groupKey] = true;
        }
    };

    // 2. Main Allocation Loop
    for (const course of sortedCourses) {
        const duration = parseInt(course.duration) || 1;
        let placed = false;

        // Try to find a slot
        // Variation structure
        const shuffledDays = [...DAYS].sort(() => Math.random() - 0.5);

        // Check if there's a specific day/start constraint for this course
        const specificConstraint = constraints.find(c =>
            (c.course === course.code || c.course === course.parentCode) &&
            c.day && c.start !== undefined
        );

        let daysToTry = shuffledDays;
        let hoursToTry = [...HOURS];

        if (specificConstraint) {
            daysToTry = [specificConstraint.day];
            hoursToTry = [specificConstraint.start];
        } else {
            // STRICTOR: 3-hour courses should ideally map to 9-12 (9 AM) or 2-5 (2 PM / 14:00)
            if (duration === 3) {
                hoursToTry = [9, 14];
            }
            hoursToTry = hoursToTry.sort(() => Math.random() - 0.5);
        }

        for (const day of daysToTry) {
            for (const hour of hoursToTry) {
                // Find a suitable venue
                let suitableVenues = [];

                // SPECIAL TYPE HANDLERS
                if (course.type === 'Online') {
                    // Virtual Venue
                    suitableVenues = [{ id: 'virtual', name: 'Online (Zoom/Google Meet)', capacity: 9999, type: 'Virtual', dept: 'All', block: 'Virtual' }];
                } else if (course.type === 'Physics Practical') {
                    // Strict: Physics Lab Only
                    suitableVenues = venues.filter(v => v.name === 'Physics Lab');
                } else if (course.type === 'Computing Practical') {
                    // Strict: Ubangi Labs or other Labs (Prioritize Ubangi)
                    suitableVenues = venues
                        .filter(v => v.type === 'Lab' && v.name.includes('Ubangi'))
                        .sort((a, b) => b.capacity - a.capacity);
                } else {
                    // Normal Physical / Theory Logic
                    // Priority 1: Check Allocation Rules
                    const matchedRule = ALLOCATION_RULES.find(r => r.match(course));

                    if (matchedRule) {
                        // Filter venues that match the rule's venue names
                        const primaryVenues = venues
                            .filter(v => matchedRule.venues.includes(v.name) && v.capacity >= course.students)
                            .sort((a, b) => matchedRule.venues.indexOf(a.name) - matchedRule.venues.indexOf(b.name));

                        // If primary venues are busy/full, try Swap Pool (High Flex)
                        // We add them to the list, but sort them after primary
                        const swapVenues = venues
                            .filter(v => HIGH_FLEX_VENUES.includes(v.name) && !matchedRule.venues.includes(v.name) && v.capacity >= course.students)
                            .sort((a, b) => HIGH_FLEX_VENUES.indexOf(a.name) - HIGH_FLEX_VENUES.indexOf(b.name));

                        suitableVenues = [...primaryVenues, ...swapVenues];
                    } else {
                        // Fallback to Generic Logic if no rule matches
                        suitableVenues = venues.filter(v => {
                            if (course.type === 'Practical') {
                                return v.type === 'Lab' || v.type === 'Laboratory'; // Match both possibilities
                            }
                            if (v.type === 'Lab' || v.type === 'Laboratory') return false; // Theory shouldn't go to lab unless forced

                            // Block Hierarchy Filter:
                            // 100-Level -> Limpopo
                            // 200-Level+ -> Congo
                            if (course.level === '100' && v.block !== 'Limpopo' && v.block !== 'General') return false;
                            if (parseInt(course.level) >= 200 && v.block !== 'Congo' && v.block !== 'General') return false;

                            if (course.students > v.capacity) return false;
                            return true;
                        }).sort((a, b) => {
                            // Prefer department venues over general ones
                            if (a.dept === course.department && b.dept !== course.department) return -1;
                            if (a.dept !== course.department && b.dept === course.department) return 1;
                            return 0;
                        });
                    }
                }

                for (const venue of suitableVenues) {
                    if (isSlotAvailable(course, venue, day, hour, duration)) {
                        occupySlot(course, venue, day, hour, duration);
                        schedule.push({
                            ...course,
                            assignedVenue: venue,
                            assignedDay: day,
                            assignedStart: hour,
                            assignedEnd: hour + duration
                        });
                        placed = true;
                        break;
                    }
                }
                if (placed) break;
            }
            if (placed) break;
        }

        if (!placed) {
            // Determine reason for failure
            const venuesMatchingType = venues.filter(v =>
                v.status !== 'maintenance' &&
                (course.type === 'Practical' ? (v.type === 'Lab' || v.type === 'Laboratory') : (v.type !== 'Lab' && v.type !== 'Laboratory'))
            );
            const venuesMatchingCap = venuesMatchingType.filter(v => Number(course.students) <= v.capacity);

            let reason = "Internal scheduling conflict (time slots exhausted).";
            if (venuesMatchingType.length === 0) {
                reason = `System has zero ${course.type === 'Practical' ? 'Laboratory/Lab' : 'Theory'} venues registered.`;
            } else if (venuesMatchingCap.length === 0) {
                const maxCap = Math.max(...venuesMatchingType.map(v => v.capacity), 0);
                reason = `${course.isSection ? 'Section' : 'Course'} enrollment (${course.students}) exceeds largest available ${course.type} venue (${maxCap}).`;
            }

            conflicts.push({ ...course, reason });
        }
    }

    return { schedule, conflicts };
};
