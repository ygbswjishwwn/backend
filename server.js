const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('服务正常');
});

app.listen(PORT, () => {
  console.log(`服务器跑起来了，端口 ${PORT}`);
});