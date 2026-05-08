import OpenAI from 'openai';

const API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';

export async function generateWithOpenAI(prompt) {
  if (!API_KEY) throw new Error('OpenAI API key not set. Add VITE_OPENAI_API_KEY to your .env file.');
  const openai = new OpenAI({ apiKey: API_KEY, dangerouslyAllowBrowser: true });
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
  });
  return response.choices[0].message.content;
}
