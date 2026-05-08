import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

export async function generateWithGemini(prompt) {
  if (!API_KEY) throw new Error('Gemini API key not set. Add VITE_GEMINI_API_KEY to your .env file.');
  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  const result = await model.generateContent(prompt);
  return result.response.text();
}
