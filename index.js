require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());

// Static file hosting for uploaded images
const UPLOAD_DIR = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(UPLOAD_DIR));

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// PostgreSQL setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Middleware to authenticate JWT tokens
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ message: 'Authorization header missing' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token missing' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// DB initialization
async function initializeDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS news (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      image_url VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const { rows } = await pool.query('SELECT * FROM admins LIMIT 1');
  if (rows.length === 0) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await pool.query(
      'INSERT INTO admins (username, password) VALUES ($1, $2)',
      ['admin', hashedPassword]
    );
    console.log('Default admin created: username=admin password=admin123');
  }
}

// ========== ROUTES ==========

// Login (admin)
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: 'Username and password required' });

  try {
    const { rows } = await pool.query('SELECT * FROM admins WHERE username=$1', [username]);
    const admin = rows[0];
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Public - View all news
app.get('/api/news', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM news ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('Get news error:', err);
    res.status(500).json({ message: 'Failed to retrieve news' });
  }
});

// Public - View single news item
app.get('/api/news/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query('SELECT * FROM news WHERE id=$1', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'News not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Get news by ID error:', err);
    res.status(500).json({ message: 'Failed to retrieve news' });
  }
});

// Admin - Create news
app.post('/api/news', authenticateToken, upload.single('image'), async (req, res) => {
  const { title, content } = req.body;
  if (!title || !content)
    return res.status(400).json({ message: 'Title and content required' });

  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const { rows } = await pool.query(
      'INSERT INTO news (title, content, image_url) VALUES ($1, $2, $3) RETURNING *',
      [title, content, imageUrl]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Create news error:', err);
    res.status(500).json({ message: 'Failed to create news' });
  }
});

// Admin - Update news
app.put('/api/news/:id', authenticateToken, upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;

  if (!title || !content)
    return res.status(400).json({ message: 'Title and content required' });

  try {
    const { rows } = await pool.query('SELECT * FROM news WHERE id=$1', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'News not found' });

    let imageUrl = rows[0].image_url;

    if (req.file) {
      if (imageUrl) {
        const oldImagePath = path.join(__dirname, imageUrl);
        fs.unlink(oldImagePath, (err) => {
          if (err) console.error('Failed to delete old image:', err);
        });
      }
      imageUrl = `/uploads/${req.file.filename}`;
    }

    const updated = await pool.query(
      'UPDATE news SET title=$1, content=$2, image_url=$3 WHERE id=$4 RETURNING *',
      [title, content, imageUrl, id]
    );

    res.json(updated.rows[0]);
  } catch (err) {
    console.error('Update news error:', err);
    res.status(500).json({ message: 'Failed to update news' });
  }
});

// Admin - Delete news
app.delete('/api/news/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query('SELECT * FROM news WHERE id=$1', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'News not found' });

    const imageUrl = rows[0].image_url;
    if (imageUrl) {
      const imagePath = path.join(__dirname, imageUrl);
      fs.unlink(imagePath, (err) => {
        if (err) console.error('Failed to delete image:', err);
      });
    }

    await pool.query('DELETE FROM news WHERE id=$1', [id]);
    res.json({ message: 'News deleted successfully' });
  } catch (err) {
    console.error('Delete news error:', err);
    res.status(500).json({ message: 'Failed to delete news' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
initializeDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
  });
