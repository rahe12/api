const express = require('express');
const router = express.Router();

const newsEntries = [];
let newsIdCounter = 1;

// Middleware to verify JWT token (reuse from admin.js or define here)
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, admin) => {
    if (err) return res.sendStatus(403);
    req.admin = admin;
    next();
  });
}

// List all news entries (protected)
router.get('/', authenticateToken, (req, res) => {
  res.json(newsEntries);
});

// Add news entry (admin only, protected)
router.post('/', authenticateToken, (req, res) => {
  const { title, content, published_at } = req.body;
  if (!title || !content || !published_at) return res.status(400).json({ message: 'Missing fields' });

  const newEntry = { id: newsIdCounter++, title, content, published_at };
  newsEntries.push(newEntry);

  res.status(201).json({ message: 'News entry created', news: newEntry });
});

module.exports = router;
