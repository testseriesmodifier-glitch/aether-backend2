import Groq from 'groq-sdk';
import pdf from 'pdf-parse'; // PDF পড়ার লাইব্রেরি

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
        let pdfText = "";

        // 2. PDF Handling Logic
        if (file && file.type === 'application/pdf') {
            try {
                // Base64 থেকে বাফার তৈরি করা
                const base64Data = file.data.split(',')[1];
                const dataBuffer = Buffer.from(base64Data, 'base64');
                
                // PDF থেকে টেক্সট বের করা
                const data = await pdf(dataBuffer);
                pdfText = data.text; // পুরো PDF এর লেখা এখানে
            } catch (err) {
                console.error("PDF Parse Error:", err);
                return res.status(500).json({ error: "Failed to read PDF file." });
            }
        }

        // 3. System Prompt
        const isViva = history && JSON.stringify(history).includes("Professor");
        const systemPrompt = isViva 
            ? "You are Prof. Aether. Use the provided context to ask strict questions."
            : "You are Aether. Use the provided context to help the student.";

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
                // === PDF Mode (Text Based) ===
                messages.push({
                    role: "user",
                    content: `User uploaded a PDF. Here is the content of the PDF:\n\n${pdfText}\n\nUser Question: ${message || "Explain this PDF."}`
                });
            } else if (file.data) {
                // === Image Mode (Vision) ===
                messages.push({
                    role: "user",
                    content: [
                        { type: "text", text: message || "Analyze this image." },
                        { type: "image_url", image_url: { url: file.data } }
                    ]
                });
            }
        } else {
            // === Text Only ===
            messages.push({ role: "user", content: message });
        }

        // 5. Model Selection (🔥🔥 FIXED HERE 🔥🔥)
        // 90b is deprecated, using 11b for vision
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
