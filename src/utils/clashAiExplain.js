import { geminiGenerateText } from './geminiApi';

/**
 * Optional Gemini explanation for clash reports (no API key → null).
 */
export async function explainClashesWithAi(apiKey, kind, analysisText) {
    if (!apiKey || !analysisText?.trim()) return { ok: false, text: null };
    const prompt = `You are an academic scheduling officer. The following ${kind} clash analysis was produced by deterministic checks (venues and lecturers for lectures; venues and same-department same-level cohort for exams).

If the report says there are NO clashes, respond with a short confirmation: "No clash detected — the combined timetables do not share a physical room or instructor (lectures) or violate venue/cohort rules (exams) in overlapping time windows."

If there ARE clashes, list each issue in plain language with the exact pair mentioned, then give ONE concrete fix per issue (reschedule, change room, split cohort, etc.). Keep under 400 words.

Report:
${analysisText}`;

    const result = await geminiGenerateText(apiKey, prompt, null);
    if (!result.ok) return { ok: false, text: null, error: result.error };
    return { ok: true, text: result.text?.trim() || '' };
}
