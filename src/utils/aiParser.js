/**
 * Parses natural language constraints into structured JSON rules.
 * @param {string[]} constraints - Array of NL strings
 * @param {string} apiKey - Gemini API Key
 * @param {Object} context - { courses: [], lecturers: [] }
 * @returns {Promise<Array>} Structured constraints
 */
export const parseAIConstraints = async (constraints, apiKey, context = { courses: [], lecturers: [] }) => {
    if (!apiKey || constraints.length === 0) return [];

    const lecturerNames = context.lecturers.map(l => `${l.title} ${l.name}`).join(", ");
    const courseCodes = context.courses.map(c => c.code).join(", ");

    const prompt = `
        You are a scheduling assistant for Nile University. 
        Convert the following natural language constraints into a structured JSON array.
        
        Department Context:
        - Registered Lecturers: ${lecturerNames}
        - Registered Courses: ${courseCodes}
        
        Constraints to Parse:
        ${constraints.join("\n")}
        
        Output Format (STRICT JSON ARRAY):
        [
          {
            "lecturer": "Full Name", // Match exactly from Registered Lecturers if mentioned
            "course": "Course Code", // Match exactly from Registered Courses if mentioned
            "level": "100|200|300|400", // The level this rule applies to
            "day": "Monday|Tuesday|Wednesday|Thursday|Friday",
            "start": 9, // Start hour in 24h (9-17)
            "end": 12,   // End hour in 24h (9-17)
            "priority": "high|normal" // "high" if it says "start with", "must be first", etc.
          }
        ]
        
        Rules:
        - "Morning" means 9 to 12.
        - "Afternoon" means 13 to 17.
        - If a specific hour is mentioned, use it.
        - If the rule is about a level (e.g., "300 level should start with..."), set "level" to "300".
        - If the rule is about a specific course starting first, set "priority" to "high" for that course.
        - Only return the JSON array, no explanation or markdown blocks.
    `;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemma-3-4b-it:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        });
        
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

        // Clean markdown code blocks if present
        const jsonMatch = text.match(/\[.*\]/s);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return [];
    } catch (error) {
        console.error("AI Parsing failed:", error);
        return [];
    }
};
