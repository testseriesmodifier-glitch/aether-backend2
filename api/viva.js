import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req, res) {
    // 1. CORS Headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { message, history, file } = req.body;

        // 2. STRICT SYSTEM PROMPT (For Viva Mode)
        const systemPrompt = `
        You are Professor Aether, a strict and critical Physics External Examiner conducting a Viva Voce.
        
        YOUR RULES:
        1. Ask ONE tough conceptual question at a time.
        2. Keep your responses short, direct, and serious.
        3. Evaluate the student's answer strictly. If they are wrong, correct them sternly.
        4. If they are correct, ask a harder follow-up question immediately.
        5. Do not be helpful or friendly. Test their depth of knowledge.
        6. If an image is provided, ask them to explain the physics concepts visible in it.
        `;

        let messages = [{ role: "system", content: systemPrompt }];

        // 3. Add History (Context)
        if (history && Array.isArray(history)) {
            history.forEach(msg => {
                const role = (msg.role === 'model' || msg.role === 'assistant') ? 'assistant' : 'user';
                // Only keep text history to save tokens
                if (typeof msg.content === 'string') {
                    messages.push({ role, content: msg.content });
                }
            });
        }

        // 4. Handle Current Input (Text or Image)
        if (file && file.data) {
            // === Vision Mode (Student showing diagram/graph) ===
            messages.push({
                role: "user",
                content: [
                    { type: "text", text: message || "Sir, please look at this diagram/image." },
                    { type: "image_url", image_url: { url: file.data } }
                ]
            });
        } else {
            // === Text Mode ===
            messages.push({ role: "user", content: message });
        }

        // 5. Select Model (FIXED HERE)
        // llama-3.2-90b is deprecated. Using llama-3.2-11b instead.
        const modelName = (file && file.data) 
            ? "llama-3.2-11b-vision-preview" 
            : "llama-3.3-70b-versatile";

        const completion = await groq.chat.completions.create({
            messages: messages,
            model: modelName,
            temperature: 0.5, // Strict mode
            max_tokens: 500
        });

        res.status(200).json({ reply: completion.choices[0]?.message?.content || "No response." });

    } catch (error) {
        console.error("Viva Error:", error);
        res.status(500).json({ error: error.message });
    }
}
