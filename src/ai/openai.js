// Gemini AI utility — replaces the old OpenAI integration
const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`;

export async function generateWithOpenAI(prompt) {
  if (!GEMINI_KEY) throw new Error('Gemini API key not set. Add VITE_GEMINI_API_KEY to your .env file.');

  const resp = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
    }),
  });

  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error?.message || `Gemini API error: HTTP ${resp.status}`);
  }

  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}
