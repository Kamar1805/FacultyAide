import { geminiGenerateText } from './geminiApi';

/**
 * Parses natural-language rules into exclusions the OR-Tools backend understands.
 *
 * Backend expects hours on a 24h clock for the teaching day (roughly 9–18); use start/end inclusive-exclusive [start,end).
 */

function normalizeDepartmentPhrase(s, knownDept) {
    if (!knownDept || !s) return s;
    const low = knownDept.trim().toLowerCase();
    if (s.trim().toLowerCase() === low) return knownDept;
    return s;
}

/**
 * @param {string[]} constraintLines
 * @param {string} apiKey
 * @param {{ courses?: object[], lecturers?: object[], department?: string }} context
 */
export const parseAIConstraints = async (constraintLines, apiKey, context = { courses: [], lecturers: [], department: '' }) => {
    if (!apiKey || constraintLines.length === 0) return [];

    const lecturerNames = context.lecturers.map((l) => `${l.title} ${l.name}`).join(', ');
    const courseList = context.courses
        .map((c) => `${c.code}${c.level ? ` (L${c.level})` : ''}`)
        .join(', ');
    const department = context.department || '';

    const prompt = `You are a university timetable assistant. Convert each rule into JSON objects for HARD exclusions (sessions must NOT overlap these time windows).

SCHEDULING CONTEXT
- Coordinating department for this timetable run (match when the sentence names THIS department OR says "we/our department" while working in context): "${department}"
- Courses in THIS run only: ${courseList}
- Known lecturer display names (match exactly when a rule names a lecturer): ${lecturerNames}

TARGET JSON SCHEMA (array only). Each object:
{
  "type": "Exclusion",
  "departmentWide": boolean,
  "department": string | null,
  "lecturer": string | null,
  "course": string | null,
  "level": "100" | "200" | "300" | "400" | null,
  "day": "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | null,
  "timeSlot": "Morning" | "Afternoon" | "Late" | "All Day" | null,
  "start": integer | null,
  "end": integer | null
}

FIELD RULES:
- type MUST be "Exclusion" → blocks placement overlapping the forbidden window ON THAT weekday.
- department: set EXACT canonical department name WHEN the sentence names one department explicitly (e.g. "Software Engineering should not...", "Law faculty must not...", "Medicine prohibits..."). Compare loosely to "${department}" and use the SAME spelling as "${department}" if they refer to the current batch. Leave null ONLY if department is vague ("all faculties") or lecturer/course scoped only.
- departmentWide:
  • true WHEN the prohibition applies broadly to MOST or ALL offerings of THAT department mentioned (NOT a single lecturer/course). Example: "Software Engineering shall not schedule classes Friday after 4pm" → departmentWide true, department "Software Engineering", day Friday.
  • false when rule targets one lecturer OR one course OR one level cohort only.

- lecturer: full string from KNOWN lecturers list ONLY when restriction is ABOUT that lecturer's duty.
- course: bare code only (e.g., CSC311) when about one course module.
- level: ONLY if wording says 100-level / 200L / 300 / year 2 / second year with clear intent.

TIME WINDOW (CRITICAL):
- Prefer integer "start" and "end" on a 24-hour clock (e.g. 16 means 4:00 PM). Use half-open interval [start, end) in real hours: session overlaps if it intersects.
- "no classes by 4pm" / "no classes after 4pm" / "nothing from 4pm onward" / "must end before 4pm" on a day → mean FORBID teaching that overlaps 16:00–18:00 (set start 16, end 18).
- "no afternoon classes Friday" → timeSlot Afternoon OR start 13 end 18.
- "nothing before noon" forbid 09–12 → start 9 end 12.
- Morning = 09–13, Afternoon = 13–18, Late or "after 3pm slice" overlaps use explicit start/end when possible.
- "All Day" (weekday-only) Friday → timeSlot All Day WITH day Friday.
- NEVER mark departmentWide=true for the whole institution unless text clearly says ALL departments/university-wide AND this run is explicitly global (it is departmental: "${department}", so rarely use whole-university exclusions).

MATCHING NAMES:
If text says abbreviations SE for Software Engineering, expand to department string "${department}" when unambiguous context.

RULES TO SERIALIZE NOW:
${constraintLines.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Output ONLY a flat JSON array, no prose, no markdown code fences.

EXAMPLE OUTPUT for input "Software engineering should not have classes by 4pm on Friday" when department is "${department || 'Software Engineering'}" :
[
 {"type":"Exclusion","departmentWide":true,"department":"Software Engineering","lecturer":null,"course":null,"level":null,"day":"Friday","timeSlot":null,"start":16,"end":18}
]`;

    try {
        const result = await geminiGenerateText(apiKey, prompt.trim(), null);
        if (!result.ok) {
            console.error('AI constraint parsing failed:', result.error);
            return [];
        }
        const text = result.text || '';

        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return [];

        let parsed = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(parsed)) return [];

        parsed = parsed.map((row) => {
            const out = { ...row };
            if (out.department) {
                out.department = normalizeDepartmentPhrase(String(out.department), department);
            }
            if (out.departmentWide && !out.department && department) {
                out.department = department;
            }
            if (out.timeSlot === 'Morning' || out.timeSlot === 'morning') {
                out.timeSlot = 'Morning';
            }
            if (out.timeSlot === 'Afternoon' || out.timeSlot === 'afternoon') {
                out.timeSlot = 'Afternoon';
            }
            if (typeof out.start === 'string') out.start = parseInt(out.start, 10);
            if (typeof out.end === 'string') out.end = parseInt(out.end, 10);
            if (Number.isNaN(out.start)) delete out.start;
            if (Number.isNaN(out.end)) delete out.end;

            return out;
        });

        return parsed;
    } catch (error) {
        console.error('AI Parsing failed:', error);
        return [];
    }
};
