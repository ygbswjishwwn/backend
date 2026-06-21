const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3000;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.get('/', (req, res) => res.send('服务正常'));

// 会话管理
app.post('/sessions', async (req, res) => {
  const { data, error } = await supabase.from('sessions').insert({ name: req.body.name || '新对话' }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/sessions', async (req, res) => {
  const { data, error } = await supabase.from('sessions').select('*').order('updated_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/sessions/:id', async (req, res) => {
  const { data, error } = await supabase.from('sessions').update({ name: req.body.name, updated_at: new Date() }).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/sessions/:id', async (req, res) => {
  await supabase.from('messages').delete().eq('session_id', req.params.id);
  await supabase.from('sessions').delete().eq('id', req.params.id);
  res.json({ success: true });
});

// 消息读取
app.get('/sessions/:id/messages', async (req, res) => {
  const { data, error } = await supabase.from('messages').select('*').eq('session_id', req.params.id).eq('visible', true).order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// 设置读写
app.get('/settings', async (req, res) => {
  const { data, error } = await supabase.from('settings').select('*').eq('session_id', 'global').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/settings', async (req, res) => {
  const { data, error } = await supabase.from('settings').update({ ...req.body, updated_at: new Date() }).eq('session_id', 'global').select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// 核心对话
app.post('/chat', async (req, res) => {
  const { session_id, message, model } = req.body;
  try {
    await supabase.from('messages').insert({ session_id, role: 'user', content: message });

    const { data: history } = await supabase.from('messages').select('id, role, content').eq('session_id', session_id).eq('visible', true).order('created_at', { ascending: true });

    const { data: memories } = await supabase.from('memories').select('summary').order('timestamp', { ascending: true });
    const memoryText = memories?.map(m => m.summary).join('\n') || '';

    const { data: settings } = await supabase.from('settings').select('*').eq('session_id', 'global').single();
    const systemPrompt = settings?.system_prompt || '你是一个友善的助手。';

    const messages = [
      { role: 'system', content: `${systemPrompt}\n\n之前的记忆：\n${memoryText}` },
      ...history.map(h => ({ role: h.role, content: h.content }))
    ];

    const response = await fetch('https://ai.lovelss.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RELAY_API_KEY}` },
      body: JSON.stringify({ model: model || 'claude-sonnet-4-6', messages })
    });
    const aiData = await response.json();
    const reply = aiData.choices[0].message.content;

    await supabase.from('messages').insert({ session_id, role: 'assistant', content: reply });

    if (history.length > 20) {
      const toCompress = history.slice(0, 10);
      const compressText = toCompress.map(m => `${m.role}: ${m.content}`).join('\n');
      const compressRes = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` },
        body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'system', content: '把以下对话压缩成简短摘要，保留关键信息。' }, { role: 'user', content: compressText }] })
      });
      const compressData = await compressRes.json();
      const summary = compressData.choices[0].message.content;
      await supabase.from('memories').insert({ session_id: 'global', summary, conversation_id: session_id });
      await supabase.from('messages').update({ visible: false }).in('id', toCompress.map(m => m.id));
    }

    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`服务器跑起来了，端口 ${PORT}`));