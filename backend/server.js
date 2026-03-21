app.get("/", (req, res) => {
  res.json({ 
    status: "NirogBot backend is running!",
    version: "1.0.0",
    message: "Ready to serve health queries"
  });
});


const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const GROQ_API_KEY = process.env.GROQ_API_KEY;

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, language } = req.body;

    const response = await fetch('https://nirogbot.onrender.com/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${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}`
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: messages
      })
    });

    const data = await response.json();
    res.json(data);

  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`NirogBot backend running on port ${PORT}`));