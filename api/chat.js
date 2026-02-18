import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// 🔥🔥 এই অংশটি মিসিং ছিল - এটি ছাড়া ছবি আপলোড হবে না 🔥🔥
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '4mb', // 1MB থেকে বাড়িয়ে 4MB করা হলো
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
        let pdfText = "";

        // 2. PDF Handling (Safe require)
        if (file && file.type === 'application/pdf') {
            try {
                // নিরাপদে লাইব্রেরি লোড করা (যাতে সার্ভার ক্র্যাশ না করে)
                const pdf = require('pdf-parse'); 
                const base64Data = file.data.split(',')[1];
                const dataBuffer = Buffer.from(base64Data, 'base64');
                const data = await pdf(dataBuffer);
                pdfText = data.text.substring(0, 6000); // টেক্সট ছোট করা
            } catch (err) {
                console.error("PDF Error:", err);
                // PDF ফেইল করলেও কোড থামবে না
                pdfText = "Error reading PDF file. Please rely on user description.";
            }
        }

        // 3. System Prompt
        const isViva = history && JSON.stringify(history).includes("Professor");
        const systemPrompt = isViva 
            ? "You are Prof. Aether. Use context to ask tough questions."
            : "You are Aether. Use context to explain physics clearly.";

        let messages = [{ role: "system", content: systemPrompt }];

        // Add History
        if (history && Array.isArray(history)) {
            history.forEach(msg => {
                if (typeof msg.content === 'string') {
                    messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content });
                }
            });
        }

        // 4. Message Construction
        if (file) {
            if (file.type === 'application/pdf') {
                // PDF Mode
                messages.push({
                    role: "user",
                    content: `PDF Content:\n${pdfText}\n\nQuestion: ${message || "Explain this."}`
                });
            } else if (file.data) {
                // Image Mode
                messages.push({
                    role: "user",
                    content: [
                        { type: "text", text: message || "Analyze this image." },
                        { type: "image_url", image_url: { url: file.data } }
                    ]
                });
            }
        } else {
            // Text Mode
            messages.push({ role: "user", content: message || "Hello" });
        }

        // 5. Model Selection (11b for Vision, 70b for Text)
        const isImage = file && file.type.startsWith('image/');
        const modelName = isImage ? "llama-3.2-11b-vision-preview" : "llama-3.3-70b-versatile";

        const completion = await groq.chat.completions.create({
            messages: messages,
            model: modelName,
            temperature: 0.6,
            max_tokens: 1024
        });

        res.status(200).json({ reply: completion.choices[0]?.message?.content || "No response." });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: error.message });
    }
}
