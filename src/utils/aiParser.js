import { geminiGenerateText } from './geminiApi';

/**
 * Parses natural language constraints into structured JSON rules.
 * @param {string[]} constraintLines - Array of NL strings
 * @param {string} apiKey - Gemini API Key
 * @param {Object} context - { courses: [], lecturers: [], department?: string }
 * @returns {Promise<Array>} Structured constraints
 */
export const parseAIConstraints = async (
    constraintLines,
    apiKey,
    context = { courses: [], lecturers: [], department: '' }
) => {
    if (!apiKey || constraintLines.length === 0) return [];

    const lecturerNames = context.lecturers.map((l) => `${l.title} ${l.name}`).join(', ');
    const courseList = context.courses
        .map((c) => `${c.code}${c.level ? ` (L${c.level})` : ''}`)
        .join(', ');
    const department = context.department || '';

    const prompt = `
You are a university timetable constraints assistant.

Department scheduling context:
- Department: ${department || '(not specified)'}
- Known lecturers (match names exactly when a rule names a person): ${lecturerNames}
- Known courses this run (match codes like CSC301; section suffixes like CSC301-S1 still map to CSC301): ${courseList}

Convert EACH bullet/rule below into one or more objects in a JSON array. Every object must use this shape:

{
  "type": "Exclusion",
  "departmentWide": boolean,
  "lecturer": string | null,
  "course": string | null,
  "level": "100" | "200" | "300" | "400" | null,
  "day": "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | null,
  "timeSlot": "Morning" | "Afternoon" | "All Day" | null,
  "start": number | null,
  "end": number | null
}

Rules for filling fields:
- type is always "Exclusion" for things to BLOCK (unavailable, no class, must not run, etc.).
- departmentWide: true when the rule applies to ALL courses in this scheduling batch (e.g. "no classes Friday afternoon", "department meeting Monday morning"). Omit specific lecturer/course/level when you set departmentWide true unless the text also narrows scope.
- lecturer: full name as listed above when the rule is about one person's availability; else null.
- course: course code only (e.g. CSC301) when the rule names one course; else null.
- level: "200" if the rule says 200-level / 200L / second year only; else null.
- day: the weekday if specified; else null.
- timeSlot: use "Morning" for 9am-12pm, "Afternoon" for 1pm-5pm, "All Day" for full teaching day, if those phrases fit; else null.
- start/end: optional explicit 24-hour integers (9-17) for the forbidden window. If you use start/end, prefer start inclusive and end exclusive (e.g. morning 9-12 → start 9, end 12). Use null if using only timeSlot.

If both timeSlot and start/end apply, prefer start/end for precision.

Natural language rules to parse:
${constraintLines.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Output ONLY a valid JSON array. No markdown, no commentary.
`;

    try {
        const result = await geminiGenerateText(apiKey, prompt.trim(), null);
        if (!result.ok) {
            console.error('AI constraint parsing failed:', result.error);
            return [];
        }
        const text = result.text || '';

        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return Array.isArray(parsed) ? parsed : [];
        }
        return [];
    } catch (error) {
        console.error('AI Parsing failed:', error);
        return [];
    }
};
