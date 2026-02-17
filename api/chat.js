import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { message, history, file } = req.body;

        // Viva Mode Check
        const isViva = history && JSON.stringify(history).includes("Professor");
        const systemPrompt = isViva 
            ? "You are Prof. Aether, a strict physics examiner. Keep answers short and critical."
            : "You are Aether, a helpful Physics AI. Use LaTeX for math.";

        let messages = [{ role: "system", content: systemPrompt }];

        if (history && Array.isArray(history)) {
            history.forEach(msg => {
                if (typeof msg.content === 'string') {
                    messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content });
                }
            });
        }

        if (file && file.data) {
            messages.push({
                role: "user",
                content: [
                    { type: "text", text: message || "Analyze this image." },
                    { type: "image_url", image_url: { url: file.data } }
                ]
            });
        } else {
            messages.push({ role: "user", content: message });
        }

        const completion = await groq.chat.completions.create({
            messages: messages,
            model: file ? "llama-3.2-11b-vision-preview" : "llama-3.3-70b-versatile",
            temperature: 0.7,
            max_tokens: 1024
        });

        res.status(200).json({ reply: completion.choices[0]?.message?.content || "No response." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
