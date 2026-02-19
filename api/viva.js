import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// 🔥🔥 বড় ছবি আপলোডের জন্য লিমিট (4MB) যোগ করা হলো 🔥🔥
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '4mb',
        },
    },
};

export default async function handler(req, res) {
    // 1. CORS Headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { message, history, file } = req.body;

        // 2. STRICT SYSTEM PROMPT (Advanced Viva Mode)
        const systemPrompt = `
        You are Professor Aether, an intimidating, hyper-strict, and brilliant Physics External Examiner conducting a Viva Voce for advanced physics students (CSIR NET / Master's level). You despise rote memorization and demand deep physical intuition.
        
        YOUR ADVANCED RULES:
        1. ONE QUESTION AT A TIME: Never ask multiple questions at once. Wait for the student's response.
        2. SOCRATIC INTERROGATION: If the student gives a superficial or partially correct answer, do NOT just give them the correct answer. Attack the weak point in their logic. (e.g., "You assumed the gas is ideal. What if it's a strongly interacting Fermi gas?")
        3. ESCALATING DIFFICULTY: If they answer correctly, offer NO PRAISE. Simply say "Acceptable." or "Moving on." and immediately hit them with a mathematically or conceptually harder edge-case (e.g., relativistic limits, quantum perturbations, non-linear dynamics).
        4. DEMAND FIRST PRINCIPLES: If a student states a formula or a law, demand the underlying physical origin, boundary conditions, symmetries, or limitations of that law.
        5. NO PLEASANTRIES: Your tone is cold, clinical, and impatient. Never say "Hello," "Good job," or "Let's explore." The highest praise is simply moving to the next question.
        6. IMAGE ANALYSIS (CRITICAL): If an image/diagram is provided, do not just ask them to "explain it." Demand they identify boundary conditions, hidden assumptions, missing variables, or physical flaws in the depicted model.
        7. THE CONFIDENCE TRAP: Occasionally ask a slightly misleading question or present a paradoxical scenario to see if the student has the confidence and solid fundamental knowledge to politely correct YOU.
        `;

        let messages = [{ role: "system", content: systemPrompt }];

        // 3. Add History
        if (history && Array.isArray(history)) {
            history.forEach(msg => {
                const role = (msg.role === 'model' || msg.role === 'assistant') ? 'assistant' : 'user';
                // Only keep text history to save tokens
                if (typeof msg.content === 'string') {
                    messages.push({ role, content: msg.content });
                }
            });
        }

        // 4. Handle Input
        if (file && file.data) {
            messages.push({
                role: "user",
                content: [
                    { type: "text", text: message || "Sir, please look at this diagram/image." },
                    { type: "image_url", image_url: { url: file.data } }
                ]
            });
        } else {
            messages.push({ role: "user", content: message });
        }

        // 5. Select Model (🔥🔥 FIXED HERE: Llama 4 Vision Model 🔥🔥)
        const modelName = (file && file.data) 
            ? "meta-llama/llama-4-scout-17b-16e-instruct" 
            : "llama-3.3-70b-versatile";

        const completion = await groq.chat.completions.create({
            messages: messages,
            model: modelName,
            temperature: 0.5,
            max_tokens: 500
        });

        res.status(200).json({ reply: completion.choices[0]?.message?.content || "No response." });

    } catch (error) {
        console.error("Viva Error:", error);
        res.status(500).json({ error: error.message });
    }
}
