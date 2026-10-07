const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const {
  createHmac,
  randomBytes,
  scrypt: scryptCallback,
  timingSafeEqual
} = require('crypto');
const { promisify } = require('util');

const app = express();
app.use(cors());
app.use(express.json());

const scrypt = promisify(scryptCallback);
const tokenSecret = process.env.AUTH_TOKEN_SECRET || randomBytes(32).toString('hex');
const tokenLifetimeSeconds = 12 * 60 * 60;

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'user',
  password: process.env.POSTGRES_PASSWORD || 'password',
  host: process.env.POSTGRES_HOST || 'db',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'task_db'
});

app.get('/health', (req, res) => res.json({ status: 'OK' }));

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${hash.toString('hex')}`;
}

async function verifyPassword(password, storedPassword) {
  const [algorithm, salt, storedHash] = storedPassword.split('$');
  if (algorithm !== 'scrypt' || !salt || !/^[0-9a-f]{128}$/i.test(storedHash || '')) {
    const passwordBuffer = Buffer.from(password);
    const storedBuffer = Buffer.from(storedPassword);
    return passwordBuffer.length === storedBuffer.length
      && timingSafeEqual(passwordBuffer, storedBuffer);
  }

  const hash = await scrypt(password, salt, 64);
  return timingSafeEqual(hash, Buffer.from(storedHash, 'hex'));
}

function createAuthToken(userId) {
  const payload = Buffer.from(JSON.stringify({
    userId,
    expiresAt: Math.floor(Date.now() / 1000) + tokenLifetimeSeconds
  })).toString('base64url');
  const signature = createHmac('sha256', tokenSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function requireAuthentication(req, res, next) {
  const authorization = req.get('Authorization') || '';
  const match = authorization.match(/^Bearer ([A-Za-z0-9_.-]+)$/);
  if (!match) {
    return res.status(401).json({ error: 'ログインしてください' });
  }

  const [payload, signature] = match[1].split('.');
  if (!payload || !signature) {
    return res.status(401).json({ error: 'ログインの有効期限が切れました。再度ログインしてください' });
  }

  const expectedSignature = createHmac('sha256', tokenSecret).update(payload).digest();
  let receivedSignature;
  try {
    receivedSignature = Buffer.from(signature, 'base64url');
  } catch (error) {
    return res.status(401).json({ error: 'ログインの有効期限が切れました。再度ログインしてください' });
  }

  if (receivedSignature.length !== expectedSignature.length
    || !timingSafeEqual(receivedSignature, expectedSignature)) {
    return res.status(401).json({ error: 'ログインの有効期限が切れました。再度ログインしてください' });
  }

  try {
    const tokenData = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!Number.isInteger(tokenData.userId) || tokenData.expiresAt <= Date.now() / 1000) {
      return res.status(401).json({ error: 'ログインの有効期限が切れました。再度ログインしてください' });
    }
    req.userId = tokenData.userId;
  } catch (error) {
    return res.status(401).json({ error: 'ログインの有効期限が切れました。再度ログインしてください' });
  }

  next();
}

// ログイン中のユーザー情報（認証情報は返さない）
app.get('/api/users', requireAuthentication, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT user_id, nickname, email FROM users WHERE user_id = $1',
      [req.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

//users テーブルへ1件追加
app.post('/api/users', async (req, res) => {
  const { nickname, email, password } = req.body || {};
  if (!nickname || !password) {
    return res.status(400).json({ error: 'nickname と password は必須です' });
  }

  try {
    const optionalEmail = email || null;
    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      'INSERT INTO users (user_id, nickname, email, password) VALUES (DEFAULT, $1, $2, $3) RETURNING user_id, nickname, email',
      [nickname, optionalEmail, passwordHash]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    if (error.code === '23505') {
      return res.status(409).json({
        error: error.constraint && error.constraint.includes('nickname')
          ? 'このニックネームは既に登録されています'
          : 'このメールアドレスは既に登録されています'
      });
    }
    res.status(500).json({ error: 'Failed to insert user' });
  }
});

app.post('/api/login', async (req, res) => {
  const { identifier, email, password } = req.body || {};
  const loginIdentifier = identifier || email;
  if (!loginIdentifier || !password) {
    return res.status(400).json({ error: 'ニックネーム（またはメールアドレス）とパスワードを入力してください' });
  }

  try {
    const result = await pool.query(
      'SELECT user_id, nickname, email, password FROM users WHERE nickname = $1 OR email = $1',
      [loginIdentifier]
    );
    const matchingUsers = [];
    for (const candidate of result.rows) {
      if (await verifyPassword(password, candidate.password)) {
        matchingUsers.push(candidate);
      }
    }
    if (matchingUsers.length === 0) {
      return res.status(401).json({ error: 'ニックネーム（またはメールアドレス）またはパスワードが正しくありません' });
    }
    if (matchingUsers.length > 1) {
      return res.status(409).json({ error: 'ログイン情報が重複しています。ニックネームを変更してください' });
    }
    const user = matchingUsers[0];

    if (!user.password.startsWith('scrypt$')) {
      const passwordHash = await hashPassword(password);
      await pool.query('UPDATE users SET password = $1 WHERE user_id = $2', [passwordHash, user.user_id]);
    }

    res.json({
      token: createAuthToken(user.user_id),
      user: { user_id: user.user_id, nickname: user.nickname, email: user.email }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'ログインに失敗しました' });
  }
});

app.get('/api/me', requireAuthentication, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT users.user_id, users.nickname, users.email,
              vtubers.vtuber_id, vtubers.name, vtubers.gender,
              vtubers.group_name, vtubers.birthday, vtubers.color_code, vtubers.notes
       FROM users
       LEFT JOIN user_favorites ON user_favorites.user_id = users.user_id
       LEFT JOIN vtubers ON vtubers.vtuber_id = user_favorites.vtuber_id
       WHERE users.user_id = $1
       ORDER BY vtubers.vtuber_id`,
      [req.userId]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'ユーザーが見つかりません。再度ログインしてください' });
    }

    const { user_id, nickname, email } = result.rows[0];
    const favorites = result.rows
      .filter((row) => row.vtuber_id !== null)
      .map(({ vtuber_id, name, gender, group_name, birthday, color_code, notes }) => ({
        vtuber_id,
        name,
        gender,
        group_name,
        birthday,
        color_code,
        notes
      }));

    res.json({ user: { user_id, nickname, email }, favorites });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'ユーザー情報の取得に失敗しました' });
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

