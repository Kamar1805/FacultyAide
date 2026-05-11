/**
 * Google AI Studio (Generative Language API) helpers.
 * API key: https://aistudio.google.com/apikey
 *
 * Override models: set VITE_GEMINI_MODEL to one id, or comma-separated fallbacks
 * (e.g. "gemini-flash-latest,gemini-2.0-flash").
 */

export function getGeminiModelCandidates() {
    const raw = import.meta.env.VITE_GEMINI_MODEL;
    if (raw && String(raw).trim()) {
        return String(raw)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    }
    return ["gemini-flash-latest", "gemini-2.0-flash", "gemini-2.5-flash", "gemma-3-4b-it"];
}

function buildGeminiUrl(apiKey, modelId) {
    const key = encodeURIComponent(apiKey);
    return `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${key}`;
}

/**
 * @param {string} apiKey
 * @param {string} userText – user message
 * @param {string|null} systemInstruction – optional system prompt (Gemini 1.5+)
 * @returns {Promise<{ ok: boolean, text?: string, error?: string, modelUsed?: string }>}
 */
export async function geminiGenerateText(apiKey, userText, systemInstruction = null) {
    if (!apiKey || !String(apiKey).trim()) {
        return { ok: false, error: "API key missing" };
    }

    const buildBody = (withSystem) => {
        if (withSystem && systemInstruction) {
            return {
                systemInstruction: { parts: [{ text: systemInstruction }] },
                contents: [{ role: "user", parts: [{ text: userText }] }],
            };
        }
        const combined = systemInstruction
            ? `${systemInstruction}\n\n---\n\nUser question:\n${userText}`
            : userText;
        return {
            contents: [{ role: "user", parts: [{ text: combined }] }],
        };
    };

    const models = getGeminiModelCandidates();
    let lastError = "No model candidates";

    for (const modelId of models) {
        const url = buildGeminiUrl(apiKey, modelId);

        let res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildBody(true)),
        });
        let data = await res.json();

        if (!res.ok && systemInstruction) {
            res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildBody(false)),
            });
            data = await res.json();
        }

        if (!res.ok) {
            lastError = data?.error?.message || `HTTP ${res.status} (${modelId})`;
            continue;
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
            const reason = data.candidates?.[0]?.finishReason;
            lastError =
                reason
                    ? `Model stopped (${reason}) [${modelId}]`
                    : `Empty response [${modelId}]`;
            continue;
        }

        return { ok: true, text, modelUsed: modelId };
    }

    return {
        ok: false,
        error: `${lastError}. Set VITE_GEMINI_MODEL in .env to a model your key supports (see AI Studio).`,
    };
}
