const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// This is a mock database; replace with your real DB logic
const admins = [];
let adminIdCounter = 1;

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';

// Middleware to verify JWT token
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

// Register a new admin
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'Missing fields' });

  const exists = admins.find(a => a.email === email);
  if (exists) return res.status(400).json({ message: 'Admin already exists' });

  const hashedPassword = await bcrypt.hash(password, 10);
  const newAdmin = { id: adminIdCounter++, name, email, password: hashedPassword };
  admins.push(newAdmin);

  res.status(201).json({ message: 'Admin registered' });
});

// Login admin and return JWT
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const admin = admins.find(a => a.email === email);
  if (!admin) return res.status(401).json({ message: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, admin.password);
  if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

  const token = jwt.sign({ id: admin.id, email: admin.email, name: admin.name }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ token, adminName: admin.name });
});

// Get all admins (protected route)
router.get('/', authenticateToken, (req, res) => {
  res.json(admins.map(({ password, ...rest }) => rest)); // exclude password
});

// Get admin by ID (protected route)
router.get('/:id', authenticateToken, (req, res) => {
  const id = parseInt(req.params.id);
  const admin = admins.find(a => a.id === id);
  if (!admin) return res.status(404).json({ message: 'Admin not found' });

  const { password, ...rest } = admin;
  res.json(rest);
});

// Update admin by ID (protected route)
router.put('/:id', authenticateToken, async (req, res) => {
  const id = parseInt(req.params.id);
  const admin = admins.find(a => a.id === id);
  if (!admin) return res.status(404).json({ message: 'Admin not found' });

  const { name, email, password } = req.body;
  if (name) admin.name = name;
  if (email) admin.email = email;
  if (password) admin.password = await bcrypt.hash(password, 10);

  res.json({ message: 'Admin updated' });
});

module.exports = router;
