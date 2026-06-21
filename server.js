
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('服务正常');
});

app.post('/chat', async (req, res) => {
  const { message } = req.body;
  try {
    const response = await fetch('https://ai.lovelss.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RELAY_API_KEY}`
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        messages: [{ role: 'user', content: message }]
      })
    });
    const data = await response.json();
    res.json({ reply: data.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: '出错了' });
  }
});

app.listen(PORT, () => {
  console.log(`服务器跑起来了，端口 ${PORT}`);
});