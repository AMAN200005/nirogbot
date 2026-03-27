const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.get("/", (req, res) => {
  res.json({
    status: "NirogBot backend is running!",
    version: "1.0.0",
    message: "Ready to serve health queries"
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message, language } = req.body;

    if (!message) return res.status(400).json({ error: "Message is required" });
    if (!GROQ_API_KEY) return res.status(500).json({ error: "API key not configured" });

    const languageInstructions = {
      "english": "Always respond in English.",
      "hindi": "हमेशा हिंदी में जवाब दें।",
      "odia": "You MUST respond ONLY in Odia language (ଓଡ଼ିଆ). Do not use Bengali, Hindi or any other language. Every single word must be in Odia script. Do NOT use any markdown formatting like ** or * — use plain text only. ସର୍ବଦା କେବଳ ଓଡ଼ିଆ ଭାଷାରେ ଉତ୍ତର ଦିଅନ୍ତୁ।",
      "tamil": "எப்போதும் தமிழில் மட்டுமே பதில் அளிக்கவும்."
    };

    const langInstruction = languageInstructions[language] || languageInstructions["english"];

    const systemPrompt = `IMPORTANT: You must ALWAYS respond in the language specified at the end of this prompt. Never switch languages under any circumstances.
You are NirogBot, a public health awareness assistant.
Help users understand symptoms, diseases, prevention and general health queries.
Keep responses concise, friendly and informative.
Always remind users to consult a doctor for proper diagnosis.
Do not prescribe specific medications.
LANGUAGE INSTRUCTION (STRICTLY FOLLOW): ${langInstruction}`;

    // Use Gemini for Odia
    if (language === "odia") {
      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-002:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${systemPrompt}\n\nUser: ${message}`
            }]
          }]
        })
      });

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        console.error("Gemini API error:", geminiRes.status, errText);
        return res.status(502).json({ error: "Gemini API error", detail: errText });
      }

      const geminiData = await geminiRes.json();
      const reply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "No response from model.";

      // Return in same format as Groq so frontend works unchanged
      return res.json({
        choices: [{ message: { content: reply } }]
      });
    }

    // Use Groq for all other languages
    const model = (language === "hindi" || language === "tamil")
      ? "llama-3.3-70b-versatile"
      : "llama-3.1-8b-instant";

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ]
      })
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error("Groq API error:", groqRes.status, errText);
      return res.status(502).json({ error: "Groq API error", detail: errText });
    }

    const data = await groqRes.json();
    res.json(data);

  } catch(err) {
    console.error("Chat route error:", err.message);
    res.status(500).json({ error: "Server error", detail: err.message });
  }
});

// In-memory trend store
let globalTrends = {};

// POST /api/trend — increment disease count
app.post("/api/trend", (req, res) => {
  const { disease } = req.body;
  if (!disease) return res.status(400).json({ error: "Disease required" });
  if (!globalTrends[disease]) globalTrends[disease] = 0;
  globalTrends[disease]++;
  res.json({ disease, count: globalTrends[disease] });
});

// GET /api/trends — get all counts
app.get("/api/trends", (req, res) => {
  res.json(globalTrends);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`NirogBot backend running on port ${PORT}`));
