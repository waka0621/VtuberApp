const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'user',
  password: process.env.POSTGRES_PASSWORD || 'password',
  host: process.env.POSTGRES_HOST || 'db',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'task_db'
});

app.get('/health', (req, res) => res.json({ status: 'OK' }));

// 最小: 一覧取得
    app.get('/api/vtubers', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM vtubers'
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch table data' });
  }
});

// vtubers テーブルへ1件追加（vtuber_idは自動採番）
app.post('/api/vtubers', async (req, res) => {
  try {
    const { name, gender, group_name, birthday, color_code, notes } = req.body;

    // 空文字("")で届いたオプショナルな項目は、DBにNULLとして入るように null に変換する
    const dbGroupName = group_name || null;
    const dbBirthday = birthday || null;
    const dbColorCode = color_code || null;
    const dbNotes = notes || null;

    const result = await pool.query(
      `INSERT INTO vtubers (name, gender, group_name, birthday, color_code, notes) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, gender, dbGroupName, dbBirthday, dbColorCode, dbNotes]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to insert vtuber' });
  }
});


// シンプルなエラーハンドラ
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend listening on ${PORT}`));