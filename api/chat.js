import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// সাইজ লিমিট (বড় ছবির জন্য)
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '4mb',
        },
    },
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { message, history, file } = req.body;
        let pdfText = "";

        // PDF Handling
        if (file && file.type === 'application/pdf') {
            try {
                const pdf = require('pdf-parse'); 
                const base64Data = file.data.split(',')[1];
                const dataBuffer = Buffer.from(base64Data, 'base64');
                const data = await pdf(dataBuffer);
                pdfText = data.text.substring(0, 6000); 
            } catch (err) {
                console.error("PDF Error:", err);
                pdfText = "Error reading PDF. Please describe the question."; 
            }
        }

        // System Prompt
        const isViva = history && JSON.stringify(history).includes("Professor");
        const systemPrompt = isViva 
            ? "You are Prof. Aether. Strict examiner."
            : "You are Aether. Helpful physics assistant.";

        let messages = [{ role: "system", content: systemPrompt }];

        if (history && Array.isArray(history)) {
            history.forEach(msg => {
                if (typeof msg.content === 'string') {
                    messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content });
                }
            });
        }

        // Construct Message
        if (file) {
            if (file.type === 'application/pdf') {
                messages.push({
                    role: "user",
                    content: `PDF Content:\n${pdfText}\n\nQuestion: ${message}`
                });
            } else if (file.data) {
                messages.push({
                    role: "user",
                    content: [
                        { type: "text", text: message || "Analyze this image." },
                        { type: "image_url", image_url: { url: file.data } }
                    ]
                });
            }
        } else {
            messages.push({ role: "user", content: message });
        }

        // 🔥🔥 Llama 4 Vision মডেল যুক্ত করা হয়েছে 🔥🔥
        const isImage = file && file.type && file.type.startsWith('image/');
        const modelName = isImage 
            ? "meta-llama/llama-4-scout-17b-16e-instruct"  // <--- নতুন Llama 4 Vision Model
            : "llama-3.3-70b-versatile";       

        const completion = await groq.chat.completions.create({
            messages: messages,
            model: modelName,
            temperature: 0.6,
            max_tokens: 1024
        });

        res.status(200).json({ reply: completion.choices[0]?.message?.content || "No response." });

    } catch (error) {
        console.error("API Error:", error);
        res.status(500).json({ error: error.message });
    }
}
