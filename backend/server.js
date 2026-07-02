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

//users　テーブル設置
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM users'
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

//users テーブルへ1件追加
app.post('/api/users', async (req, res) => {
  const { user_id, nickname, email, password } = req.body || {};
  if (!user_id || !nickname || !email || !password) {
    return res.status(400).json({ error: 'user_id, nickname, email, password はすべて必須です' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO users (user_id, nickname, email, password) VALUES ($1, $2, $3, $4) RETURNING *',
      [user_id, nickname, email, password]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to insert user' });
  }
});

// vtubers テーブルの一覧取得
app.get('/api/vtubers', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM vtubers ORDER BY vtuber_id'
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch vtubers' });
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

 //{table名} の特定 id を削除（table内id} を使用）
app.delete('/api/vtubers/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query(
      'DELETE FROM vtubers WHERE vtuber_id = $1 RETURNING *',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.json({ deleted: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// vtuber_linksテーブルの一覧取得
app.get('/api/vtuber_links', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM vtuber_links'
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch vtuber links' });
  }
});

// vtuber_id に紐付いたリンク一覧を取得
app.get('/api/vtubers/:id/links', async (req, res) => {
  const vtuberId = req.params.id;
  try {
    const result = await pool.query(
      'SELECT * FROM vtuber_links WHERE vtuber_id = $1',
      [vtuberId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch links for vtuber' });
  }
});

// vtuber_links テーブルへ1件追加
app.post('/api/vtuber_links', async (req, res) => {
  try {
    const { vtuber_id, site_name, url, notes } = req.body;
    console.log(req.body);
    const result = await pool.query(
      'INSERT INTO vtuber_links (vtuber_id, site_name, url, notes) VALUES ($1, $2, $3, $4) RETURNING *',
      [vtuber_id, site_name || null, url || null, notes || null]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to insert vtuber link' });
  }
});

// vtuber_links テーブルから link_id を使用して1件削除
app.delete('/api/vtuber_links/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query(
      'DELETE FROM vtuber_links WHERE link_id = $1 RETURNING *',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.json({ deleted: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete vtuber link' });
  }
});

//推し登録テーブルの一覧取得
app.get('/api/favorites', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM user_favorites'
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

// 推し登録テーブルに一件追加 (vtuber_id, user_id)
app.post('/api/favorites', async (req, res) => {
  const { vtuber_id, user_id } = req.body || {};
  if (!vtuber_id || !user_id) {
    return res.status(400).json({ error: 'vtuber_id と user_id は両方必須です' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO user_favorites (vtuber_id, user_id) VALUES ($1, $2) RETURNING *',
      [vtuber_id, user_id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to insert favorite' });
  }
});

// シンプルなエラーハンドラ
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend listening on ${PORT}`));