// ログイン中のユーザーの推し一覧
app.get('/api/favorites', requireAuthentication, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT vtubers.vtuber_id, vtubers.name, vtubers.gender,
              vtubers.group_name, vtubers.birthday, vtubers.color_code, vtubers.notes
       FROM user_favorites
       JOIN vtubers ON vtubers.vtuber_id = user_favorites.vtuber_id
       WHERE user_favorites.user_id = $1
       ORDER BY vtubers.vtuber_id`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

// ログイン中のユーザーの推しを登録
app.post('/api/favorites', requireAuthentication, async (req, res) => {
  const { vtuber_id } = req.body || {};
  if (!Number.isInteger(vtuber_id) || vtuber_id <= 0) {
    return res.status(400).json({ error: '有効な vtuber_id を入力してください' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO user_favorites (vtuber_id, user_id) VALUES ($1, $2) RETURNING *',
      [vtuber_id, req.userId]
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
async function startServer() {
  try {
    await pool.query('ALTER TABLE users ALTER COLUMN password TYPE TEXT');
    await pool.query('ALTER TABLE users ALTER COLUMN email DROP NOT NULL');
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS users_nickname_unique_idx ON users (nickname)');
  } catch (error) {
    console.error('Failed to prepare the users table. Check for duplicate nicknames:', error);
    process.exitCode = 1;
    return;
  }

  app.listen(PORT, () => console.log(`Backend listening on ${PORT}`));
}

startServer();