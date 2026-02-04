import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Parses natural language constraints into structured JSON rules.
 * @param {string[]} constraints - Array of NL strings
 * @param {string} apiKey - Gemini API Key
 * @returns {Promise<Array>} Structured constraints
 */
export const parseAIConstraints = async (constraints, apiKey) => {
    if (!apiKey || constraints.length === 0) return [];

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const prompt = `
        You are a scheduling assistant for a University. 
        Convert the following natural language constraints into a structured JSON array.
        
        Constraints:
        ${constraints.join("\n")}
        
        Output Format (STRICT JSON):
        [
          {
            "lecturer": "Full Name",
            "day": "Monday|Tuesday|Wednesday|Thursday|Friday",
            "start": 9, // Start hour in 24h (9-17)
            "end": 12   // End hour in 24h (9-17)
          }
        ]
        
        Rules:
        - "Morning" means 9 to 12.
        - "Afternoon" means 13 to 17.
        - If a specific hour is mentioned, use it.
        - Only return the JSON array.
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

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
