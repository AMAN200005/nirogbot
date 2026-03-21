const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());

const GROQ_API_KEY = process.env.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;

// TEST ROUTE
app.get("/", (req, res) => {
  res.json({
    status: "NirogBot backend is running!",
    version: "1.0.0",
    message: "Ready to serve health queries"
  });
});

// CHAT ROUTE
app.post("/api/chat", async (req, res) => {
  try {
    const { message, language } = req.body;

    const languageInstructions = {
      "english": "Always respond in English.",
      "hindi": "हमेशा हिंदी में जवाब दें। (Always respond in Hindi language only.)",
      "odia": "ସର୍ବଦା ଓଡ଼ିଆ ଭାଷାରେ ଉତ୍ତର ଦିଅନ୍ତୁ। (Always respond in Odia language only.)",
      "tamil": "எப்போதும் தமிழில் மட்டுமே பதில் அளிக்கவும். (Always respond in Tamil language only.)"
    };

    const langInstruction = languageInstructions[language] || languageInstructions["english"];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${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}`
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [
          {
            role: "system",
            content: `You are NirogBot, a public health awareness assistant.
Help users understand symptoms, diseases, prevention and general health queries.
Keep responses concise, friendly and informative.
Always remind users to consult a doctor for proper diagnosis.
Do not prescribe specific medications. Stick to general WHO-approved health guidance.
${langInstruction}`
          },
          { role: "user", content: message }
        ]
      })
    });

    const data = await response.json();
    res.json(data);

  } catch(err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`NirogBot backend running on port ${PORT}`));