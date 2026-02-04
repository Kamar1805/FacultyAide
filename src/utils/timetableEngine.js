/**
 * Timetable Generation Engine
 * Handles clash-free scheduling for courses, lecturers, and venues.
 */

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
export const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17]; // 9 AM to 5 PM (starting hours)

/**
 * Generates a schedule based on courses, venues, and constraints.
 * @param {Array} courses - List of courses to schedule
 * @param {Array} venues - Available venues
 * @param {Array} constraints - AI-parsed exclusion rules
 * @returns {Object} { schedule, conflicts }
 */
export const generateSchedule = (courses, venues, constraints = []) => {
    const schedule = [];
    const conflicts = [];

    // 0. Pre-process: Explode courses into sections if enrollment > 85 or manual sections > 1
    const explodedCourses = [];
    courses.forEach(course => {
        const enrollment = Number(course.students || 0);
        const manualSections = Number(course.sections || 1);

        // Logic: If user manually specified > 1 sections, honor that.
        // If they left it at 1 (default) but have > 85 students, auto-section.
        // LIMIT: Max 2 sections for auto-split to save space
        let sectionCount = manualSections;
        if (enrollment > 85 && manualSections <= 1) {
            sectionCount = 2; // Fixed at 2 as per user request to avoid space exhaustion
        }

        if (sectionCount > 1) {
            const studentsPerSection = Math.ceil(enrollment / sectionCount);
            for (let i = 1; i <= sectionCount; i++) {
                explodedCourses.push({
                    ...course,
                    id: `${course.id}-S${i}`,
                    code: `${course.code}-S${i}`,
                    title: `${course.title} (Section ${String.fromCharCode(64 + i)})`, // S1 -> A, S2 -> B
                    students: studentsPerSection,
                    isSection: true,
                    parentCode: course.code,
                    originalEnrollment: enrollment
                });
            }
        } else {
            explodedCourses.push(course);
        }
    });

    // 1. Sort courses by duration (longer first) to improve fitting
    const sortedCourses = [...explodedCourses].sort((a, b) => {
        const durA = parseInt(a.duration) || 1;
        const durB = parseInt(b.duration) || 1;
        return durB - durA;
    });

    // Tracking structures
    const venueOccupancy = {}; // { "VenueID-Day-Hour": true }
    const lecturerOccupancy = {}; // { "LecturerName-Day-Hour": true }
    const levelOccupancy = {}; // { "Level-Day-Hour": true }

    // Helper to check if a slot is available
    const isSlotAvailable = (course, venue, day, startHour, duration) => {
        for (let i = 0; i < duration; i++) {
            const currentHour = startHour + i;
            if (currentHour >= 18) return false; // Beyond 6 PM (allowing 5pm class to finish)

            const venueKey = `${venue.id}-${day}-${currentHour}`;
            const lecturerKey = `${course.lecturer}-${day}-${currentHour}`;
            const levelKey = `${course.level}-${day}-${currentHour}`;

            if (venueOccupancy[venueKey]) return false;
            if (lecturerOccupancy[lecturerKey]) return false;
            if (levelOccupancy[levelKey]) return false; // Prevent level clashes

            // AI/NL/Manual Constraints Check
            const isRestricted = constraints.some(c => {
                // Check Day Match
                if (c.day !== day) return false;

                // Check Lecturer Match (if specified)
                // If c.lecturer is missing, it's a global rule for the department (not used yet, but good for future)
                if (c.lecturer && c.lecturer !== course.lecturer) return false;

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

                return false;
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
            const levelKey = `${course.level}-${day}-${currentHour}`;

            venueOccupancy[venueKey] = true;
            lecturerOccupancy[lecturerKey] = true;
            levelOccupancy[levelKey] = true;
        }
    };

    // 2. Main Allocation Loop
    for (const course of sortedCourses) {
        const duration = parseInt(course.duration) || 1;
        let placed = false;

        // Try to find a slot
        // Shuffle days and hours to provide variation in generation
        const shuffledDays = [...DAYS].sort(() => Math.random() - 0.5);

        // STRICTOR: 3-hour courses should ideally map to 9-12 (9 AM) or 2-5 (2 PM / 14:00)
        let hoursToTry = [...HOURS];
        if (duration === 3) {
            hoursToTry = [9, 14];
        }
        const shuffledHours = hoursToTry.sort(() => Math.random() - 0.5);

        for (const day of shuffledDays) {
            for (const hour of shuffledHours) {
                // Find a suitable venue
                // 1. Must match type if Practical (Practical -> Lab)
                // 2. Must fit students
                // 3. Prefer department venues
                const suitableVenues = venues.filter(v => {
                    if (course.type === 'Practical') {
                        return v.type === 'Lab' || v.type === 'Laboratory'; // Match both possibilities
                    }
                    if (v.type === 'Lab' || v.type === 'Laboratory') return false; // Theory shouldn't go to lab unless forced

                    if (course.students > v.capacity) return false;
                    return true;
                }).sort((a, b) => {
                    // Prefer department venues over general ones
                    if (a.dept === course.department && b.dept !== course.department) return -1;
                    if (a.dept !== course.department && b.dept === course.department) return 1;
                    return 0;
                });

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
